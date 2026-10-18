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

export type Email = { Subject: string; Text: string; HTML: string };

/** The emails to `to` that arrived after `since`, oldest first. */
export async function emailsTo(to: string, since: Date): Promise<Email[]> {
  const res = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
  );
  const { messages } = (await res.json()) as { messages: MailpitMessage[] };
  const ids = messages
    .filter((m) => new Date(m.Created) >= since)
    .reverse()
    .map((m) => m.ID);
  return Promise.all(
    ids.map(async (id) => {
      const message = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
      return (await message.json()) as Email;
    }),
  );
}

/** Waits until `count` emails to `to` arrived after `since` and returns them. */
export async function waitForEmails(to: string, since: Date, count = 1) {
  let emails: Email[] = [];
  await expect
    .poll(
      async () => {
        emails = await emailsTo(to, since);
        return emails.length;
      },
      { message: `no email to ${to}`, timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(count);
  return emails;
}
