import { format, formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { ArrowRight, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  RUMOUR_CATEGORY_LABELS,
  RUMOUR_SOURCE_TYPES,
  RUMOUR_STATUS_LABELS,
  labelFor,
  type RumourStatus,
} from "@/lib/rumours";
import {
  TAKEDOWN_RELATION_SHORT_LABELS,
  TAKEDOWN_STATUS_LABELS,
  type TakedownRelation,
  type TakedownStatus,
} from "@/lib/takedown";
import { TakedownActions } from "./takedown-actions";

// Takedown requests (#68, D-014): open ones oldest first, then the latest
// decisions. The admin layout already let only staff through; RLS shows the
// requests to staff only. Reports from users (#69, #79, #87) join this page.

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
  rumour: {
    player_name: string;
    category: string;
    from_club_name: string | null;
    to_club_name: string | null;
    description: string | null;
    source_type: string | null;
    source_url: string | null;
    status: string;
    creator: { username: string } | null;
  } | null;
}

const COLUMNS =
  "id, reference, relation, requester_name, requester_email, explanation, status, decision_note, decided_at, created_at, rumour:rumour_id(player_name, category, from_club_name, to_club_name, description, source_type, source_url, status, creator:creator_id(username))";

function when(date: string) {
  return (
    <span title={format(new Date(date), "d MMM yyyy HH:mm", { locale: nl })}>
      {formatDistanceToNow(new Date(date), { addSuffix: true, locale: nl })}
    </span>
  );
}

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
          <Badge variant="outline" className="font-mono">
            {request.reference}
          </Badge>
          {request.status !== "open" && (
            <Badge variant="secondary">
              {TAKEDOWN_STATUS_LABELS[request.status]}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            Ingediend {when(request.created_at)}
            {request.decided_at && <> · beslist {when(request.decided_at)}</>}
          </span>
        </div>
        <CardTitle className="text-lg">
          <h3>{rumour?.player_name ?? "Onbekend gerucht"}</h3>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rumour && (
          <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {RUMOUR_CATEGORY_LABELS[rumour.category] ?? rumour.category}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {RUMOUR_STATUS_LABELS[rumour.status as RumourStatus] ??
                  rumour.status}{" "}
                · door {rumour.creator?.username ?? "een verwijderd account"}
              </span>
            </div>
            {(rumour.from_club_name || rumour.to_club_name) && (
              <p className="flex flex-wrap items-center gap-1.5">
                {rumour.from_club_name && <span>{rumour.from_club_name}</span>}
                {rumour.from_club_name && rumour.to_club_name && (
                  <ArrowRight
                    className="h-3.5 w-3.5 text-muted-foreground"
                    aria-label="naar"
                  />
                )}
                {rumour.to_club_name && <span>{rumour.to_club_name}</span>}
              </p>
            )}
            <p className="text-muted-foreground">
              Bron:{" "}
              {labelFor(RUMOUR_SOURCE_TYPES, rumour.source_type) ??
                "Geen bron opgegeven"}
              {rumour.source_url && (
                <>
                  {" · "}
                  <a
                    href={rumour.source_url}
                    target="_blank"
                    rel="nofollow ugc noopener noreferrer"
                    className="break-all text-primary underline underline-offset-2"
                  >
                    {rumour.source_url}
                  </a>
                </>
              )}
            </p>
            {rumour.description && (
              <p className="whitespace-pre-line text-muted-foreground">
                {rumour.description}
              </p>
            )}
          </div>
        )}

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

export default async function ReportsPage() {
  const supabase = await createClient();
  const [open, decided] = await Promise.all([
    supabase
      .from("takedown_requests")
      .select(COLUMNS, { count: "exact" })
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(OPEN_LIMIT),
    supabase
      .from("takedown_requests")
      .select(COLUMNS)
      .neq("status", "open")
      .order("decided_at", { ascending: false })
      .limit(DECIDED_LIMIT),
  ]);
  const openRequests = (open.data ?? []) as unknown as TakedownRequestRow[];
  const decidedRequests = (decided.data ??
    []) as unknown as TakedownRequestRow[];
  const count = open.count ?? openRequests.length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Meldingen</h2>
        <p className="text-sm text-muted-foreground">
          Verwijderverzoeken van mensen over wie een gerucht gaat, oudste eerst.
          Het gerucht blijft zichtbaar tot je beslist. De aanvrager leest je
          beslissing en toelichting via de statuslink. Elke beslissing komt in
          het logboek.
        </p>
      </div>

      {open.error || decided.error ? (
        <p className="text-destructive">
          De meldingen konden niet geladen worden.
        </p>
      ) : (
        <>
          <section className="space-y-4" aria-labelledby="open-verzoeken">
            <h3 id="open-verzoeken" className="text-lg font-semibold">
              Open verwijderverzoeken
            </h3>
            {openRequests.length === 0 ? (
              <p className="text-muted-foreground">
                Geen open verwijderverzoeken.
              </p>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {count === 1
                    ? "1 verzoek wacht op een beslissing."
                    : `${count} verzoeken wachten op een beslissing.`}
                </p>
                <ul aria-label="Open verwijderverzoeken" className="space-y-4">
                  {openRequests.map((request) => (
                    <li key={request.id}>
                      <RequestCard request={request} />
                    </li>
                  ))}
                </ul>
                {count > OPEN_LIMIT && (
                  <p className="text-xs text-muted-foreground">
                    De oudste {OPEN_LIMIT} worden getoond.
                  </p>
                )}
              </>
            )}
          </section>

          {decidedRequests.length > 0 && (
            <section className="space-y-4" aria-labelledby="behandeld">
              <h3 id="behandeld" className="text-lg font-semibold">
                Recent behandeld
              </h3>
              <ul
                aria-label="Behandelde verwijderverzoeken"
                className="space-y-4"
              >
                {decidedRequests.map((request) => (
                  <li key={request.id}>
                    <RequestCard request={request} />
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
