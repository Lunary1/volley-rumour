// Suspensions, the verified badge and the moderator role (#80, D-016). Admins
// change them in /admin/gebruikers; the database functions in the
// user_sanctions migration check who may do what and write the audit log.

/**
 * SQLSTATE the database raises when a suspended user tries to post, vote,
 * message or edit their profile (check_account_not_suspended()).
 */
export const SUSPENDED_ERROR_CODE = "VR005";

export const SUSPENDED_MESSAGE =
  "Je account is geschorst. Je kan de site nog lezen, maar niets plaatsen, stemmen of berichten sturen.";

/** Keep in sync with the 500-character checks in the migration. */
export const SUSPENSION_REASON_MAX_LENGTH = 500;
export const SANCTION_NOTE_MAX_LENGTH = 500;

/** How long a suspension lasts, as the admin picks it. */
export const SUSPENSION_DURATIONS = {
  "7": "7 dagen",
  "30": "30 dagen",
  date: "Tot een datum",
  indefinite: "Onbepaalde tijd",
} as const;

export type SuspensionDuration = keyof typeof SUSPENSION_DURATIONS;

export const ROLE_LABELS: Record<string, string> = {
  user: "Gebruiker",
  moderator: "Moderator",
  admin: "Beheerder",
};

// Pages render on the server, which runs in UTC; the end of a suspension is
// shown in Belgian time.
const endFormat = new Intl.DateTimeFormat("nl-BE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Brussels",
});

/** "tot 21 oktober 2026 om 14:00", or "voor onbepaalde tijd". */
export function suspensionEndLabel(until: string | null): string {
  return until
    ? `tot ${endFormat.format(new Date(until))}`
    : "voor onbepaalde tijd";
}

/** A user as staff see them, from staff_list_users() / staff_get_user(). */
export interface StaffUserRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
  created_at: string;
  role: string;
  is_verified_source: boolean;
  is_suspended: boolean;
  suspended_until: string | null;
  suspension_reason: string | null;
}

export const USER_FILTERS = {
  all: "Iedereen",
  suspended: "Geschorst",
  staff: "Moderatoren en beheerders",
  verified: "Geverifieerd",
} as const;

export type UserFilter = keyof typeof USER_FILTERS;
