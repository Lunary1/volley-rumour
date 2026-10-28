"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { expirePublicData } from "@/lib/public-data";
import { notifyRumourDecision } from "@/lib/notifications";
import {
  REJECTION_NOTE_MAX_LENGTH,
  REJECTION_REASONS,
  type RejectionReason,
} from "@/lib/rumours";
import {
  RESOLUTION_NOTE_MAX_LENGTH,
  TRANSFER_CATEGORY_KEYS,
  sourceUrlSchema,
} from "@/lib/transfers";
import {
  errorResponse,
  successResponse,
  type ActionResponse,
} from "@/lib/response";

const noteSchema = z
  .string()
  .trim()
  .max(
    RESOLUTION_NOTE_MAX_LENGTH,
    `De toelichting mag maximaal ${RESOLUTION_NOTE_MAX_LENGTH} tekens zijn`,
  )
  .optional();

// Approving and rejecting rumours (#66). The database functions check staff,
// change the status and write the audit log entry in one transaction; these
// actions check staff first and translate the outcome.

const rumourIdSchema = z.string().uuid("Ongeldig gerucht");

const rejectSchema = z
  .object({
    rumourId: rumourIdSchema,
    reason: z.enum(
      Object.keys(REJECTION_REASONS) as [RejectionReason, ...RejectionReason[]],
      { error: "Kies een reden" },
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
  expirePublicData("rumours");
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
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message);

  const { error } = await staff.supabase.rpc("approve_rumour", {
    p_rumour_id: parsed.data,
  });
  if (error) return moderationError(error);

  after(() => notifyRumourDecision(parsed.data, "approved"));
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
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message);

  const { error } = await staff.supabase.rpc("reject_rumour", {
    p_rumour_id: parsed.data.rumourId,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note || null,
  });
  if (error) return moderationError(error);

  after(() => notifyRumourDecision(parsed.data.rumourId, "rejected"));
  revalidateRumourPages();
  return successResponse(null);
}

// Resolving lopende rumours (#70, D-020). resolve_rumour() checks staff, the
// source and the transfer type, makes the transfer and writes the log entry
// in one transaction; a rumour that isn't lopend any more is refused, so a
// second confirmation never makes a second transfer.

const resolveSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("confirmed"),
    rumourId: rumourIdSchema,
    category: z.enum(TRANSFER_CATEGORY_KEYS, {
      error: "Kies het soort transfer",
    }),
    sourceUrl: sourceUrlSchema,
    note: noteSchema,
  }),
  z.object({
    outcome: z.literal("denied"),
    rumourId: rumourIdSchema,
    sourceUrl: sourceUrlSchema.optional().or(z.literal("")),
    note: noteSchema,
  }),
  z.object({
    outcome: z.literal("expired"),
    rumourId: rumourIdSchema,
    note: noteSchema,
  }),
]);

export type ResolveRumourInput = z.input<typeof resolveSchema>;

function resolutionError(error: { code?: string }) {
  switch (error.code) {
    case "P0002":
      return errorResponse("Dit gerucht is al afgesloten of bestaat niet meer");
    case "42501":
      return errorResponse("Geen toegang");
    case "22023":
      return errorResponse("Controleer de bron en het soort transfer");
    default:
      return errorResponse("Er ging iets mis. Probeer het opnieuw.");
  }
}

export async function resolveRumour(
  input: ResolveRumourInput,
): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message);
  const data = parsed.data;

  const { error } = await staff.supabase.rpc("resolve_rumour", {
    p_rumour_id: data.rumourId,
    p_outcome: data.outcome,
    p_source_url: "sourceUrl" in data ? data.sourceUrl || null : null,
    p_category: "category" in data ? data.category : null,
    p_note: data.note || null,
  });
  if (error) return resolutionError(error);

  revalidateRumourPages();
  expirePublicData("transfers");
  revalidatePath("/transfers");
  return successResponse(null);
}

// Reopening a wrongly denied or expired rumour (#150). reopen_rumour() checks
// staff and the status, makes it lopend and writes the log entry in one
// transaction; the author's track record follows through its trigger.

const reopenSchema = z.object({
  rumourId: rumourIdSchema,
  reason: z
    .string()
    .trim()
    .min(1, "Geef een reden om het gerucht te heropenen")
    .max(
      RESOLUTION_NOTE_MAX_LENGTH,
      `De reden mag maximaal ${RESOLUTION_NOTE_MAX_LENGTH} tekens zijn`,
    ),
});

export async function reopenRumour(input: {
  rumourId: string;
  reason: string;
}): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = reopenSchema.safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message);

  const { error } = await staff.supabase.rpc("reopen_rumour", {
    p_rumour_id: parsed.data.rumourId,
    p_reason: parsed.data.reason,
  });
  if (error) {
    switch (error.code) {
      case "P0002":
        return errorResponse("Dit gerucht is al heropend of bestaat niet meer");
      case "42501":
        return errorResponse("Geen toegang");
      case "22023":
        return errorResponse("Geef een reden van maximaal 500 tekens");
      default:
        return errorResponse("Er ging iets mis. Probeer het opnieuw.");
    }
  }

  revalidateRumourPages();
  return successResponse(null);
}

/** End of a transfer window: every lopend rumour becomes "Niet bevestigd". */
export async function expireOpenRumours(): Promise<ActionResponse<number>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const { data, error } = await staff.supabase.rpc("expire_open_rumours");
  if (error) return resolutionError(error);

  revalidateRumourPages();
  return successResponse(data as number);
}
