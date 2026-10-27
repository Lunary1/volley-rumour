import type { BadgeVariant } from "@/components/ui/badge";
import { CATEGORY_BADGE_VARIANTS } from "@/lib/category-badges";

// Rumour statuses (Moderation Policy, D-002). New rumours start pending and
// only become public once a moderator approves them; RLS enforces this
// (issue #65). A moderator removes a public rumour after a takedown request
// (#68). A moderator resolves a lopend rumour as confirmed, denied or expired
// ("Niet bevestigd", neutral for the track record) (#70, D-020, D-005). An
// author withdraws their own pending or lopend rumour (#192, D-042).
export type RumourStatus =
  | "pending"
  | "rumour"
  | "confirmed"
  | "denied"
  | "expired"
  | "rejected"
  | "removed"
  | "withdrawn";

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
  withdrawn: "Ingetrokken",
};

// Withdrawing and editing your own rumour (#192, D-042). The database decides
// in withdraw_rumour() and the UPDATE policy on rumours; these only pick the
// buttons.

/** Pending or lopend: the author may still take it back. */
export function canWithdrawRumour(status: string): boolean {
  return status === "pending" || status === "rumour";
}

/** Only while no moderator has looked at it yet. */
export function canEditRumour(status: string): boolean {
  return status === "pending";
}

/** SQLSTATE from withdraw_rumour() once the rumour is past withdrawing. */
export const WITHDRAW_CLOSED_ERROR_CODE = "VR013";

export const WITHDRAW_CLOSED_MESSAGE =
  "Dit gerucht kan je niet meer intrekken: een moderator heeft het intussen afgerond.";
export const EDIT_CLOSED_MESSAGE =
  "Dit gerucht kan je niet meer bewerken: een moderator heeft het intussen nagekeken.";

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

/** Badge variant per category, shared by the card and the detail view (#174). */
export const RUMOUR_CATEGORY_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  transfer: CATEGORY_BADGE_VARIANTS.player,
  trainer_transfer: CATEGORY_BADGE_VARIANTS.trainer,
  player_retirement: CATEGORY_BADGE_VARIANTS.retirement,
  trainer_retirement: CATEGORY_BADGE_VARIANTS.retirement,
};

/**
 * Badge variant per public status (#208). The badge always shows
 * RUMOUR_STATUS_LABELS too, so the colour is never the only signal.
 */
export const RUMOUR_STATUS_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  rumour: "warning",
  confirmed: "success",
  denied: "danger",
  expired: "muted",
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

/**
 * Why the vote buttons are off for this user, or null when they may vote.
 * The database refuses these votes too (#78).
 */
export function votingClosedReason(
  rumour: { status: string; creator_id: string | null },
  currentUserId: string | null,
): string | null {
  if (!isVotingOpen(rumour.status)) return VOTING_CLOSED_MESSAGE;
  if (currentUserId && rumour.creator_id === currentUserId) {
    return OWN_RUMOUR_MESSAGE;
  }
  return null;
}

export type RumourVoteCounts = {
  id: string;
  votes_true: number;
  votes_false: number;
};

/** Just the counts, for a RumourVotesProvider (#200). */
export function voteCounts(rumours: RumourVoteCounts[]): RumourVoteCounts[] {
  return rumours.map(({ id, votes_true, votes_false }) => ({
    id,
    votes_true,
    votes_false,
  }));
}

/** Author label for a rumour whose creator deleted their account. */
export const DELETED_CREATOR_LABEL = "Verwijderd account";

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

/** A known division from a URL parameter, or null (#242). */
export function parseRumourDivision(
  value: string | string[] | undefined,
): RumourDivision | null {
  const division = Array.isArray(value) ? value[0] : value;
  return division && Object.hasOwn(RUMOUR_DIVISIONS, division)
    ? (division as RumourDivision)
    : null;
}

const RETIREMENT_CATEGORIES = ["player_retirement", "trainer_retirement"];

/**
 * The division a rumour is about (#242): where the player or trainer goes, or
 * for one who stops, where they played. As resolve_rumour picks it for the
 * transfer. Null for rumours from before #67.
 */
export function rumourDivision(rumour: {
  category: string;
  to_division: string | null;
  from_division: string | null;
}): string | null {
  return RETIREMENT_CATEGORIES.includes(rumour.category)
    ? rumour.from_division
    : rumour.to_division;
}

/** A PostgREST `or` filter for the rumours in a division, as rumourDivision. */
export function rumourDivisionFilter(division: RumourDivision): string {
  return `and(category.not.in.(${RETIREMENT_CATEGORIES}),to_division.eq.${division}),and(category.in.(${RETIREMENT_CATEGORIES}),from_division.eq.${division})`;
}

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

// ------------------------------------------------------- track record (#88)
// D-005: reputation is how often a contributor was right, counted by the
// database on moderator-resolved rumours only (profiles.rumours_confirmed and
// rumours_denied). Expired rumours are neutral. Votes award nothing.

export type TrackRecord = {
  rumours_confirmed: number;
  rumours_denied: number;
};

/** The profile columns that hold a contributor's track record. */
export const TRACK_RECORD_COLUMNS = "rumours_confirmed, rumours_denied";

/** Resolved rumours needed for Betrouwbare bronnen; trusted_sources() checks it. */
export const TRUSTED_SOURCE_MIN_RESOLVED = 5;

/** "5 van 6 bevestigd", or null before any rumour was confirmed or denied. */
export function formatTrackRecord(record: TrackRecord): string | null {
  const resolved = record.rumours_confirmed + record.rumours_denied;
  if (resolved === 0) return null;
  return `${record.rumours_confirmed} van ${resolved} bevestigd`;
}

/** Share of voters who believe the rumour, or null without votes. */
export function belief(votesTrue: number, votesFalse: number): number | null {
  const total = votesTrue + votesFalse;
  return total > 0 ? Math.round((votesTrue / total) * 100) : null;
}

/** The neutral community signal under a rumour (D-005). */
export function formatBelief(votesTrue: number, votesFalse: number): string {
  const share = belief(votesTrue, votesFalse);
  return share === null
    ? "Nog geen stemmen"
    : `${share}% van de stemmers denkt dat dit klopt`;
}

/** "Jan Peeters: van Club A naar Club B" for titles and share images (#99). */
export function rumourHeadline(rumour: {
  player_name: string;
  from_club_name: string | null;
  to_club_name: string;
  category: string;
}): { player: string; move: string } {
  const from = rumour.from_club_name ? `van ${rumour.from_club_name} ` : "";
  return {
    player: rumour.player_name,
    move: rumour.category.includes("retirement")
      ? `stopt${rumour.from_club_name ? ` bij ${rumour.from_club_name}` : ""}`
      : `${from}naar ${rumour.to_club_name}`,
  };
}
