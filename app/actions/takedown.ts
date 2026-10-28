"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { dailyIpHash } from "@/lib/ip-hash";
import { createAdminClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { expirePublicData } from "@/lib/public-data";
import { notifyStaff, notifyTakedownDecisions } from "@/lib/notifications";
import {
  TAKEDOWN_EMAIL_MAX_LENGTH,
  TAKEDOWN_EXPLANATION_MAX_LENGTH,
  TAKEDOWN_EXPLANATION_MIN_LENGTH,
  TAKEDOWN_NAME_MAX_LENGTH,
  TAKEDOWN_NOTE_MAX_LENGTH,
  TAKEDOWN_RELATIONS,
  takedownStatusPath,
  type TakedownRelation,
} from "@/lib/takedown";
import {
  errorResponse,
  successResponse,
  type ActionResponse,
} from "@/lib/response";

// Takedown requests (#68, D-014). Anyone can file one, without an account; a
// moderator removes the rumour or rejects the request. The database functions
// do the work and write the audit log entry.

const requestSchema = z.object({
  rumourId: z.string().uuid("Ongeldig gerucht"),
  relation: z.enum(
    Object.keys(TAKEDOWN_RELATIONS) as [
      TakedownRelation,
      ...TakedownRelation[],
    ],
    { error: "Kies wie het verzoek doet" },
  ),
  name: z
    .string()
    .trim()
    .min(2, "Vul je naam in")
    .max(
      TAKEDOWN_NAME_MAX_LENGTH,
      `Je naam mag maximaal ${TAKEDOWN_NAME_MAX_LENGTH} tekens zijn`,
    ),
  email: z
    .string()
    .trim()
    .max(TAKEDOWN_EMAIL_MAX_LENGTH, "Dit e-mailadres is te lang")
    .email("Vul een geldig e-mailadres in"),
  explanation: z
    .string()
    .trim()
    .min(
      TAKEDOWN_EXPLANATION_MIN_LENGTH,
      `Leg in minstens ${TAKEDOWN_EXPLANATION_MIN_LENGTH} tekens uit waarom het gerucht weg moet`,
    )
    .max(
      TAKEDOWN_EXPLANATION_MAX_LENGTH,
      `Je uitleg mag maximaal ${TAKEDOWN_EXPLANATION_MAX_LENGTH} tekens zijn`,
    ),
  // DSA art. 16(2)(d): the requester confirms the notice is made in good
  // faith (#94).
  goodFaith: z.literal(true, {
    error: "Bevestig dat je verzoek juist en volledig is",
  }),
  // Honeypot: hidden from people, filled in by bots.
  website: z.string().optional(),
});

export type TakedownRequestInput = z.input<typeof requestSchema>;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function requestTakedown(
  input: TakedownRequestInput,
): Promise<ActionResponse<{ reference: string; statusPath: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message);
  const { rumourId, relation, name, email, explanation, website } = parsed.data;
  if (website) return errorResponse("Je verzoek kon niet verstuurd worden.");

  // The token is the requester's only key to the status page; the database
  // keeps just its hash.
  const token = randomBytes(32).toString("base64url");

  // Service role: the request carries the server-side IP hash, so visitors
  // can't call the function themselves. It checks the rumour and the limits.
  const admin = createAdminClient();
  const { data: reference, error } = await admin.rpc(
    "submit_takedown_request",
    {
      p_rumour_id: rumourId,
      p_relation: relation,
      p_name: name,
      p_email: email,
      p_explanation: explanation,
      p_token_hash: sha256(token),
      p_ip_hash: await dailyIpHash(),
    },
  );
  if (error) {
    switch (error.code) {
      case "VR002":
        return errorResponse(
          "Je hebt vandaag al te veel verwijderverzoeken verstuurd. Probeer het morgen opnieuw.",
        );
      case "VR003":
        return errorResponse(
          "Je hebt al een verwijderverzoek voor dit gerucht lopen. Volg het via de statuslink die je toen kreeg.",
        );
      case "P0002":
        return errorResponse("Dit gerucht bestaat niet (meer).");
      default:
        console.error("submit_takedown_request failed:", error.code);
        return errorResponse("Er ging iets mis. Probeer het opnieuw.");
    }
  }

  revalidatePath("/admin", "layout");
  after(() => notifyStaff("takedown"));
  return successResponse({
    reference: reference as string,
    statusPath: takedownStatusPath(token),
  });
}

// ---------------------------------------------------------------------------
// Staff decisions
// ---------------------------------------------------------------------------

const decisionSchema = z.object({
  requestId: z.string().uuid("Ongeldig verzoek"),
  note: z
    .string()
    .trim()
    .max(
      TAKEDOWN_NOTE_MAX_LENGTH,
      `De toelichting mag maximaal ${TAKEDOWN_NOTE_MAX_LENGTH} tekens zijn`,
    )
    .optional(),
});

function decisionError(error: { code?: string }) {
  switch (error.code) {
    case "P0002":
      return errorResponse("Dit verzoek is al behandeld of bestaat niet meer");
    case "42501":
      return errorResponse("Geen toegang");
    case "22023":
      return errorResponse("Geef een toelichting voor de aanvrager");
    default:
      return errorResponse("Er ging iets mis. Probeer het opnieuw.");
  }
}

function revalidateTakedownPages() {
  // Removing a rumour also deletes its transfer (#151).
  expirePublicData("rumours", "transfers");
  revalidatePath("/admin", "layout");
  revalidatePath("/geruchten");
  revalidatePath("/transfers");
  revalidatePath("/");
  revalidatePath("/profile");
}

export async function removeRumourForTakedown(input: {
  requestId: string;
  note?: string;
}): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message);

  const { error } = await staff.supabase.rpc("remove_rumour_for_takedown", {
    p_request_id: parsed.data.requestId,
    p_note: parsed.data.note || null,
  });
  if (error) return decisionError(error);

  revalidateTakedownPages();
  after(notifyTakedownDecisions);
  return successResponse(null);
}

export async function rejectTakedownRequest(input: {
  requestId: string;
  note: string;
}): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message);
  if (!parsed.data.note) {
    return errorResponse("Geef een toelichting voor de aanvrager");
  }

  const { error } = await staff.supabase.rpc("reject_takedown_request", {
    p_request_id: parsed.data.requestId,
    p_note: parsed.data.note,
  });
  if (error) return decisionError(error);

  revalidateTakedownPages();
  after(notifyTakedownDecisions);
  return successResponse(null);
}
