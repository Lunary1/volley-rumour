"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { RUMOUR_DIVISIONS, type RumourDivision } from "@/lib/rumours";
import {
  CLUB_NAME_MAX_LENGTH,
  RESOLUTION_NOTE_MAX_LENGTH,
  TRANSFER_CATEGORY_KEYS,
  TRANSFER_NAME_MAX_LENGTH,
  isRetirement,
  sourceUrlSchema,
} from "@/lib/transfers";
import {
  errorResponse,
  successResponse,
  type ActionResponse,
} from "@/lib/response";

// Staff add a transfer that didn't come from a rumour, or correct or remove
// one (#70, J-14). The database functions check staff, validate and write the
// audit log entry in one transaction.

const clubSchema = z
  .string()
  .trim()
  .max(CLUB_NAME_MAX_LENGTH, "De clubnaam is te lang");

const transferSchema = z
  .object({
    playerName: z
      .string()
      .trim()
      .min(2, "Geef de naam van de speler of trainer")
      .max(TRANSFER_NAME_MAX_LENGTH, "De naam is te lang"),
    category: z.enum(TRANSFER_CATEGORY_KEYS, {
      errorMap: () => ({ message: "Kies het soort transfer" }),
    }),
    fromClub: clubSchema,
    toClub: clubSchema,
    division: z
      .enum(
        Object.keys(RUMOUR_DIVISIONS) as [RumourDivision, ...RumourDivision[]],
      )
      .nullable(),
    confirmedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Kies de datum van de bevestiging"),
    sourceUrl: sourceUrlSchema,
  })
  .refine((d) => isRetirement(d.category) || d.toClub.length > 0, {
    message: "Geef de nieuwe club",
    path: ["toClub"],
  });

export type TransferInput = z.input<typeof transferSchema>;

const transferIdSchema = z.string().uuid("Ongeldige transfer");

function transferError(error: { code?: string }) {
  switch (error.code) {
    case "P0002":
      return errorResponse("Deze transfer bestaat niet meer");
    case "42501":
      return errorResponse("Geen toegang");
    case "22023":
      return errorResponse(
        "Controleer de gegevens: de datum mag niet in de toekomst liggen",
      );
    default:
      return errorResponse("Er ging iets mis. Probeer het opnieuw.");
  }
}

function revalidateTransferPages() {
  revalidatePath("/admin", "layout");
  revalidatePath("/transfers");
  revalidatePath("/geruchten");
  revalidatePath("/");
}

function transferArgs(d: z.output<typeof transferSchema>) {
  return {
    p_player_name: d.playerName,
    p_category: d.category,
    p_from_club: d.fromClub || null,
    p_to_club: isRetirement(d.category) ? null : d.toClub,
    p_division: d.division,
    p_confirmed_on: d.confirmedOn,
    p_source_url: d.sourceUrl,
  };
}

export async function createTransfer(
  input: TransferInput,
): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);

  const { error } = await staff.supabase.rpc(
    "create_transfer",
    transferArgs(parsed.data),
  );
  if (error) return transferError(error);

  revalidateTransferPages();
  return successResponse(null);
}

export async function updateTransfer(
  transferId: string,
  input: TransferInput,
): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const id = transferIdSchema.safeParse(transferId);
  if (!id.success) return errorResponse(id.error.errors[0].message);
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);

  const { error } = await staff.supabase.rpc("update_transfer", {
    p_transfer_id: id.data,
    ...transferArgs(parsed.data),
  });
  if (error) return transferError(error);

  revalidateTransferPages();
  return successResponse(null);
}

const deleteSchema = z.object({
  transferId: transferIdSchema,
  reason: z
    .string()
    .trim()
    .max(
      RESOLUTION_NOTE_MAX_LENGTH,
      `De reden mag maximaal ${RESOLUTION_NOTE_MAX_LENGTH} tekens zijn`,
    )
    .optional(),
});

/**
 * Removes a transfer. If it came from a rumour, the rumour is lopend again so
 * it can be resolved the right way.
 */
export async function deleteTransfer(input: {
  transferId: string;
  reason?: string;
}): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);

  const { error } = await staff.supabase.rpc("delete_transfer", {
    p_transfer_id: parsed.data.transferId,
    p_reason: parsed.data.reason || null,
  });
  if (error) return transferError(error);

  revalidateTransferPages();
  revalidatePath("/profile");
  return successResponse(null);
}
