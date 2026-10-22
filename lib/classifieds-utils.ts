import { RUMOUR_DIVISIONS, labelFor } from "@/lib/rumours";
import { formatDate } from "@/lib/dates";

/** Senior divisions only (D-003), the same list as rumours. */
export const DIVISION_LABELS: Record<string, string> = RUMOUR_DIVISIONS;

export const CLASSIFIED_TYPE_LABELS: Record<string, string> = {
  player_seeks_team: "Speler zoekt team",
  team_seeks_player: "Team zoekt speler",
  trainer_seeks_team: "Trainer zoekt team",
  team_seeks_trainer: "Team zoekt trainer",
};

/** The four kinds of zoekertje, as the create form offers them. */
export const CLASSIFIED_TYPES = {
  player_seeks_team: "Speler/speelster zoekt team",
  team_seeks_player: "Team zoekt speler/speelster",
  trainer_seeks_team: "Trainer/trainster zoekt team",
  team_seeks_trainer: "Team zoekt trainer/trainster",
} as const;

export type ClassifiedType = keyof typeof CLASSIFIED_TYPES;

/** Ads posted by a person rather than a team. */
export function isPersonAd(type: string): boolean {
  return type === "player_seeks_team" || type === "trainer_seeks_team";
}

/** Ads about a player, which name a position. */
export function isPlayerAd(type: string): boolean {
  return type === "player_seeks_team" || type === "team_seeks_player";
}

/**
 * Heren or dames (#71). Every senior division is one or the other, so the
 * database refuses a gender that doesn't match the division.
 */
export const CLASSIFIED_GENDERS = {
  heren: "Heren",
  dames: "Dames",
} as const;

export type ClassifiedGender = keyof typeof CLASSIFIED_GENDERS;

/** Whether a division ('nat2_dames') belongs to a gender ('dames'). */
export function divisionMatchesGender(
  division: string,
  gender: string,
): boolean {
  return division.split("_")[1] === gender;
}

export const POSITION_LABELS = {
  setter: "Setter",
  libero: "Libero",
  receptiehoek: "Receptie/hoek",
  middenaanvaller: "Middenaanvaller",
  opposite: "Opposite",
} as const;

export type ClassifiedPosition = keyof typeof POSITION_LABELS;

/** Keep in sync with classifieds_trainer_diploma_check in the migrations. */
export const TRAINER_DIPLOMA_LABELS = {
  initiator: "Initiator",
  instructeur: "Instructeur",
  trainer_c: "Trainer C",
  trainer_b: "Trainer B",
  trainer_a: "Trainer A",
} as const;

export type TrainerDiploma = keyof typeof TRAINER_DIPLOMA_LABELS;

export const PROVINCE_LABELS = {
  antwerpen: "Antwerpen",
  limburg: "Limburg",
  oost_vlaanderen: "Oost-Vlaanderen",
  vlaams_brabant: "Vlaams-Brabant",
  west_vlaanderen: "West-Vlaanderen",
  henegouwen: "Henegouwen",
  waals_brabant: "Waals-Brabant",
  namen: "Namen",
  luik: "Luik",
  luxemburg: "Luxemburg",
  frankrijk: "Frankrijk",
  zwitserland: "Zwitserland",
  turkije: "Turkije",
  nederland: "Nederland",
} as const;

export type ClassifiedProvince = keyof typeof PROVINCE_LABELS;

export const CLASSIFIED_DESCRIPTION_MAX_LENGTH = 2000;

/**
 * Whether an ad is past its expiry date (#84, D-024). The database sets the
 * date; expired ads are hidden from everyone but their owner and staff.
 */
export function isClassifiedExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

/**
 * The last day an ad is online, e.g. "31 augustus 2027". An ad that runs to
 * the end of the season expires at midnight on 1 September, so this is the
 * day before that moment.
 */
export function classifiedLastDay(expiresAt: string): string {
  return formatDate(new Date(expiresAt).getTime() - 1000, "d MMMM yyyy");
}

/**
 * SQLSTATE the database raises for a new conversation about a zoekertje that
 * isn't online, or with someone other than its poster (#83).
 */
export const CLASSIFIED_OFFLINE_ERROR_CODE = "VR011";

export const CLASSIFIED_OFFLINE_MESSAGE =
  "Dit zoekertje staat niet meer online";

/** Featured only until `featured_until`, when it has one (#84). */
export function isFeaturedNow(ad: {
  is_featured?: boolean | null;
  featured_until?: string | null;
}): boolean {
  if (!ad.is_featured) return false;
  return !ad.featured_until || new Date(ad.featured_until) > new Date();
}

export function getDivisionLabel(value: string | null): string {
  if (!value) return "";
  return DIVISION_LABELS[value] || value;
}

export function getProvinceLabel(value: string | null): string {
  return labelFor(PROVINCE_LABELS, value) ?? value ?? "";
}

/** Older ads may hold a free-text position; show it as is. */
export function getPositionLabel(value: string | null): string {
  return labelFor(POSITION_LABELS, value) ?? value ?? "";
}
