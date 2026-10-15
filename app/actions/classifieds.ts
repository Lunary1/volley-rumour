"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createClassifiedSchema } from "@/lib/schemas";
import {
  successResponse,
  errorResponse,
  type ActionResponse,
} from "@/lib/response";
import { SUSPENDED_ERROR_CODE, SUSPENDED_MESSAGE } from "@/lib/sanctions";
import {
  POSITION_LABELS,
  isPersonAd,
  isPlayerAd,
} from "@/lib/classifieds-utils";

/** A form field, or undefined when it's missing or empty. */
function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value : undefined;
}

/** Posts a zoekertje for the logged-in user (#71, J-04, J-08). */
export async function createClassified(
  formData: FormData,
): Promise<ActionResponse<{ id: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn om een zoekertje te plaatsen");
  }

  const validationResult = createClassifiedSchema.safeParse({
    type: field(formData, "type"),
    firstName: field(formData, "firstName"),
    lastName: field(formData, "lastName"),
    teamName: field(formData, "teamName"),
    club: field(formData, "club"),
    gender: field(formData, "gender"),
    position: field(formData, "position"),
    diploma: field(formData, "diploma"),
    division: field(formData, "division"),
    province: field(formData, "province"),
    description: field(formData, "description"),
  });

  if (!validationResult.success) {
    const errors = validationResult.error.errors
      .map((e) => e.message)
      .join("; ");
    return errorResponse(errors);
  }

  const d = validationResult.data;
  const isPerson = isPersonAd(d.type);
  const personName = `${d.firstName} ${d.lastName}`;
  const teamName = d.teamName ?? "";

  // A person's ad carries their name; a team's says what it is looking for.
  let title = personName;
  if (d.type === "team_seeks_player" && d.position) {
    title = `${teamName} zoekt een ${POSITION_LABELS[d.position].toLowerCase()}`;
  } else if (d.type === "team_seeks_trainer") {
    title = `${teamName} zoekt een trainer`;
  }

  const { data, error } = await supabase
    .from("classifieds")
    .insert({
      user_id: user.id,
      type: d.type,
      title,
      description: d.description || null,
      contact_name: isPerson ? personName : teamName,
      // A person's current club, or the team itself.
      team_name: isPerson ? (d.club ?? null) : teamName,
      position: isPlayerAd(d.type) ? (d.position ?? null) : null,
      trainer_diploma: isPlayerAd(d.type) ? null : (d.diploma ?? null),
      gender: d.gender,
      division: d.division,
      province: d.province,
      is_active: true,
    })
    .select("id")
    .single();

  // Suspended users can't post (#80). Other database errors are in English,
  // so the user gets a general message instead.
  if (error?.code === SUSPENDED_ERROR_CODE) {
    return errorResponse(SUSPENDED_MESSAGE);
  }
  if (error || !data) {
    console.error("Error creating classified:", error);
    return errorResponse("Er ging iets mis bij het plaatsen van je zoekertje");
  }

  revalidatePath("/zoekertjes");
  revalidatePath("/profile");
  return successResponse({ id: data.id });
}
