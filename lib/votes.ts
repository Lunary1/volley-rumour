import { createClient } from "@/lib/supabase/server";
import type { VoteType } from "@/lib/rumours";

export type UserVotes = {
  /** null for visitors: their cards prompt them to log in (#78). */
  userId: string | null;
  votes: Record<string, VoteType>;
};

/**
 * Who is looking, and their votes on the given rumours, in one query (#129).
 * Pages pass these to their RumourCards, so the cards don't each call a
 * server action on mount: Next.js runs those one at a time, and every other
 * action the user takes waits behind them. The cards also need the user to
 * close voting on the user's own rumours (#78).
 */
export async function getUserVotes(rumourIds: string[]): Promise<UserVotes> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, votes: {} };
  if (rumourIds.length === 0) return { userId: user.id, votes: {} };

  const { data, error } = await supabase
    .from("rumour_votes")
    .select("rumour_id, vote_type")
    .eq("user_id", user.id)
    .in("rumour_id", rumourIds);
  if (error) {
    console.error("[VOTES] Failed to load the user's votes:", error);
    return { userId: user.id, votes: {} };
  }

  // vote_type is boolean: true = "up", false = "down"
  return {
    userId: user.id,
    votes: Object.fromEntries(
      (data ?? []).map((vote) => [
        vote.rumour_id,
        vote.vote_type === true ? "up" : "down",
      ]),
    ),
  };
}
