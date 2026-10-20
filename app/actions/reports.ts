"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/staff";
import { expirePublicData } from "@/lib/public-data";
import { notifyStaff, notifyTakedownDecisions } from "@/lib/notifications";
import {
  CONTENT_REPORT_REASONS,
  CONVERSATION_REPORT_REASONS,
  REPORT_EXPLANATION_MAX_LENGTH,
  REPORT_EXPLANATION_MIN_LENGTH,
  REPORT_NOTE_MAX_LENGTH,
} from "@/lib/reports";
import {
  errorResponse,
  successResponse,
  type ActionResponse,
} from "@/lib/response";

// User reports (#69, #79, #87, D-015). Logged-in users report a rumour,
// zoekertje or conversation; moderators remove the content or close the
// report. The database functions check who may do what and write the audit
// log entry; these actions validate input and translate the outcome.

const reportSchema = z
  .object({
    targetType: z.enum(["rumour", "classified", "conversation"]),
    targetId: z.string().uuid("Ongeldige melding"),
    reason: z.string({ required_error: "Kies een reden" }),
    explanation: z
      .string()
      .trim()
      .max(
        REPORT_EXPLANATION_MAX_LENGTH,
        `Je uitleg mag maximaal ${REPORT_EXPLANATION_MAX_LENGTH} tekens zijn`,
      )
      .optional(),
    // Conversations only (#87): block the other participant in the same step.
    block: z.boolean().optional(),
  })
  .refine(
    (d) =>
      Object.hasOwn(
        d.targetType === "conversation"
          ? CONVERSATION_REPORT_REASONS
          : CONTENT_REPORT_REASONS,
        d.reason,
      ),
    { message: "Kies een reden", path: ["reason"] },
  )
  .refine(
    (d) =>
      d.reason !== "other" ||
      (d.explanation?.length ?? 0) >= REPORT_EXPLANATION_MIN_LENGTH,
    {
      message: `Leg in minstens ${REPORT_EXPLANATION_MIN_LENGTH} tekens uit wat er mis is`,
      path: ["explanation"],
    },
  );

export type ReportInput = z.input<typeof reportSchema>;

export async function reportContent(
  input: ReportInput,
): Promise<ActionResponse<{ blocked: boolean }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("Je moet ingelogd zijn om te melden");

  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);
  const { targetType, targetId, reason, explanation, block } = parsed.data;

  const { error } = await supabase.rpc("submit_report", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_explanation: explanation || null,
  });
  if (error) {
    switch (error.code) {
      case "VR002":
        return errorResponse(
          "Je hebt vandaag al veel meldingen gedaan. Probeer het morgen opnieuw.",
        );
      case "VR003":
        return errorResponse(
          "Je hebt dit al gemeld. Een moderator bekijkt je melding.",
        );
      case "VR004":
        return errorResponse("Je kan je eigen bijdrage niet melden.");
      case "P0002":
        return errorResponse("Dit bestaat niet (meer).");
      case "22023":
        return errorResponse("Kies een reden en vul de uitleg aan.");
      default:
        console.error("submit_report failed:", error.code);
        return errorResponse("Er ging iets mis. Probeer het opnieuw.");
    }
  }
  revalidatePath("/admin", "layout");
  after(() => notifyStaff("report"));

  // Blocking is the user's own action, not a moderation step. submit_report
  // already checked that the user takes part in the conversation.
  let blocked = false;
  if (targetType === "conversation" && block) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("initiator_id, recipient_id")
      .eq("id", targetId)
      .single();
    const otherId =
      conversation &&
      (conversation.initiator_id === user.id
        ? conversation.recipient_id
        : conversation.initiator_id);
    if (otherId) {
      const { error: blockError } = await supabase
        .from("blocked_users")
        .insert({ blocker_id: user.id, blocked_id: otherId });
      // 23505: already blocked.
      blocked = !blockError || blockError.code === "23505";
      if (blocked) {
        revalidatePath("/messages");
        revalidatePath(`/messages/${targetId}`);
        revalidatePath("/profile");
      }
    }
  }

  return successResponse({ blocked });
}

// ---------------------------------------------------------------------------
// Staff decisions
// ---------------------------------------------------------------------------

const reportIdSchema = z.string().uuid("Ongeldige melding");

const noteSchema = z
  .string()
  .trim()
  .max(
    REPORT_NOTE_MAX_LENGTH,
    `De toelichting mag maximaal ${REPORT_NOTE_MAX_LENGTH} tekens zijn`,
  )
  .optional();

function decisionError(error: { code?: string }) {
  switch (error.code) {
    case "P0002":
      return errorResponse("Deze melding is al behandeld of bestaat niet meer");
    case "42501":
      return errorResponse("Geen toegang");
    case "22023":
      return errorResponse("Deze beslissing past niet bij deze melding");
    default:
      console.error("report decision failed:", error.code);
      return errorResponse("Er ging iets mis. Probeer het opnieuw.");
  }
}

function revalidateReportPages() {
  // Removing a rumour also deletes its transfer (#151).
  expirePublicData("rumours", "transfers");
  revalidatePath("/admin", "layout");
  revalidatePath("/geruchten");
  revalidatePath("/transfers");
  revalidatePath("/zoekertjes", "layout");
  revalidatePath("/");
  revalidatePath("/profile");
}

export async function removeReportedContent(input: {
  reportId: string;
  note?: string;
}): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = z
    .object({ reportId: reportIdSchema, note: noteSchema })
    .safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);

  const { error } = await staff.supabase.rpc("remove_reported_content", {
    p_report_id: parsed.data.reportId,
    p_note: parsed.data.note || null,
  });
  if (error) return decisionError(error);

  revalidateReportPages();
  // Removing a rumour also decides its open takedown requests.
  after(notifyTakedownDecisions);
  return successResponse(null);
}

export async function closeReport(input: {
  reportId: string;
  outcome: "dismissed" | "action_taken";
  note?: string;
}): Promise<ActionResponse<null>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = z
    .object({
      reportId: reportIdSchema,
      outcome: z.enum(["dismissed", "action_taken"]),
      note: noteSchema,
    })
    .safeParse(input);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);
  if (parsed.data.outcome === "action_taken" && !parsed.data.note) {
    return errorResponse("Beschrijf welke maatregel je nam");
  }

  const { error } = await staff.supabase.rpc("close_report", {
    p_report_id: parsed.data.reportId,
    p_outcome: parsed.data.outcome,
    p_note: parsed.data.note || null,
  });
  if (error) return decisionError(error);

  revalidatePath("/admin", "layout");
  return successResponse(null);
}

export interface ReportedMessage {
  message_id: string;
  sender_id: string;
  sender_username: string | null;
  body: string;
  sent_at: string;
}

/**
 * The messages of a reported conversation, for staff, while the report is
 * open. Each call is written to the audit log, so it runs only when a
 * moderator asks for it, never on page load.
 */
export async function readReportedConversation(input: {
  reportId: string;
}): Promise<ActionResponse<ReportedMessage[]>> {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const parsed = reportIdSchema.safeParse(input.reportId);
  if (!parsed.success) return errorResponse(parsed.error.errors[0].message);

  const { data, error } = await staff.supabase.rpc(
    "get_reported_conversation",
    { p_report_id: parsed.data },
  );
  if (error) return decisionError(error);

  revalidatePath("/admin/logboek");
  return successResponse((data ?? []) as ReportedMessage[]);
}
