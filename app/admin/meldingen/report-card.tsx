import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CLASSIFIED_TYPE_LABELS } from "@/lib/classifieds-utils";
import {
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
  reportReasonLabel,
  type ReportStatus,
  type ReportTargetType,
} from "@/lib/reports";
import { ReportActions } from "./report-actions";
import { ReportedConversation } from "./reported-conversation";
import {
  RUMOUR_SUMMARY_COLUMNS,
  RumourSummary,
  When,
  type RumourSummaryRow,
} from "./shared";

// A user report (#69, #79, #87) in /admin/meldingen. Conversations show no
// messages here: the moderator opens them on purpose, and that is logged.

export interface ReportRow {
  id: string;
  target_type: ReportTargetType;
  reason: string;
  explanation: string | null;
  status: ReportStatus;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  reporter: { username: string } | null;
  reported_user: { id: string; username: string } | null;
  rumour: RumourSummaryRow | null;
  classified: {
    id: string;
    title: string;
    type: string;
    description: string | null;
    removed_at: string | null;
  } | null;
}

export const REPORT_COLUMNS = `id, target_type, reason, explanation, status, decision_note, decided_at, created_at, reporter:reporter_id(username), reported_user:reported_user_id(id, username), rumour:rumour_id(${RUMOUR_SUMMARY_COLUMNS}), classified:classified_id(id, title, type, description, removed_at)`;

function title(report: ReportRow) {
  switch (report.target_type) {
    case "rumour":
      return report.rumour?.player_name ?? "Onbekend gerucht";
    case "classified":
      return report.classified?.title ?? "Onbekend zoekertje";
    case "conversation":
      return `Gesprek met ${report.reported_user?.username ?? "een verwijderd account"}`;
  }
}

export function ReportCard({ report }: { report: ReportRow }) {
  const classified = report.classified;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {REPORT_TARGET_LABELS[report.target_type]}
          </Badge>
          {report.status !== "open" && (
            <Badge variant="secondary">
              {REPORT_STATUS_LABELS[report.status]}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            Gemeld <When date={report.created_at} />
            {report.decided_at && (
              <>
                {" "}
                · beslist <When date={report.decided_at} />
              </>
            )}
          </span>
        </div>
        <CardTitle className="text-lg">
          <h3>{title(report)}</h3>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {report.rumour && <RumourSummary rumour={report.rumour} />}
        {classified && (
          <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {CLASSIFIED_TYPE_LABELS[classified.type] ?? classified.type}
              </Badge>
              {classified.removed_at ? (
                <span className="text-xs text-muted-foreground">
                  Verwijderd
                </span>
              ) : (
                <Link
                  href={`/zoekertjes/${classified.id}`}
                  target="_blank"
                  className="text-xs text-primary underline underline-offset-2"
                >
                  Bekijk het zoekertje
                </Link>
              )}
            </div>
            {classified.description && (
              <p className="whitespace-pre-line text-muted-foreground">
                {classified.description}
              </p>
            )}
          </div>
        )}

        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Reden</dt>
          <dd>{reportReasonLabel(report.target_type, report.reason)}</dd>
          <dt className="text-muted-foreground">Gemeld door</dt>
          <dd>{report.reporter?.username ?? "Verwijderd account"}</dd>
          <dt className="text-muted-foreground">
            {report.target_type === "conversation" ? "Over" : "Auteur"}
          </dt>
          <dd>
            {report.reported_user ? (
              <Link
                href={`/admin/gebruikers/${report.reported_user.id}`}
                className="text-primary underline underline-offset-2"
              >
                {report.reported_user.username}
              </Link>
            ) : (
              "Verwijderd account"
            )}
          </dd>
        </dl>
        {report.explanation && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Uitleg van de melder</p>
            <p className="whitespace-pre-line text-muted-foreground">
              {report.explanation}
            </p>
          </div>
        )}
        {report.decision_note && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Toelichting bij de beslissing</p>
            <p className="whitespace-pre-line text-muted-foreground">
              {report.decision_note}
            </p>
          </div>
        )}

        {report.status === "open" && (
          <>
            {report.target_type === "conversation" && (
              <ReportedConversation reportId={report.id} />
            )}
            <ReportActions
              reportId={report.id}
              targetType={report.target_type}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
