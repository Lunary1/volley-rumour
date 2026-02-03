"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createRumourSchema } from "@/lib/schemas";
import {
  successResponse,
  errorResponse,
  extractErrorMessage,
} from "@/lib/response";
import { awardTrustPoints } from "@/app/actions/gamification";
import { TRUST_POINTS_RUMOUR_CONFIRMED } from "@/lib/gamification";

export async function createRumour(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn om een gerucht te plaatsen");
  }

  // Validate input
  const validationResult = createRumourSchema.safeParse({
    title: formData.get("player_name") as string,
    description: formData.get("description") as string,
    category: formData.get("category") as string,
  });

  if (!validationResult.success) {
    const errors = validationResult.error.errors
      .map((e) => e.message)
      .join("; ");
    return errorResponse(errors);
  }

  const rumourData = {
    creator_id: user.id,
    player_name: (formData.get("player_name") as string).trim(),
    from_club_name:
      ((formData.get("from_club") as string) || "").trim() || null,
    to_club_name: (formData.get("to_club") as string).trim(),
    category: validationResult.data.category,
    description: (formData.get("description") as string).trim() || null,
  };

  const { error } = await supabase.from("rumours").insert(rumourData);

  if (error) {
    const message = extractErrorMessage(
      error,
      "Er ging iets mis bij het aanmaken van het gerucht",
    );
    return errorResponse(message);
  }

  revalidatePath("/geruchten");
  revalidatePath("/");
  return successResponse(null);
}

export async function confirmRumour(rumourId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn");
  }

  // Get the rumour
  const { data: rumour, error: rumourError } = await supabase
    .from("rumours")
    .select("*")
    .eq("id", rumourId)
    .single();

  if (rumourError || !rumour) {
    return errorResponse("Gerucht niet gevonden");
  }

  // Create a transfer from the confirmed rumour using admin client to bypass RLS
  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (err) {
    return errorResponse("Administratorfout: kan gerucht niet bevestigen");
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
    const message = extractErrorMessage(
      transferError,
      "Fout bij bevestiging van transfer",
    );
    return errorResponse(message);
  }

  // Update the rumour status
  const { error: updateError } = await supabase
    .from("rumours")
    .update({ status: "confirmed" })
    .eq("id", rumourId);

  if (updateError) {
    return errorResponse("Fout bij bijwerken van gerucht");
  }

  // Award trust points to the creator via gamification action
  if (rumour.creator_id) {
    const result = await awardTrustPoints(
      rumour.creator_id,
      TRUST_POINTS_RUMOUR_CONFIRMED,
    );
    if (!result.success) {
      // Log but don't fail the confirmation
      console.error("[CONFIRM] Trust score error:", result.error);
    }
  }

  revalidatePath("/geruchten");
  revalidatePath("/transfers");
  revalidatePath("/");
  return successResponse(null);
}

export async function getFirstRumourToConfirm() {
  const supabase = await createClient();

  const { data: rumour, error } = await supabase
    .from("rumours")
    .select("id, player_name, from_club_name, to_club_name")
    .eq("status", "rumour")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !rumour) {
    return errorResponse("Geen geruchten beschikbaar om te bevestigen");
  }

  // Confirm it
  return confirmRumour(rumour.id);
}
