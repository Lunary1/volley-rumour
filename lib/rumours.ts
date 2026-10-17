// Rumour statuses (Moderation Policy, D-002). New rumours start pending and
// only become public once a moderator approves them; RLS enforces this
// (issue #65). A moderator removes a public rumour after a takedown request
// (#68). A moderator resolves a lopend rumour as confirmed, denied or expired
// ("Niet bevestigd", neutral for the track record) (#70, D-020, D-005).
export type RumourStatus =
  | "pending"
  | "rumour"
  | "confirmed"
  | "denied"
  | "expired"
  | "rejected"
  | "removed";

/** Statuses everyone may see. Authors and staff can also read the others. */
export const PUBLIC_RUMOUR_STATUSES = [
  "rumour",
  "confirmed",
  "denied",
  "expired",
] as const;

export function isPublicRumourStatus(status: string): boolean {
  return (PUBLIC_RUMOUR_STATUSES as readonly string[]).includes(status);
}

/** How a status reads for the author, e.g. on their profile. */
export const RUMOUR_STATUS_LABELS: Record<RumourStatus, string> = {
  pending: "Wordt nagekeken",
  rumour: "Lopend",
  confirmed: "Bevestigd",
  denied: "Ontkracht",
  expired: "Niet bevestigd",
  rejected: "Afgewezen",
  removed: "Verwijderd",
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

/**
 * Where a rumour comes from (#67). Required on new rumours and shown on the
 * card. Keep in sync with the source_type check in the migrations.
 */
export const RUMOUR_SOURCE_TYPES = {
  own_observation: "Eigen waarneming",
  player_or_trainer: "Speler of trainer zelf",
  club: "Club",
  media: "Media (krant, website, sociale media)",
} as const;

export type RumourSourceType = keyof typeof RUMOUR_SOURCE_TYPES;

/** Short source labels for the cards: "Bron: Media". */
export const RUMOUR_SOURCE_SHORT_LABELS: Record<RumourSourceType, string> = {
  own_observation: "Eigen waarneming",
  player_or_trainer: "Speler of trainer",
  club: "Club",
  media: "Media",
};

export const SOURCE_URL_MAX_LENGTH = 500;

/**
 * How many rumours one author may have waiting for a moderator (#54, D-013).
 * The database enforces it in check_new_rumour(); keep the two in sync.
 */
export const MAX_PENDING_RUMOURS = 5;

export const PENDING_LIMIT_MESSAGE = `Je hebt al ${MAX_PENDING_RUMOURS} geruchten die op een moderator wachten. Je kan een nieuw gerucht delen zodra er een is nagekeken.`;

// Voting (#78). The database decides in check_vote_allowed(): only lopende
// rumours (status "rumour"), and not your own.
export type VoteType = "up" | "down";

/** SQLSTATE for a vote on your own rumour. */
export const OWN_RUMOUR_ERROR_CODE = "VR009";
/** SQLSTATE for a vote on a rumour that isn't lopend. */
export const VOTING_CLOSED_ERROR_CODE = "VR010";

export const OWN_RUMOUR_MESSAGE = "Je kan niet stemmen op je eigen gerucht";
export const VOTING_CLOSED_MESSAGE = "Stemmen kan alleen op lopende geruchten";
export const LOGIN_TO_VOTE_MESSAGE = "Log in om te stemmen";

export function isVotingOpen(status: string): boolean {
  return status === "rumour";
}

/** Senior divisions only (D-003). Keep in sync with the migrations. */
export const RUMOUR_DIVISIONS = {
  liga_heren: "LIGA HEREN",
  liga_dames: "LIGA DAMES",
  nat1_heren: "Nationale 1 Heren",
  nat2_heren: "Nationale 2 Heren",
  nat3_heren: "Nationale 3 Heren",
  nat1_dames: "Nationale 1 Dames",
  nat2_dames: "Nationale 2 Dames",
  nat3_dames: "Nationale 3 Dames",
  promo1_heren: "PROMO 1 Heren",
  promo2_heren: "PROMO 2 Heren",
  promo3_heren: "PROMO 3 Heren",
  promo4_heren: "PROMO 4 Heren",
  promo1_dames: "PROMO 1 Dames",
  promo2_dames: "PROMO 2 Dames",
  promo3_dames: "PROMO 3 Dames",
  promo4_dames: "PROMO 4 Dames",
} as const;

export type RumourDivision = keyof typeof RUMOUR_DIVISIONS;

export const RUMOUR_GENDERS = {
  male: "Man",
  female: "Vrouw",
} as const;

/** Looks up a label, or null for a missing or unknown value. */
export function labelFor<T extends Record<string, string>>(
  labels: T,
  value: string | null | undefined,
): string | null {
  return value && value in labels ? labels[value as keyof T] : null;
}
