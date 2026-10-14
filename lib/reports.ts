// User reports: logged-in users report a rumour, a zoekertje or a
// conversation; moderators handle them in /admin/meldingen (#69, #79, #87,
// J-15, D-015). Reported content stays visible until a moderator decides.

export type ReportTargetType = "rumour" | "classified" | "conversation";

/**
 * Why a rumour or zoekertje is reported. Keep in sync with the reports_reason
 * check and submit_report() in the migrations.
 */
export const CONTENT_REPORT_REASONS = {
  incorrect: "Onjuist of misleidend",
  offensive: "Beledigend of haatdragend",
  private_info: "Privé-informatie",
  spam: "Spam of oplichting",
  minor: "Mogelijk over een minderjarige",
  other: "Andere",
} as const;

/** Why a conversation is reported. Keep in sync like the list above. */
export const CONVERSATION_REPORT_REASONS = {
  harassment: "Intimidatie of ongewenst gedrag",
  offensive: "Beledigend",
  spam: "Spam of oplichting",
  inappropriate: "Ongepaste inhoud",
  other: "Andere",
} as const;

export type ContentReportReason = keyof typeof CONTENT_REPORT_REASONS;
export type ConversationReportReason = keyof typeof CONVERSATION_REPORT_REASONS;
export type ReportReason = ContentReportReason | ConversationReportReason;

export function reportReasonsFor(
  targetType: ReportTargetType,
): Record<string, string> {
  return targetType === "conversation"
    ? CONVERSATION_REPORT_REASONS
    : CONTENT_REPORT_REASONS;
}

export function reportReasonLabel(
  targetType: ReportTargetType,
  reason: string,
): string {
  return reportReasonsFor(targetType)[reason] ?? reason;
}

export type ReportStatus =
  "open" | "content_removed" | "dismissed" | "action_taken";

/** How a report's outcome reads in the inbox. */
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: "Open",
  content_removed: "Inhoud verwijderd",
  dismissed: "Geen actie",
  action_taken: "Maatregel genomen",
};

/** What the inbox calls each kind of report. */
export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  rumour: "Gerucht",
  classified: "Zoekertje",
  conversation: "Gesprek",
};

export const REPORT_EXPLANATION_MIN_LENGTH = 10;
export const REPORT_EXPLANATION_MAX_LENGTH = 1000;
export const REPORT_NOTE_MAX_LENGTH = 500;

/** Reports per user per day. submit_report() enforces it; keep in sync. */
export const REPORT_LIMITS = { perDay: 10 } as const;
