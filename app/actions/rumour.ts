"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createRumourSchema,
  isPlayerCategory,
  isTransferCategory,
} from "@/lib/schemas";
import {
  successResponse,
  errorResponse,
  extractErrorMessage,
} from "@/lib/response";
import {
  EDIT_CLOSED_MESSAGE,
  PENDING_LIMIT_MESSAGE,
  WITHDRAW_CLOSED_ERROR_CODE,
  WITHDRAW_CLOSED_MESSAGE,
} from "@/lib/rumours";
import { expirePublicData } from "@/lib/public-data";

/** SQLSTATE raised by check_new_rumour() when the pending cap is reached. */
const PENDING_LIMIT_ERROR_CODE = "VR001";

const rumourIdSchema = z.string().uuid("Ongeldig gerucht");

/**
 * The rumour form as columns, with every check from submission (#67, D-003).
 * Creating and editing (#192) share it.
 */
function parseRumourForm(formData: FormData) {
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
    sourceType: (formData.get("sourceType") as string) || undefined,
    sourceUrl: (formData.get("sourceUrl") as string)?.trim() || undefined,
    // Unticked checkboxes aren't sent at all.
    declaredRules: formData.get("declaredRules") === "on",
  });

  if (!validationResult.success) {
    return {
      ok: false,
      error: validationResult.error.errors.map((e) => e.message).join("; "),
    } as const;
  }

  const d = validationResult.data;
  const isTransfer = isTransferCategory(d.category);

  return {
    ok: true,
    data: {
      player_name: `${d.firstName} ${d.lastName}`.trim(),
      from_club_name: d.currentClub,
      to_club_name: isTransfer ? (d.destinationClub ?? null) : null,
      category: d.category,
      description: d.description?.trim() || null,
      gender: isPlayerCategory(d.category) ? (d.gender ?? null) : null,
      from_division: d.currentDivision ?? null,
      to_division: isTransfer ? (d.destinationDivision ?? null) : null,
      source_type: d.sourceType,
      source_url: d.sourceUrl ?? null,
      // One checkbox covers both rules, seniors only and good faith (D-052).
      declared_good_faith: d.declaredRules,
      declared_senior: d.declaredRules,
    },
  } as const;
}

export async function createRumour(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn om een gerucht te plaatsen");
  }

  const parsed = parseRumourForm(formData);
  if (!parsed.ok) return errorResponse(parsed.error);

  const { error } = await supabase
    .from("rumours")
    .insert({ creator_id: user.id, ...parsed.data });

  // check_new_rumour() refuses a rumour over the pending cap (#54).
  if (error?.code === PENDING_LIMIT_ERROR_CODE) {
    return errorResponse(PENDING_LIMIT_MESSAGE);
  }

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

/**
 * The author edits their rumour while it is pending (#192, D-042). The
 * UPDATE policy limits it to their own pending rumours, so a rumour a
 * moderator approved in the meantime changes no row.
 */
export async function updateRumour(id: string, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn om een gerucht te bewerken");
  }

  if (!rumourIdSchema.safeParse(id).success) {
    return errorResponse("Ongeldig gerucht");
  }

  const parsed = parseRumourForm(formData);
  if (!parsed.ok) return errorResponse(parsed.error);

  const { data, error } = await supabase
    .from("rumours")
    .update(parsed.data)
    .eq("id", id)
    .eq("creator_id", user.id)
    .select("id");

  if (error) {
    return errorResponse(
      extractErrorMessage(
        error,
        "Er ging iets mis bij het bewerken van het gerucht",
      ),
    );
  }
  if (!data?.length) return errorResponse(EDIT_CLOSED_MESSAGE);

  revalidatePath("/profile");
  revalidatePath("/admin", "layout");
  return successResponse(null);
}

/**
 * The author withdraws their pending or lopend rumour (#192, D-042). It
 * disappears from the site; open reports and takedown requests about it stay
 * with the moderators. Allowed while suspended: it only removes content.
 */
export async function withdrawRumour(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn om een gerucht in te trekken");
  }

  if (!rumourIdSchema.safeParse(id).success) {
    return errorResponse("Ongeldig gerucht");
  }

  const { error } = await supabase.rpc("withdraw_rumour", {
    p_rumour_id: id,
  });

  if (error?.code === WITHDRAW_CLOSED_ERROR_CODE) {
    return errorResponse(WITHDRAW_CLOSED_MESSAGE);
  }
  if (error?.code === "P0002") {
    return errorResponse("Dit gerucht werd niet gevonden");
  }
  if (error) {
    return errorResponse(
      extractErrorMessage(
        error,
        "Er ging iets mis bij het intrekken van het gerucht",
      ),
    );
  }

  // A lopend rumour leaves Transfer Talk, the homepage and their counts.
  expirePublicData("rumours");
  revalidatePath("/geruchten");
  revalidatePath(`/geruchten/${id}`);
  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/admin", "layout");
  return successResponse(null);
}
