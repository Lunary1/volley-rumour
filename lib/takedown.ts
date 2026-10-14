// Takedown requests: the person a rumour is about asks for its removal,
// without an account (#68, J-12, D-014). The rumour stays visible until a
// moderator decides.

/**
 * Who files the request. Keep in sync with the relation check on
 * takedown_requests in the migrations.
 */
export const TAKEDOWN_RELATIONS = {
  self: "Het gerucht gaat over mij",
  parent: "Het gerucht gaat over mijn kind",
  representative: "Ik vertegenwoordig de persoon (bv. als makelaar of club)",
} as const;

export type TakedownRelation = keyof typeof TAKEDOWN_RELATIONS;

/** Short labels for the admin inbox. */
export const TAKEDOWN_RELATION_SHORT_LABELS: Record<TakedownRelation, string> =
  {
    self: "De persoon zelf",
    parent: "Ouder",
    representative: "Vertegenwoordiger",
  };

export type TakedownStatus = "open" | "removed" | "rejected";

/** How a request's status reads for the requester and in the inbox. */
export const TAKEDOWN_STATUS_LABELS: Record<TakedownStatus, string> = {
  open: "In behandeling",
  removed: "Gerucht verwijderd",
  rejected: "Verzoek afgewezen",
};

export const TAKEDOWN_NAME_MAX_LENGTH = 100;
export const TAKEDOWN_EMAIL_MAX_LENGTH = 254;
export const TAKEDOWN_EXPLANATION_MIN_LENGTH = 10;
export const TAKEDOWN_EXPLANATION_MAX_LENGTH = 2000;
export const TAKEDOWN_NOTE_MAX_LENGTH = 500;

/**
 * Requests per day. submit_takedown_request() enforces them; keep the two in
 * sync.
 */
export const TAKEDOWN_LIMITS = { perIp: 5, perEmail: 3 } as const;

/** The status page for a request; the token is its only key. */
export function takedownStatusPath(token: string) {
  return `/verwijderverzoek/status/${token}`;
}
