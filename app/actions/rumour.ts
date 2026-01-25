"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createRumour(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je moet ingelogd zijn om een gerucht te plaatsen" };
  }

  const rumourData = {
    creator_id: user.id,
    player_name: formData.get("player_name") as string,
    from_club_name: (formData.get("from_club") as string) || null,
    to_club_name: formData.get("to_club") as string,
    category: formData.get("category") as string,
    description: (formData.get("description") as string) || null,
  };

  const { error } = await supabase.from("rumours").insert(rumourData);

  if (error) {
    return { error: "Er ging iets mis bij het aanmaken van het gerucht" };
  }

  revalidatePath("/geruchten");
  revalidatePath("/");
  return { success: true };
}

export async function confirmRumour(rumourId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je moet ingelogd zijn" };
  }

  // Get the rumour
  const { data: rumour } = await supabase
    .from("rumours")
    .select("*")
    .eq("id", rumourId)
    .single();

  if (!rumour) {
    return { error: "Gerucht niet gevonden" };
  }

  // Create a transfer from the confirmed rumour using admin client to bypass RLS
  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (err) {
    console.error("[CONFIRM] Admin client error:", err);
    // Fallback: try with regular authenticated client
    adminClient = supabase;
  }

  // Map rumour category to transfer category
  const categoryMap: Record<string, string> = {
    transfer: "player_male",
    trainer_transfer: "trainer_male",
    player_retirement: "player_retirement",
    trainer_retirement: "trainer_retirement",
  };

  const { error: transferError } = await adminClient.from("transfers").insert({
    player_name: rumour.player_name,
    from_club: rumour.from_club_name,
    to_club: rumour.to_club_name,
    category: categoryMap[rumour.category] || "player_male",
    confirmed_at: new Date().toISOString(),
    source_rumour_id: rumour.id,
  });

  if (transferError) {
    console.error("[CONFIRM] Transfer insert error:", transferError);
    return { error: `Transfer error: ${transferError.message}` };
  }

  // Update the rumour status
  await supabase
    .from("rumours")
    .update({ status: "confirmed" })
    .eq("id", rumourId);

  // Award trust points to the creator
  if (rumour.creator_id) {
    await supabase.rpc("increment_trust_score", {
      profile_uuid: rumour.creator_id,
      points_to_add: 5,
    });
  }

  revalidatePath("/geruchten");
  revalidatePath("/transfers");
  revalidatePath("/");
  return { success: true };
}

export async function getFirstRumourToConfirm() {
  const supabase = await createClient();

  const { data: rumour } = await supabase
    .from("rumours")
    .select("id, player_name, from_club_name, to_club_name")
    .eq("status", "rumour")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!rumour) {
    return { error: "Geen geruchten beschikbaar om te bevestigen" };
  }

  // Confirm it
  return confirmRumour(rumour.id);
}
