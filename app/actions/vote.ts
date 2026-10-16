"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { SUSPENDED_ERROR_CODE, SUSPENDED_MESSAGE } from "@/lib/sanctions";
import {
  type ActionResponse,
  errorResponse,
  successResponse,
} from "@/lib/response";
import {
  LOGIN_TO_VOTE_MESSAGE,
  OWN_RUMOUR_ERROR_CODE,
  OWN_RUMOUR_MESSAGE,
  VOTING_CLOSED_ERROR_CODE,
  VOTING_CLOSED_MESSAGE,
  type VoteType,
} from "@/lib/rumours";

export type VoteCounts = { votes_true: number; votes_false: number };

const voteSchema = z.object({
  rumourId: z.string().uuid(),
  voteType: z.enum(["up", "down"]),
});

/** A vote the database refused, in Dutch (#78). */
function voteError(error: { code?: string }) {
  switch (error.code) {
    case SUSPENDED_ERROR_CODE:
      return errorResponse(SUSPENDED_MESSAGE);
    case OWN_RUMOUR_ERROR_CODE:
      return errorResponse(OWN_RUMOUR_MESSAGE);
    case VOTING_CLOSED_ERROR_CODE:
      return errorResponse(VOTING_CLOSED_MESSAGE);
  }
  console.error("[VOTE_ERROR] Failed to save vote:", error);
  return errorResponse("Je stem kon niet opgeslagen worden");
}

/**
 * Casts or changes the user's vote. The database decides who may vote and
 * keeps the counts (#78): the `check_vote_allowed` trigger refuses votes on
 * your own rumour and on closed ones, and `on_vote_change` recounts.
 */
export async function voteOnRumour(
  rumourId: string,
  voteType: VoteType,
): Promise<ActionResponse<VoteCounts>> {
  const parsed = voteSchema.safeParse({ rumourId, voteType });
  if (!parsed.success) return errorResponse("Ongeldige stem");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse(LOGIN_TO_VOTE_MESSAGE);

  // vote_type is boolean: true = "up", false = "down". One vote per user per
  // rumour: if the insert hits that, change the existing vote. (An upsert
  // would also write rumour_id and user_id, which users may not update.)
  const vote_type = parsed.data.voteType === "up";
  let { error } = await supabase.from("rumour_votes").insert({
    rumour_id: parsed.data.rumourId,
    user_id: user.id,
    vote_type,
  });
  if (error?.code === "23505") {
    ({ error } = await supabase
      .from("rumour_votes")
      .update({ vote_type })
      .eq("rumour_id", parsed.data.rumourId)
      .eq("user_id", user.id));
  }
  if (error) return voteError(error);

  const { data: counts, error: countsError } = await supabase
    .from("rumours")
    .select("votes_true, votes_false")
    .eq("id", parsed.data.rumourId)
    .single();
  if (countsError || !counts) return voteError(countsError ?? {});

  revalidatePath("/geruchten", "layout");
  revalidatePath("/");

  return successResponse({
    votes_true: counts.votes_true ?? 0,
    votes_false: counts.votes_false ?? 0,
  });
}
