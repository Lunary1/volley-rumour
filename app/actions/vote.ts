"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function voteOnRumour(rumourId: string, voteType: "up" | "down") {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "Je moet ingelogd zijn om te stemmen" }
  }

  // Check if user already voted
  const { data: existingVote } = await supabase
    .from("rumour_votes")
    .select("*")
    .eq("rumour_id", rumourId)
    .eq("user_id", user.id)
    .single()

  if (existingVote) {
    if (existingVote.vote_type === voteType) {
      return { error: "Je hebt al gestemd" }
    }
    
    // Update vote
    await supabase
      .from("rumour_votes")
      .update({ vote_type: voteType })
      .eq("id", existingVote.id)

    // Update rumour counts
    if (voteType === "up") {
      await supabase.rpc("increment_upvotes_decrement_downvotes", { rumour_id: rumourId })
    } else {
      await supabase.rpc("increment_downvotes_decrement_upvotes", { rumour_id: rumourId })
    }
  } else {
    // Create new vote
    await supabase
      .from("rumour_votes")
      .insert({
        rumour_id: rumourId,
        user_id: user.id,
        vote_type: voteType,
      })

    // Update rumour counts
    const column = voteType === "up" ? "upvotes" : "downvotes"
    await supabase.rpc("increment_vote_count", { rumour_id: rumourId, column_name: column })
  }

  // Award points to rumour author
  const { data: rumour } = await supabase
    .from("rumours")
    .select("author_id")
    .eq("id", rumourId)
    .single()

  if (rumour && voteType === "up") {
    await supabase.rpc("increment_trust_score", { user_id: rumour.author_id, points: 1 })
  }

  revalidatePath("/geruchten", "max")
  revalidatePath("/", "max")
  
  return { success: true }
}
