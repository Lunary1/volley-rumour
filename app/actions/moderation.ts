"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import {
  REJECTION_NOTE_MAX_LENGTH,
  REJECTION_REASONS,
  type RejectionReason,
} from "@/lib/rumours";
import {
  errorResponse,
  successResponse,
  type ActionResponse,
} from "@/lib/response";

// Approving and rejecting rumours (#66). The database functions check staff,
// change the status and write the audit log entry in one transaction; these
// actions check staff first and translate the outcome.

const rumourIdSchema = z.string().uuid("Ongeldig gerucht");

const rejectSchema = z
  .object({
    rumourId: rumourIdSchema,
    reason: z.enum(
      Object.keys(REJECTION_REASONS) as [RejectionReason, ...RejectionReason[]],
      { errorMap: () => ({ message: "Kies een reden" }) },
    ),
    note: z
      .string()
      .trim()
      .max(
        REJECTION_NOTE_MAX_LENGTH,
        `De toelichting mag maximaal ${REJECTION_NOTE_MAX_LENGTH} tekens zijn`,
      )
      .optional(),
  })
  .refine((d) => d.reason !== "other" || !!d.note, {
    message: "Geef een toelichting bij 'Andere'",
  });

function moderationError(error: { code?: string }) {
  switch (error.code) {
    case "P0002":
      return errorResponse("Dit gerucht is al behandeld of bestaat niet meer");
    case "42501":
      return errorResponse("Geen toegang");
    case "22023":
      return errorResponse("Ongeldige reden");
    default:
      return errorResponse("Er ging iets mis. Probeer het opnieuw.");
  }
}

function revalidateRumourPages() {
  revalidatePath("/admin", "layout");
  revalidatePath("/geruchten");
  revalidatePath("/");
  revalidatePath("/profile");
}

export async function approveRumour(
  rumourId: string,
): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = rumourIdSchema.safeParse(rumourId);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);

  const { error } = await staff.supabase.rpc("approve_rumour", {
    p_rumour_id: parsed.data,
  });
  if (error) return moderationError(error);

  revalidateRumourPages();
  return successResponse(null);
}

export async function rejectRumour(input: {
  rumourId: string;
  reason: string;
  note?: string;
}): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);

  const { error } = await staff.supabase.rpc("reject_rumour", {
    p_rumour_id: parsed.data.rumourId,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note || null,
  });
  if (error) return moderationError(error);

  revalidateRumourPages();
  return successResponse(null);
}
