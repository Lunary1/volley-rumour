"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getRumourData(rumourId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("rumours")
    .select(
      "votes_true, votes_false, creator_id, creator:creator_id(username, trust_score)",
    )
    .eq("id", rumourId)
    .single();

  if (!data) {
    return null;
  }

  return {
    votes_true: data.votes_true,
    votes_false: data.votes_false,
    creator: data.creator,
  };
}

export async function getUserVoteOnRumour(rumourId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("rumour_votes")
    .select("vote_type")
    .eq("rumour_id", rumourId)
    .eq("user_id", user.id)
    .single();

  // vote_type is boolean: true = "up", false = "down"
  if (!data) return null;
  return data.vote_type === true ? "up" : "down";
}

export async function voteOnRumour(rumourId: string, voteType: "up" | "down") {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je moet ingelogd zijn om te stemmen" };
  }

  // Check if user already voted
  const { data: existingVote } = await supabase
    .from("rumour_votes")
    .select("*")
    .eq("rumour_id", rumourId)
    .eq("user_id", user.id)
    .single();

  // Get current rumour vote counts
  const { data: rumour } = await supabase
    .from("rumours")
    .select("votes_true, votes_false, creator_id")
    .eq("id", rumourId)
    .single();

  if (!rumour) {
    return { error: "Gerucht niet gevonden" };
  }

  if (existingVote) {
    // existingVote.vote_type is boolean: true = "up", false = "down"
    const existingVoteType = existingVote.vote_type === true ? "up" : "down";

    if (existingVoteType === voteType) {
      return { error: "Je hebt al op deze optie gestemd" };
    }

    // Update vote type (convert to boolean: true = up, false = down)
    const isUpvote = voteType === "up";
    await supabase
      .from("rumour_votes")
      .update({ vote_type: isUpvote })
      .eq("id", existingVote.id);
  } else {
    // Create new vote record (convert to boolean: true = up, false = down)
    const isUpvote = voteType === "up";
    const { error: insertError } = await supabase.from("rumour_votes").insert({
      rumour_id: rumourId,
      user_id: user.id,
      vote_type: isUpvote,
    });

    if (insertError) {
      console.error("[VOTE_ERROR] Failed to insert vote:", insertError);
      return { error: `Fout bij opslaan van stem: ${insertError.message}` };
    }
  }

  // The on_vote_change trigger recounts votes_true/votes_false (and the
  // creator's trust score) in the database; read the fresh counts back.
  const { data: counts } = await supabase
    .from("rumours")
    .select("votes_true, votes_false")
    .eq("id", rumourId)
    .single();

  const newVotesTrue = counts?.votes_true ?? rumour.votes_true;
  const newVotesFalse = counts?.votes_false ?? rumour.votes_false;

  revalidatePath("/geruchten", "layout");

  return {
    success: true,
    votes_true: newVotesTrue,
    votes_false: newVotesFalse,
  };
}
