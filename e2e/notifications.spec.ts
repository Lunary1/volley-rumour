import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import {
  SEED_PASSWORD,
  expect,
  loginAs,
  pageFor,
  queueItem,
  seedUsers,
  submitRumour,
  test,
} from "./fixtures";
import { emailsTo, waitForEmails } from "./mailpit";
import {
  E2E_BASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./local-supabase.mjs";

// Email notifications (issue #98, D-025): a short email without the content
// for a new message and for a moderator's decision on your rumour, which you
// can turn off on your profile. Who gets an email when is tested in pgTAP
// (email_notifications.test.sql). Each test has its own throwaway accounts,
// so no other test's emails land in their mailbox.

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const created: string[] = [];

test.afterAll(async () => {
  for (const id of created) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

async function throwawayUser(name: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `${name}-${stamp}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: {
      username: `${name}_${stamp}`,
      age_confirmed: true,
      terms_accepted: true,
    },
  });
  expect(error).toBeNull();
  created.push(data.user!.id);
  return { id: data.user!.id, email };
}

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(SEED_PASSWORD);
  await page
    .locator("form")
    .getByRole("button", { name: "Inloggen", exact: true })
    .click();
  await page.waitForURL("/");
}

async function createAd(userId: string) {
  const title = `Meldingstest ${Date.now()}`;
  const { data, error } = await admin
    .from("classifieds")
    .insert({
      user_id: userId,
      type: "team_seeks_player",
      title,
      contact_name: title,
      team_name: title,
      position: "setter",
      gender: "heren",
      division: "nat2_heren",
      province: "antwerpen",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Tom answers the ad; returns the conversation's path. */
async function answerAd(page: Page, adId: string, text: string) {
  await page.goto(`/zoekertjes/${adId}`);
  await page.getByRole("button", { name: "Contact opnemen" }).click();
  await page.getByRole("textbox").fill(text);
  await page.getByRole("button", { name: /Verstuur/ }).click();
  await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+$/);
  return new URL(page.url()).pathname;
}

// Emails are sent after the response; give a wrong one time to arrive
// before checking there is none.
const settle = (page: Page) => page.waitForTimeout(3_000);

test("an ad owner who is away gets one email without the message", async ({
  page,
}) => {
  const owner = await throwawayUser("adverteerder");
  const adId = await createAd(owner.id);
  const since = new Date();
  const secret = `Geheim bericht ${Date.now()}`;

  await loginAs(page, "tom");
  const conversationPath = await answerAd(page, adId, secret);

  const [email] = await waitForEmails(owner.email, since);
  expect(email.Subject).toBe("Je hebt een nieuw bericht op VolleyRumours");
  expect(email.Text).toContain(`${E2E_BASE_URL}${conversationPath}`);
  expect(email.HTML).toContain(`href="${E2E_BASE_URL}${conversationPath}"`);
  expect(email.Text).toContain(`${E2E_BASE_URL}/profile`);
  // Content-free: no message text and no sender.
  for (const body of [email.Text, email.HTML]) {
    expect(body).not.toContain(secret);
    expect(body).not.toContain(seedUsers.tom.username);
  }

  // A second message while the first is unread: no second email.
  const second = `Nog een vraag ${Date.now()}`;
  await page.getByPlaceholder("Typ je bericht...").fill(second);
  await page.getByRole("button", { name: "Verstuur bericht" }).click();
  await expect(page.getByText(second)).toBeVisible();
  await settle(page);
  expect(await emailsTo(owner.email, since)).toHaveLength(1);
});

test("a user turns email notifications off and on in their profile", async ({
  page,
  browser,
}) => {
  test.slow();
  const owner = await throwawayUser("stil");
  const adId = await createAd(owner.id);

  await login(page, owner.email);
  await page.goto("/profile");
  const checkbox = page.getByRole("checkbox", {
    name: /Stuur me een e-mail bij een nieuw bericht/,
  });
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await expect(
    page.getByText("Je krijgt geen e-mailmeldingen meer."),
  ).toBeVisible();
  await page.reload();
  await expect(checkbox).not.toBeChecked();

  // Off: a message sends no email.
  const since = new Date();
  const tom = await pageFor(browser, "tom");
  await answerAd(tom, adId, "Is de plaats nog vrij?");
  await settle(tom);
  expect(await emailsTo(owner.email, since)).toHaveLength(0);

  await checkbox.check();
  await expect(page.getByText("Je krijgt weer e-mailmeldingen.")).toBeVisible();
  await page.reload();
  await expect(checkbox).toBeChecked();
  await tom.context().close();
});

test("a rumour's author is emailed when it is approved or rejected", async ({
  page,
  browser,
}) => {
  test.slow();
  const author = await throwawayUser("melder");
  const approved = `Goedmail${Date.now()}`;
  const rejected = `Afmail${Date.now()}`;

  await login(page, author.email);
  await submitRumour(page, approved);
  await submitRumour(page, rejected);
  const since = new Date();

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/wachtrij");
  await queueItem(moderator, `Toon ${approved}`)
    .getByRole("button", { name: "Goedkeuren" })
    .click();
  await expect(
    moderator.getByText(`Gerucht over Toon ${approved} goedgekeurd`),
  ).toBeVisible();
  const [approval] = await waitForEmails(author.email, since);
  expect(approval.Subject).toBe("Je gerucht is goedgekeurd");

  const item = queueItem(moderator, `Toon ${rejected}`);
  await item.getByRole("button", { name: "Afwijzen" }).click();
  await item.getByLabel("Dubbel gerucht").check();
  await item.getByRole("button", { name: "Afwijzen bevestigen" }).click();
  await expect(
    moderator.getByText(`Gerucht over Toon ${rejected} afgewezen`),
  ).toBeVisible();
  const emails = await waitForEmails(author.email, since, 2);
  expect(emails.map((e) => e.Subject)).toEqual([
    "Je gerucht is goedgekeurd",
    "Je gerucht is niet gepubliceerd",
  ]);
  // No player names in the emails.
  for (const email of emails) {
    expect(email.Text).not.toContain("Toon");
    expect(email.Text).toContain(`${E2E_BASE_URL}/profile`);
  }
  await moderator.context().close();
});
