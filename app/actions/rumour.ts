"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createRumour(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "Je moet ingelogd zijn om een gerucht te plaatsen" }
  }

  const rumourData = {
    created_by: user.id,
    player_name: formData.get("player_name") as string,
    from_club: formData.get("from_club") as string || null,
    to_club: formData.get("to_club") as string,
    transfer_type: formData.get("transfer_type") as string,
    gender: formData.get("gender") as string,
    description: formData.get("description") as string || null,
    source_url: formData.get("source_url") as string || null,
    status: "pending",
    upvotes: 0,
    downvotes: 0,
  }

  const { error } = await supabase
    .from("rumours")
    .insert(rumourData)

  if (error) {
    return { error: "Er ging iets mis bij het aanmaken van het gerucht" }
  }

  revalidatePath("/geruchten")
  revalidatePath("/")
  return { success: true }
}

export async function confirmRumour(rumourId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: "Je moet ingelogd zijn" }
  }

  // Get the rumour
  const { data: rumour } = await supabase
    .from("rumours")
    .select("*")
    .eq("id", rumourId)
    .single()

  if (!rumour) {
    return { error: "Gerucht niet gevonden" }
  }

  // Create a transfer from the confirmed rumour
  const { error: transferError } = await supabase
    .from("transfers")
    .insert({
      player_name: rumour.player_name,
      from_club: rumour.from_club,
      to_club: rumour.to_club,
      transfer_type: rumour.transfer_type,
      gender: rumour.gender,
      confirmed_by: user.id,
      rumour_id: rumour.id,
    })

  if (transferError) {
    return { error: "Kon transfer niet aanmaken" }
  }

  // Update the rumour status
  await supabase
    .from("rumours")
    .update({ status: "confirmed" })
    .eq("id", rumourId)

  // Award trust points to the creator
  if (rumour.created_by) {
    await supabase.rpc("increment_trust_score", { 
      user_id: rumour.created_by, 
      amount: 5 
    })
  }

  revalidatePath("/geruchten")
  revalidatePath("/transfers")
  revalidatePath("/")
  return { success: true }
}
