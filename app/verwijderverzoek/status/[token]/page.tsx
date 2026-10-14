import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/server";
import { TAKEDOWN_STATUS_LABELS, type TakedownStatus } from "@/lib/takedown";

// Status of a takedown request (#68, D-014). The token in the link is the
// only key: whoever has it may see this request, so the page reads it with
// the service role after matching the token's hash. It shows no personal
// data, only the reference, the rumour's name and the decision.

export const metadata: Metadata = {
  title: "Status van je verwijderverzoek - VolleyRumours",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// randomBytes(32) as base64url
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

interface TakedownStatusRow {
  reference: string;
  status: TakedownStatus;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  rumour: { player_name: string } | null;
}

const statusExplanations: Record<TakedownStatus, string> = {
  open: "Een moderator bekijkt je verzoek. Tot er een beslissing is, blijft het gerucht zichtbaar.",
  removed: "Het gerucht is niet meer zichtbaar op VolleyRumours.",
  rejected: "Het gerucht blijft staan.",
};

const statusColors: Record<TakedownStatus, string> = {
  open: "bg-yellow-500/20 text-yellow-700 border-yellow-200 dark:text-yellow-300 dark:border-yellow-500/50",
  removed:
    "bg-green-500/20 text-green-700 border-green-200 dark:text-green-300 dark:border-green-500/50",
  rejected: "bg-muted text-muted-foreground",
};

export default async function TakedownStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!TOKEN_PATTERN.test(token)) notFound();

  const admin = createAdminClient();
  const { data } = await admin
    .from("takedown_requests")
    .select(
      "reference, status, decision_note, decided_at, created_at, rumour:rumour_id(player_name)",
    )
    .eq("token_hash", createHash("sha256").update(token).digest("hex"))
    .maybeSingle();
  if (!data) notFound();
  const request = data as unknown as TakedownStatusRow;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold">Je verwijderverzoek</h1>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
            <h2 className="font-mono">{request.reference}</h2>
            <Badge variant="outline" className={statusColors[request.status]}>
              {TAKEDOWN_STATUS_LABELS[request.status]}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Gerucht over</dt>
            <dd>{request.rumour?.player_name ?? "Onbekend"}</dd>
            <dt className="text-muted-foreground">Ingediend op</dt>
            <dd>
              {format(new Date(request.created_at), "d MMMM yyyy 'om' HH:mm", {
                locale: nl,
              })}
            </dd>
            {request.decided_at && (
              <>
                <dt className="text-muted-foreground">Beslist op</dt>
                <dd>
                  {format(
                    new Date(request.decided_at),
                    "d MMMM yyyy 'om' HH:mm",
                    { locale: nl },
                  )}
                </dd>
              </>
            )}
          </dl>
          <p>{statusExplanations[request.status]}</p>
          {request.decision_note && (
            <div className="space-y-1">
              <p className="font-medium">Toelichting van de moderator</p>
              <p className="whitespace-pre-line rounded-md border bg-muted/30 p-3">
                {request.decision_note}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
