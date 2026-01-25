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

  let newVotesTrue = rumour.votes_true;
  let newVotesFalse = rumour.votes_false;

  if (existingVote) {
    // existingVote.vote_type is boolean: true = "up", false = "down"
    const existingVoteType = existingVote.vote_type === true ? "up" : "down";

    if (existingVoteType === voteType) {
      return { error: "Je hebt al op deze optie gestemd" };
    }

    // Change existing vote - adjust counts
    if (existingVote.vote_type === true) {
      newVotesTrue = Math.max(0, newVotesTrue - 1);
    } else {
      newVotesFalse = Math.max(0, newVotesFalse - 1);
    }

    // Add new vote
    if (voteType === "up") {
      newVotesTrue += 1;
    } else {
      newVotesFalse += 1;
    }

    // Update vote type (convert to boolean: true = up, false = down)
    const isUpvote = voteType === "up";
    await supabase
      .from("rumour_votes")
      .update({ vote_type: isUpvote })
      .eq("id", existingVote.id);
  } else {
    // New vote - just increment the appropriate count
    if (voteType === "up") {
      newVotesTrue += 1;
    } else {
      newVotesFalse += 1;
    }

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

  // Update rumour vote counts
  const { error: updateError } = await supabase
    .from("rumours")
    .update({
      votes_true: newVotesTrue,
      votes_false: newVotesFalse,
    })
    .eq("id", rumourId);

  if (updateError) {
    return { error: "Fout bij bijwerken van stemmen" };
  }

  // Award/deduct points to rumour creator (only for upvotes)
  if (rumour.creator_id && voteType === "up" && !existingVote) {
    // Get current trust score
    const { data: profile } = await supabase
      .from("profiles")
      .select("trust_score")
      .eq("id", rumour.creator_id)
      .single();

    if (profile) {
      const newScore = (profile.trust_score || 0) + 1;
      await supabase
        .from("profiles")
        .update({ trust_score: newScore })
        .eq("id", rumour.creator_id);
    }
  }

  revalidatePath("/geruchten", "layout");

  return {
    success: true,
    votes_true: newVotesTrue,
    votes_false: newVotesFalse,
  };
}
