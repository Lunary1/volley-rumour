"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import {
  SANCTION_NOTE_MAX_LENGTH,
  SUSPENSION_REASON_MAX_LENGTH,
} from "@/lib/sanctions";
import {
  errorResponse,
  successResponse,
  type ActionResponse,
} from "@/lib/response";

// Suspensions, the verified badge and the moderator role (#80, D-016). Only
// admins may change them; the database functions check that and write the
// audit log entry. These actions validate input and translate the outcome.

const userIdSchema = z.string().uuid("Ongeldige gebruiker");

const noteSchema = z
  .string()
  .trim()
  .max(
    SANCTION_NOTE_MAX_LENGTH,
    `Je notitie mag maximaal ${SANCTION_NOTE_MAX_LENGTH} tekens zijn`,
  )
  .optional();

/**
 * Translates a refused sanction. notAllowed explains VR006 for the action at
 * hand (yourself, staff, an admin's role, a suspended user).
 */
function sanctionError(error: { code?: string }, notAllowed: string) {
  switch (error.code) {
    case "42501":
      return errorResponse("Alleen beheerders kunnen dit doen");
    case "P0002":
      return errorResponse("Deze gebruiker bestaat niet meer");
    case "VR006":
      return errorResponse(notAllowed);
    case "VR007":
      return errorResponse(
        "Er is niets te wijzigen. Iemand anders deed dit misschien al; vernieuw de pagina.",
      );
    case "22023":
      return errorResponse("Controleer de reden en de einddatum");
    default:
      console.error("sanction failed:", error.code);
      return errorResponse("Er ging iets mis. Probeer het opnieuw.");
  }
}

function revalidateUserPages(userId: string) {
  revalidatePath("/admin/gebruikers");
  revalidatePath(`/admin/gebruikers/${userId}`);
  revalidatePath("/admin/logboek");
}

const DAY_MS = 24 * 60 * 60 * 1000;

const suspendSchema = z
  .object({
    userId: userIdSchema,
    duration: z.enum(["7", "30", "date", "indefinite"], {
      errorMap: () => ({ message: "Kies hoe lang de schorsing duurt" }),
    }),
    // For "date": the end as an ISO timestamp, picked in the admin's browser.
    until: z.string().datetime({ offset: true }).optional(),
    reason: z
      .string()
      .trim()
      .min(1, "Geef een reden; de gebruiker ziet ze")
      .max(
        SUSPENSION_REASON_MAX_LENGTH,
        `De reden mag maximaal ${SUSPENSION_REASON_MAX_LENGTH} tekens zijn`,
      ),
  })
  .refine((d) => d.duration !== "date" || d.until !== undefined, {
    message: "Kies een einddatum",
    path: ["until"],
  });

/** Suspends a user (read-only) until a date or indefinitely, with a reason. */
export async function suspendUser(input: {
  userId: string;
  duration: string;
  until?: string;
  reason: string;
}): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = suspendSchema.safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);
  const { userId, duration, reason } = parsed.data;

  let until: Date | null = null;
  if (duration === "date") {
    until = new Date(parsed.data.until!);
    if (until <= new Date()) {
      return errorResponse("Kies een einddatum in de toekomst");
    }
  } else if (duration !== "indefinite") {
    until = new Date(Date.now() + Number(duration) * DAY_MS);
  }

  const { error } = await staff.supabase.rpc("suspend_user", {
    p_user_id: userId,
    p_until: until?.toISOString() ?? null,
    p_reason: reason,
  });
  if (error) {
    return sanctionError(
      error,
      "Moderatoren en beheerders kun je niet schorsen. Neem eerst de moderatorrol af.",
    );
  }

  revalidateUserPages(userId);
  return successResponse(null);
}

/** Ends a running suspension now. */
export async function liftSuspension(input: {
  userId: string;
  note?: string;
}): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = z
    .object({ userId: userIdSchema, note: noteSchema })
    .safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);

  const { error } = await staff.supabase.rpc("lift_suspension", {
    p_user_id: parsed.data.userId,
    p_note: parsed.data.note || null,
  });
  if (error)
    return sanctionError(error, "Deze schorsing kan niet opgeheven worden");

  revalidateUserPages(parsed.data.userId);
  return successResponse(null);
}

/** Grants or revokes the verified badge (D-001). */
export async function setVerifiedSource(input: {
  userId: string;
  verified: boolean;
  note?: string;
}): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = z
    .object({ userId: userIdSchema, verified: z.boolean(), note: noteSchema })
    .safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);

  const { error } = await staff.supabase.rpc("set_verified_source", {
    p_user_id: parsed.data.userId,
    p_verified: parsed.data.verified,
    p_note: parsed.data.note || null,
  });
  if (error) return sanctionError(error, "De badge kan niet gewijzigd worden");

  revalidateUserPages(parsed.data.userId);
  // The badge shows on ads, rumours, Betrouwbare bronnen and the profile.
  revalidatePath("/", "layout");
  return successResponse(null);
}

/** Makes a user a moderator, or takes the role away (D-006). */
export async function setModerator(input: {
  userId: string;
  moderator: boolean;
  note?: string;
}): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = z
    .object({ userId: userIdSchema, moderator: z.boolean(), note: noteSchema })
    .safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);

  const { error } = await staff.supabase.rpc("set_moderator", {
    p_user_id: parsed.data.userId,
    p_moderator: parsed.data.moderator,
    p_note: parsed.data.note || null,
  });
  if (error) {
    return sanctionError(
      error,
      "Dit kan niet: je eigen rol en die van beheerders wijzig je hier niet, en een geschorste gebruiker wordt geen moderator.",
    );
  }

  revalidateUserPages(parsed.data.userId);
  return successResponse(null);
}
