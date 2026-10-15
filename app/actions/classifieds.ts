"use server";

import { z } from "zod";
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

const NOT_FOUND = "Zoekertje niet gevonden";

const classifiedIdSchema = z.string().uuid(NOT_FOUND);

/** A form field, or undefined when it's missing or empty. */
function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * Validates the form for an ad of `type` and turns it into the columns both
 * posting and editing write (#71, #72). Returns a Dutch error otherwise.
 */
function parseClassifiedForm(formData: FormData, type: string | undefined) {
  const validationResult = createClassifiedSchema.safeParse({
    type,
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
    return { ok: false, error: errors } as const;
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

  return {
    ok: true,
    type: d.type,
    columns: {
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
    },
  } as const;
}

/**
 * Suspended users can't post or edit (#80). Other database errors are in
 * English, so the user gets a general message instead.
 */
function writeError(
  error: { code?: string } | null,
  context: string,
  message: string,
) {
  if (error?.code === SUSPENDED_ERROR_CODE) {
    return errorResponse(SUSPENDED_MESSAGE);
  }
  console.error(context, error);
  return errorResponse(message);
}

function revalidateClassified(id: string) {
  revalidatePath("/zoekertjes");
  revalidatePath("/zoekertjes/mijn");
  revalidatePath(`/zoekertjes/${id}`);
  revalidatePath("/profile");
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

  const parsed = parseClassifiedForm(formData, field(formData, "type"));
  if (!parsed.ok) return errorResponse(parsed.error);

  const { data, error } = await supabase
    .from("classifieds")
    .insert({
      user_id: user.id,
      type: parsed.type,
      ...parsed.columns,
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return writeError(
      error,
      "Error creating classified:",
      "Er ging iets mis bij het plaatsen van je zoekertje",
    );
  }

  revalidateClassified(data.id);
  return successResponse({ id: data.id });
}

/**
 * Edits the user's own zoekertje with the same validation as posting (#72,
 * J-05). The type stays as it was: owners can't change it in the database.
 * Other people's ads and ads a moderator removed are refused by RLS too.
 */
export async function updateClassified(
  id: string,
  formData: FormData,
): Promise<ActionResponse<{ id: string }>> {
  const parsedId = classifiedIdSchema.safeParse(id);
  if (!parsedId.success) return errorResponse(NOT_FOUND);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn om je zoekertje te bewerken");
  }

  const { data: existing } = await supabase
    .from("classifieds")
    .select("type")
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!existing) return errorResponse(NOT_FOUND);

  const parsed = parseClassifiedForm(formData, existing.type);
  if (!parsed.ok) return errorResponse(parsed.error);

  const { data, error } = await supabase
    .from("classifieds")
    .update({ ...parsed.columns, updated_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return writeError(
      error,
      "Error updating classified:",
      "Er ging iets mis bij het bewaren van je zoekertje",
    );
  }
  if (!data) return errorResponse(NOT_FOUND);

  revalidateClassified(data.id);
  return successResponse({ id: data.id });
}

/**
 * Marks the user's own zoekertje as "gevonden" (`active` false), which takes
 * it out of the list, or puts it back online (#72, J-05, J-08). Conversations
 * about it stay as they are.
 */
export async function setClassifiedActive(
  id: string,
  active: boolean,
): Promise<ActionResponse> {
  const parsedId = classifiedIdSchema.safeParse(id);
  if (!parsedId.success) return errorResponse(NOT_FOUND);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn");
  }

  const { data, error } = await supabase
    .from("classifieds")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return writeError(
      error,
      "Error changing classified status:",
      "Er ging iets mis bij het aanpassen van je zoekertje",
    );
  }
  if (!data) return errorResponse(NOT_FOUND);

  revalidateClassified(data.id);
  return successResponse(undefined);
}

/**
 * Deletes the user's own zoekertje for good (#72, J-05). Conversations about
 * it stay; reports about it go with it (D-015). Suspended users may still
 * delete (D-016).
 */
export async function deleteClassified(id: string): Promise<ActionResponse> {
  const parsedId = classifiedIdSchema.safeParse(id);
  if (!parsedId.success) return errorResponse(NOT_FOUND);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn");
  }

  const { data, error } = await supabase
    .from("classifieds")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return writeError(
      error,
      "Error deleting classified:",
      "Er ging iets mis bij het verwijderen van je zoekertje",
    );
  }
  if (!data) return errorResponse(NOT_FOUND);

  revalidateClassified(data.id);
  return successResponse(undefined);
}
