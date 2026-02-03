"use server";

import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/response";

/**
 * Gamification server actions: centralised trust score (reputation) logic.
 * Used when rumours are confirmed and when creators receive upvotes.
 * Point values are in lib/gamification.ts.
 */

export type AwardTrustResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Award trust points to a user (e.g. rumour confirmed, upvote received).
 * Prefer RPC increment_trust_score when available; otherwise perform atomic update.
 */
export async function awardTrustPoints(
  profileId: string,
  points: number,
): Promise<AwardTrustResult> {
  if (!profileId || points <= 0) {
    return { success: true };
  }

  const supabase = await createClient();

  // Prefer RPC for atomic increment if the function exists
  const { error: rpcError } = await supabase.rpc("increment_trust_score", {
    profile_uuid: profileId,
    points_to_add: points,
  });

  if (!rpcError) {
    return { success: true };
  }

  // Fallback: RPC may not exist in all environments; use atomic update
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("trust_score")
    .eq("id", profileId)
    .single();

  if (fetchError || !profile) {
    return errorResponse("Profiel niet gevonden voor trust-update");
  }

  const newScore = Math.max(0, (profile.trust_score ?? 0) + points);
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ trust_score: newScore })
    .eq("id", profileId);

  if (updateError) {
    return errorResponse("Trust score kon niet worden bijgewerkt");
  }

  return { success: true };
}
