import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  TAKEDOWN_RELATION_SHORT_LABELS,
  TAKEDOWN_STATUS_LABELS,
  type TakedownRelation,
  type TakedownStatus,
} from "@/lib/takedown";
import { REPORT_COLUMNS, ReportCard, type ReportRow } from "./report-card";
import {
  RUMOUR_SUMMARY_COLUMNS,
  RumourSummary,
  When,
  type RumourSummaryRow,
} from "./shared";
import { TakedownActions } from "./takedown-actions";

// Everything users flag, in one list (J-15): takedown requests (#68, D-014)
// first because they have priority, then reports of rumours, zoekertjes and
// conversations (#69, D-015), oldest first. Below them, the latest decisions.
// The admin layout already let only staff through; RLS shows both tables to
// staff only.

const OPEN_LIMIT = 50;
const DECIDED_LIMIT = 20;

interface TakedownRequestRow {
  id: string;
  reference: string;
  relation: TakedownRelation;
  requester_name: string | null;
  requester_email: string | null;
  explanation: string | null;
  status: TakedownStatus;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  rumour: RumourSummaryRow | null;
}

const TAKEDOWN_COLUMNS = `id, reference, relation, requester_name, requester_email, explanation, status, decision_note, decided_at, created_at, rumour:rumour_id(${RUMOUR_SUMMARY_COLUMNS})`;

type Item =
  | { kind: "takedown"; row: TakedownRequestRow }
  | { kind: "report"; row: ReportRow };

function RequestCard({ request }: { request: TakedownRequestRow }) {
  const rumour = request.rumour;
  const mailto =
    request.requester_email &&
    `mailto:${request.requester_email}?subject=${encodeURIComponent(
      `Je verwijderverzoek ${request.reference}`,
    )}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Verwijderverzoek</Badge>
          <Badge variant="outline" className="font-mono">
            {request.reference}
          </Badge>
          {request.status === "open" ? (
            <Badge>Voorrang</Badge>
          ) : (
            <Badge variant="secondary">
              {TAKEDOWN_STATUS_LABELS[request.status]}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            Ingediend <When date={request.created_at} />
            {request.decided_at && (
              <>
                {" "}
                · beslist <When date={request.decided_at} />
              </>
            )}
          </span>
        </div>
        <CardTitle className="text-lg">
          <h3>{rumour?.player_name ?? "Onbekend gerucht"}</h3>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rumour && <RumourSummary rumour={rumour} />}

        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Aanvrager</dt>
          <dd>
            {request.requester_name ?? "Gewist na 12 maanden"} (
            {TAKEDOWN_RELATION_SHORT_LABELS[request.relation]})
          </dd>
          {request.requester_email && mailto && (
            <>
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="min-w-0">
                <a
                  href={mailto}
                  className="inline-flex items-center gap-1 break-all text-primary underline underline-offset-2"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {request.requester_email}
                </a>
              </dd>
            </>
          )}
        </dl>
        {request.explanation && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Waarom het gerucht weg moet</p>
            <p className="whitespace-pre-line text-muted-foreground">
              {request.explanation}
            </p>
          </div>
        )}
        {request.decision_note && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Toelichting voor de aanvrager</p>
            <p className="whitespace-pre-line text-muted-foreground">
              {request.decision_note}
            </p>
          </div>
        )}

        {request.status === "open" && (
          <TakedownActions
            requestId={request.id}
            reference={request.reference}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ItemCard({ item }: { item: Item }) {
  return item.kind === "takedown" ? (
    <RequestCard request={item.row} />
  ) : (
    <ReportCard report={item.row} />
  );
}

export default async function ReportsPage() {
  const supabase = await createClient();
  const [openTakedowns, decidedTakedowns, openReports, decidedReports] =
    await Promise.all([
      supabase
        .from("takedown_requests")
        .select(TAKEDOWN_COLUMNS, { count: "exact" })
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .limit(OPEN_LIMIT),
      supabase
        .from("takedown_requests")
        .select(TAKEDOWN_COLUMNS)
        .neq("status", "open")
        .order("decided_at", { ascending: false })
        .limit(DECIDED_LIMIT),
      supabase
        .from("reports")
        .select(REPORT_COLUMNS, { count: "exact" })
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .limit(OPEN_LIMIT),
      supabase
        .from("reports")
        .select(REPORT_COLUMNS)
        .neq("status", "open")
        .order("decided_at", { ascending: false })
        .limit(DECIDED_LIMIT),
    ]);
  const failed = [
    openTakedowns,
    decidedTakedowns,
    openReports,
    decidedReports,
  ].some((result) => result.error);

  const takedowns = (rows: unknown) =>
    ((rows ?? []) as TakedownRequestRow[]).map((row): Item => ({
      kind: "takedown",
      row,
    }));
  const reports = (rows: unknown) =>
    ((rows ?? []) as ReportRow[]).map((row): Item => ({ kind: "report", row }));

  const openItems = [
    ...takedowns(openTakedowns.data),
    ...reports(openReports.data),
  ];
  const decidedItems = [
    ...takedowns(decidedTakedowns.data),
    ...reports(decidedReports.data),
  ]
    .sort((a, b) =>
      (b.row.decided_at ?? "").localeCompare(a.row.decided_at ?? ""),
    )
    .slice(0, DECIDED_LIMIT);
  const takedownCount = openTakedowns.count ?? 0;
  const reportCount = openReports.count ?? 0;
  const count = takedownCount + reportCount;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Meldingen</h2>
        <p className="text-sm text-muted-foreground">
          Verwijderverzoeken van mensen over wie een gerucht gaat krijgen
          voorrang; daarna meldingen van gebruikers, oudste eerst. Alles blijft
          zichtbaar tot je beslist. Een beslissing geldt voor alle open
          meldingen over hetzelfde item en komt in het logboek.
        </p>
      </div>

      {failed ? (
        <p className="text-destructive">
          De meldingen konden niet geladen worden.
        </p>
      ) : (
        <>
          <section className="space-y-4" aria-labelledby="open-meldingen">
            <h3 id="open-meldingen" className="text-lg font-semibold">
              Open
            </h3>
            {openItems.length === 0 ? (
              <p className="text-muted-foreground">Geen open meldingen.</p>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {count === 1
                    ? "1 melding wacht op een beslissing."
                    : `${count} meldingen wachten op een beslissing.`}
                </p>
                <ul aria-label="Open meldingen" className="space-y-4">
                  {openItems.map((item) => (
                    <li key={`${item.kind}-${item.row.id}`}>
                      <ItemCard item={item} />
                    </li>
                  ))}
                </ul>
                {(takedownCount > OPEN_LIMIT || reportCount > OPEN_LIMIT) && (
                  <p className="text-xs text-muted-foreground">
                    Van elke soort worden de oudste {OPEN_LIMIT} getoond.
                  </p>
                )}
              </>
            )}
          </section>

          {decidedItems.length > 0 && (
            <section className="space-y-4" aria-labelledby="behandeld">
              <h3 id="behandeld" className="text-lg font-semibold">
                Recent behandeld
              </h3>
              <ul aria-label="Behandelde meldingen" className="space-y-4">
                {decidedItems.map((item) => (
                  <li key={`${item.kind}-${item.row.id}`}>
                    <ItemCard item={item} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
