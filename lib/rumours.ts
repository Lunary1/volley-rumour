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
