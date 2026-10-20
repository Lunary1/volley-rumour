"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import {
  CONTACT_CATEGORIES,
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_MESSAGE_MIN_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_NOTE_MAX_LENGTH,
  type ContactCategory,
} from "@/lib/contact";
import { dailyIpHash } from "@/lib/ip-hash";
import { notifyStaff } from "@/lib/notifications";
import { requireStaff } from "@/lib/staff";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  errorResponse,
  successResponse,
  type ActionResponse,
} from "@/lib/response";

// The contact form (#81, D-017). Anyone can send a message, logged in or not,
// suspended users included: it is how they appeal (D-016). Staff read the
// messages at /admin/contact and mark them handled; the database function
// writes the audit log entry.

const messageSchema = z.object({
  category: z.enum(
    Object.keys(CONTACT_CATEGORIES) as [ContactCategory, ...ContactCategory[]],
    { errorMap: () => ({ message: "Kies een onderwerp" }) },
  ),
  name: z
    .string()
    .trim()
    .min(2, "Vul je naam in")
    .max(
      CONTACT_NAME_MAX_LENGTH,
      `Je naam mag maximaal ${CONTACT_NAME_MAX_LENGTH} tekens zijn`,
    ),
  email: z
    .string()
    .trim()
    .max(CONTACT_EMAIL_MAX_LENGTH, "Dit e-mailadres is te lang")
    .email("Vul een geldig e-mailadres in"),
  message: z
    .string()
    .trim()
    .min(
      CONTACT_MESSAGE_MIN_LENGTH,
      `Je bericht moet minstens ${CONTACT_MESSAGE_MIN_LENGTH} tekens zijn`,
    )
    .max(
      CONTACT_MESSAGE_MAX_LENGTH,
      `Je bericht mag maximaal ${CONTACT_MESSAGE_MAX_LENGTH} tekens zijn`,
    ),
  // Honeypot: hidden from people, filled in by bots.
  website: z.string().optional(),
});

export type ContactMessageInput = z.input<typeof messageSchema>;

export async function submitContactMessage(
  input: ContactMessageInput,
): Promise<ActionResponse<null>> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);
  const { category, name, email, message, website } = parsed.data;
  if (website) return errorResponse("Je bericht kon niet verstuurd worden.");

  // The account comes from the session, never from the form.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Service role: the message carries the server-side IP hash and account,
  // so visitors can't call the function themselves. It applies the limits.
  const admin = createAdminClient();
  const { error } = await admin.rpc("submit_contact_message", {
    p_category: category,
    p_name: name,
    p_email: email,
    p_message: message,
    p_user_id: user?.id ?? null,
    p_ip_hash: await dailyIpHash(),
  });
  if (error) {
    if (error.code === "VR002") {
      return errorResponse(
        "Je hebt vandaag al te veel berichten verstuurd. Probeer het morgen opnieuw.",
      );
    }
    console.error("submit_contact_message failed:", error.code);
    return errorResponse("Er ging iets mis. Probeer het opnieuw.");
  }

  revalidatePath("/admin", "layout");
  after(() => notifyStaff("contact"));
  return successResponse(null);
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

const handleSchema = z.object({
  messageId: z.string().uuid("Ongeldig bericht"),
  note: z
    .string()
    .trim()
    .max(
      CONTACT_NOTE_MAX_LENGTH,
      `De notitie mag maximaal ${CONTACT_NOTE_MAX_LENGTH} tekens zijn`,
    )
    .optional(),
});

export async function handleContactMessage(input: {
  messageId: string;
  note?: string;
}): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = handleSchema.safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);

  const { error } = await staff.supabase.rpc("handle_contact_message", {
    p_message_id: parsed.data.messageId,
    p_note: parsed.data.note || null,
  });
  if (error) {
    switch (error.code) {
      case "P0002":
        return errorResponse(
          "Dit bericht is al afgehandeld of bestaat niet meer",
        );
      case "42501":
        return errorResponse("Geen toegang");
      default:
        console.error("handle_contact_message failed:", error.code);
        return errorResponse("Er ging iets mis. Probeer het opnieuw.");
    }
  }

  revalidatePath("/admin", "layout");
  return successResponse(null);
}
