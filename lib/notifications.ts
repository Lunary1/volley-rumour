import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site-url";

// Email notifications (#98, D-025): short and content-free. They never
// contain a message, a rumour or a name, only that something happened and a
// link. Who gets one is decided by the database (email_notifications
// migration), which also honours the opt-out on the profile.

function notificationEmail(
  to: string,
  subject: string,
  body: string,
  link: { label: string; path: string },
) {
  const url = `${SITE_URL}${link.path}`;
  const profileUrl = `${SITE_URL}/profile`;
  const footer =
    "Je krijgt deze e-mail omdat e-mailmeldingen aan staan voor je account op VolleyRumours. Je zet ze uit op je profiel:";
  return {
    to,
    subject,
    text: `${body}\n\n${link.label}: ${url}\n\n${footer} ${profileUrl}`,
    html: `<p>${body}</p>
<p><a href="${url}">${link.label}</a></p>
<p style="color:#6b7280;font-size:12px">${footer} <a href="${profileUrl}">${profileUrl}</a></p>`,
  };
}

/** Emails the recipient of a new message, if one is due. */
export async function notifyNewMessage(
  messageId: string,
  conversationId: string,
) {
  try {
    const { data: to, error } = await createAdminClient().rpc(
      "message_notification_email",
      { p_message_id: messageId },
    );
    if (error) throw error;
    if (!to) return;
    await sendEmail(
      notificationEmail(
        to,
        "Je hebt een nieuw bericht op VolleyRumours",
        "Je hebt een nieuw bericht op VolleyRumours.",
        { label: "Lees het bericht", path: `/messages/${conversationId}` },
      ),
    );
  } catch (error) {
    console.error("Message notification failed:", error);
  }
}

/** Emails the author of a rumour a moderator approved or rejected. */
export async function notifyRumourDecision(
  rumourId: string,
  decision: "approved" | "rejected",
) {
  try {
    const { data: to, error } = await createAdminClient().rpc(
      "rumour_notification_email",
      { p_rumour_id: rumourId },
    );
    if (error) throw error;
    if (!to) return;
    await sendEmail(
      decision === "approved"
        ? notificationEmail(
            to,
            "Je gerucht is goedgekeurd",
            "Een moderator heeft je gerucht goedgekeurd. Het staat nu op Transfer Talk.",
            { label: "Bekijk je geruchten", path: "/profile" },
          )
        : notificationEmail(
            to,
            "Je gerucht is niet gepubliceerd",
            "Een moderator heeft je gerucht niet goedgekeurd. Op je profiel lees je waarom.",
            { label: "Bekijk je geruchten", path: "/profile" },
          ),
    );
  } catch (error) {
    console.error("Rumour notification failed:", error);
  }
}
