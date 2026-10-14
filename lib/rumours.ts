// Rumour statuses (Moderation Policy, D-002). New rumours start pending and
// only become public once a moderator approves them; RLS enforces this
// (issue #65).
export type RumourStatus =
  | "pending"
  | "rumour"
  | "confirmed"
  | "denied"
  | "rejected";

/** Statuses everyone may see. Authors and staff can also read the others. */
export const PUBLIC_RUMOUR_STATUSES = ["rumour", "confirmed", "denied"] as const;

export function isPublicRumourStatus(status: string): boolean {
  return (PUBLIC_RUMOUR_STATUSES as readonly string[]).includes(status);
}

/** How a status reads for the author, e.g. on their profile. */
export const RUMOUR_STATUS_LABELS: Record<RumourStatus, string> = {
  pending: "Wordt nagekeken",
  rumour: "Lopend",
  confirmed: "Bevestigd",
  denied: "Ontkracht",
  rejected: "Afgewezen",
};

/**
 * Why a moderator rejected a rumour (Moderation Policy, #66). The author sees
 * the label. Keep in sync with reject_rumour() in the migrations, which writes
 * the same labels to the audit log.
 */
export const REJECTION_REASONS = {
  no_source: "Geen of onvoldoende bron",
  minor_or_not_senior: "Mogelijk minderjarige of geen senior niveau",
  offensive_or_personal: "Beledigend of persoonlijk",
  duplicate: "Dubbel gerucht",
  incomplete: "Onvolledig of onduidelijk",
  other: "Andere",
} as const;

export type RejectionReason = keyof typeof REJECTION_REASONS;

export const REJECTION_NOTE_MAX_LENGTH = 500;

/** Rumour categories as the site shows them. */
export const RUMOUR_CATEGORY_LABELS: Record<string, string> = {
  transfer: "Transfer",
  trainer_transfer: "Trainer Transfer",
  player_retirement: "Speler Stopt",
  trainer_retirement: "Trainer Stopt",
};
