import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site-url";
import { takedownStatusPath } from "@/lib/takedown";

// Email notifications (#98, D-025): short and content-free. They never
// contain a message, a rumour or a name, only that something happened and a
// link. Who gets one is decided by the database (email_notifications and
// staff_and_takedown_emails migrations), which also honours the opt-out on
// the profile where it applies.

interface Footer {
  text: string;
  path?: string;
}

const PROFILE_FOOTER: Footer = {
  text: "Je krijgt deze e-mail omdat e-mailmeldingen aan staan voor je account op VolleyRumours. Je zet ze uit op je profiel:",
  path: "/profile",
};

function notificationEmail(
  to: string,
  subject: string,
  body: string,
  link: { label: string; path: string },
  footer: Footer = PROFILE_FOOTER,
) {
  const url = `${SITE_URL}${link.path}`;
  const footerUrl = footer.path ? `${SITE_URL}${footer.path}` : null;
  return {
    to,
    subject,
    text: `${body}\n\n${link.label}: ${url}\n\n${footer.text}${footerUrl ? ` ${footerUrl}` : ""}`,
    html: `<p>${body}</p>
<p><a href="${url}">${link.label}</a></p>
<p style="color:#6b7280;font-size:12px">${footer.text}${footerUrl ? ` <a href="${footerUrl}">${footerUrl}</a>` : ""}</p>`,
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

// New items in the moderation inboxes (#181, D-037).
const STAFF_ITEMS = {
  takedown: {
    subject: "Nieuw verwijderverzoek op VolleyRumours",
    body: "Er is een nieuw verwijderverzoek binnengekomen.",
    path: "/admin/meldingen",
  },
  report: {
    subject: "Nieuwe melding op VolleyRumours",
    body: "Er is een nieuwe melding binnengekomen.",
    path: "/admin/meldingen",
  },
  contact: {
    subject: "Nieuw contactbericht op VolleyRumours",
    body: "Er is een nieuw bericht via het contactformulier binnengekomen.",
    path: "/admin/contact",
  },
} as const;

/**
 * Emails every staff account that a new item waits in an inbox, whatever its
 * profile opt-out: the inboxes have a 72-hour target (D-036).
 */
export async function notifyStaff(kind: keyof typeof STAFF_ITEMS) {
  try {
    const { data, error } = await createAdminClient().rpc(
      "staff_notification_emails",
    );
    if (error) throw error;
    const item = STAFF_ITEMS[kind];
    await Promise.all(
      ((data ?? []) as string[]).map((to) =>
        sendEmail(
          notificationEmail(
            to,
            item.subject,
            item.body,
            { label: "Naar het overzicht", path: item.path },
            {
              text: "Je krijgt deze e-mail omdat je moderator bent op VolleyRumours.",
            },
          ),
        ),
      ),
    );
  } catch (error) {
    console.error("Staff notification failed:", error);
  }
}

/**
 * Emails every takedown requester whose request was decided and who wasn't
 * emailed yet (D-037, DSA art. 16(5)), with a new link to the status page.
 * Call it after every action that can decide a takedown request.
 */
export async function notifyTakedownDecisions() {
  try {
    const { data, error } = await createAdminClient().rpc(
      "claim_takedown_decision_emails",
    );
    if (error) throw error;
    const claimed = (data ?? []) as {
      email: string;
      reference: string;
      token: string;
    }[];
    await Promise.all(
      claimed.map(({ email, reference, token }) =>
        sendEmail(
          notificationEmail(
            email,
            `Beslissing over je verwijderverzoek ${reference}`,
            `Een moderator heeft beslist over je verwijderverzoek ${reference}. Via de link lees je de beslissing en wat je kan doen als je het er niet mee eens bent. Deel de link niet: wie hem heeft, ziet de status van je verzoek.`,
            { label: "Bekijk de beslissing", path: takedownStatusPath(token) },
            {
              text: "Je krijgt deze e-mail omdat je een verwijderverzoek indiende op VolleyRumours. Het is de enige e-mail die we je erover sturen.",
            },
          ),
        ),
      ),
    );
  } catch (error) {
    console.error("Takedown decision notification failed:", error);
  }
}
