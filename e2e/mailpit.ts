import { expect } from "@playwright/test";

// The local Supabase stack delivers every auth email to Mailpit.
const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitMessage = { ID: string; Created: string };

/**
 * Waits for an email to `to` that arrived after `since` and returns the first
 * link in it that points at Supabase Auth's verify endpoint.
 */
export async function getAuthLinkFromEmail(to: string, since: Date) {
  let messageId: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
        );
        const { messages } = (await res.json()) as {
          messages: MailpitMessage[];
        };
        messageId = messages.find((m) => new Date(m.Created) >= since)?.ID;
        return messageId;
      },
      { message: `no email to ${to}`, timeout: 15_000 },
    )
    .toBeTruthy();

  const res = await fetch(`${MAILPIT_URL}/api/v1/message/${messageId}`);
  const { HTML, Text } = (await res.json()) as { HTML: string; Text: string };
  const link = `${HTML} ${Text}`.match(
    /https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/,
  )?.[0];
  if (!link) throw new Error(`email to ${to} has no auth link`);
  return link.replaceAll("&amp;", "&");
}
