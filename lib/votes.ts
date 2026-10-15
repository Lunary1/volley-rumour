import { createClient } from "@/lib/supabase/server";

export type VoteType = "up" | "down";

/**
 * The logged-in user's votes on the given rumours, in one query (#129).
 * Pages pass these to their RumourCards, so the cards don't each call a
 * server action on mount: Next.js runs those one at a time, and every other
 * action the user takes waits behind them. Empty for visitors.
 */
export async function getUserVotes(
  rumourIds: string[],
): Promise<Record<string, VoteType>> {
  if (rumourIds.length === 0) return {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from("rumour_votes")
    .select("rumour_id, vote_type")
    .eq("user_id", user.id)
    .in("rumour_id", rumourIds);
  if (error) {
    console.error("[VOTES] Failed to load the user's votes:", error);
    return {};
  }

  // vote_type is boolean: true = "up", false = "down"
  return Object.fromEntries(
    (data ?? []).map((vote) => [
      vote.rumour_id,
      vote.vote_type === true ? "up" : "down",
    ]),
  );
}
