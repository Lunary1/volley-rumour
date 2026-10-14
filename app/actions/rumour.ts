"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createRumourSchema, isTransferCategory } from "@/lib/schemas";
import {
  successResponse,
  errorResponse,
  extractErrorMessage,
} from "@/lib/response";

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
    category: formData.get("category") as string,
    lastName: formData.get("lastName") as string,
    firstName: formData.get("firstName") as string,
    gender: (formData.get("gender") as string) || undefined,
    currentClub: formData.get("currentClub") as string,
    currentDivision: (formData.get("currentDivision") as string) || undefined,
    destinationClub: (formData.get("destinationClub") as string) || undefined,
    destinationDivision:
      (formData.get("destinationDivision") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
  });

  if (!validationResult.success) {
    const errors = validationResult.error.errors
      .map((e) => e.message)
      .join("; ");
    return errorResponse(errors);
  }

  const d = validationResult.data;
  const playerName = `${d.firstName} ${d.lastName}`.trim();

  const rumourData = {
    creator_id: user.id,
    player_name: playerName,
    from_club_name: d.currentClub,
    to_club_name: isTransferCategory(d.category)
      ? (d.destinationClub ?? null)
      : null,
    category: d.category,
    description: d.description?.trim() || null,
  };

  const { error } = await supabase.from("rumours").insert(rumourData);

  if (error) {
    const message = extractErrorMessage(
      error,
      "Er ging iets mis bij het aanmaken van het gerucht",
    );
    return errorResponse(message);
  }

  // The rumour starts pending (#65): it only shows on the author's profile
  // until a moderator approves it.
  revalidatePath("/profile");
  return successResponse(null);
}
