import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { SEED_PASSWORD, expect, pageFor, seedUsers, test } from "./fixtures";
import { emailsTo, waitForEmails, type Email } from "./mailpit";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// Moderation emails (issue #181, D-037): every staff account gets a
// content-free email for a new takedown request, report and contact message,
// and a takedown requester gets one email with a link to the decision. Who
// gets an email is tested in pgTAP (staff_and_takedown_emails.test.sql).
// Other tests file reports too, so the staff mailbox is checked for at least
// one email of each kind, never an exact count.

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const createdUsers: string[] = [];
const createdRumours: string[] = [];

test.afterAll(async () => {
  if (createdRumours.length) {
    await admin.from("rumours").delete().in("id", createdRumours);
  }
  for (const id of createdUsers) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** A throwaway moderator, so the test reads a mailbox nobody else uses. */
async function throwawayModerator() {
  const s = stamp();
  const email = `moderator-${s}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: {
      username: `mod_${s}`,
      age_confirmed: true,
      terms_accepted: true,
    },
  });
  expect(error).toBeNull();
  createdUsers.push(data.user!.id);
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: "moderator" })
    .eq("id", data.user!.id);
  expect(roleError).toBeNull();
  return email;
}

/** A public rumour by the club account. */
async function publicRumour() {
  const { data: author } = await admin
    .from("profiles")
    .select("id")
    .eq("username", seedUsers.club.username)
    .single();
  const playerName = `Mila Mailtest${stamp()}`;
  const { data, error } = await admin
    .from("rumours")
    .insert({
      creator_id: author!.id,
      player_name: playerName,
      category: "transfer",
      status: "rumour",
      from_club_name: "VC Testdorp",
      to_club_name: "Volley Voorbeeld",
      source_type: "own_observation",
      declared_good_faith: true,
      declared_senior: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Creating a rumour: ${error.message}`);
  createdRumours.push(data.id);
  return { id: data.id as string, playerName };
}

/** Files a takedown request for the rumour; returns reference and link. */
async function requestTakedown(page: Page, rumourId: string, email: string) {
  await page.goto(`/verwijderverzoek?gerucht=${rumourId}`);
  await page.getByLabel("Het gerucht gaat over mij", { exact: true }).check();
  await page.getByLabel("Je naam").fill("Mila Aanvrager");
  await page.getByLabel("Je e-mailadres").fill(email);
  await page
    .getByLabel("Waarom moet dit gerucht weg?")
    .fill("Dit klopt niet, ik verander niet van club.");
  await page
    .getByLabel(
      "Ik verklaar te goeder trouw dat mijn verzoek juist en volledig is.",
    )
    .check();
  await page.getByRole("button", { name: "Verzoek versturen" }).click();
  await expect(
    page.getByRole("heading", { name: "Je verzoek is verstuurd" }),
  ).toBeVisible();
  await expect(
    page.getByText("Zodra een moderator beslist, sturen we je één e-mail"),
  ).toBeVisible();
  const reference = (await page.getByText(/^VR-[2-9A-Z]{6}$/).textContent())!;
  const statusLink = (await page
    .getByRole("link", { name: "Status bekijken" })
    .getAttribute("href"))!;
  return { reference, statusLink };
}

/** Waits until an email with this subject reached `to` after `since`. */
async function waitForSubject(to: string, since: Date, subject: string) {
  let email: Email | undefined;
  await expect
    .poll(
      async () => {
        email = (await emailsTo(to, since)).find((e) => e.Subject === subject);
        return email;
      },
      { message: `no "${subject}" email to ${to}`, timeout: 15_000 },
    )
    .toBeTruthy();
  return email!;
}

/** The link in an email that points at this path. */
function linkTo(email: Email, path: string) {
  const link = email.Text.match(/https?:\/\/\S+/g)?.find((url) =>
    new URL(url).pathname.startsWith(path),
  );
  if (!link) throw new Error(`"${email.Subject}" has no link to ${path}`);
  return new URL(link).pathname;
}

test("staff are emailed about every new takedown request, report and contact message", async ({
  page,
  browser,
}) => {
  const moderator = await throwawayModerator();
  const { id, playerName } = await publicRumour();
  const since = new Date();

  // A takedown request, without an account.
  const requester = `aanvrager-${stamp()}@example.test`;
  await requestTakedown(page, id, requester);
  const takedownEmail = await waitForSubject(
    moderator,
    since,
    "Nieuw verwijderverzoek op VolleyRumours",
  );
  expect(linkTo(takedownEmail, "/admin/meldingen")).toBe("/admin/meldingen");

  // A report on the same rumour, by a logged-in user.
  const reporter = await pageFor(browser, "tom");
  await reporter.goto(`/geruchten/${id}`);
  await reporter
    .locator('[data-slot="card"]')
    .filter({ hasText: playerName })
    .getByRole("button", { name: "Melden" })
    .click();
  const dialog = reporter.getByRole("dialog", { name: "Gerucht melden" });
  await dialog.getByRole("radio", { name: "Onjuist of misleidend" }).check();
  await dialog.getByRole("button", { name: "Melding versturen" }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    "Bedankt voor je melding.",
  );
  const reportEmail = await waitForSubject(
    moderator,
    since,
    "Nieuwe melding op VolleyRumours",
  );
  expect(linkTo(reportEmail, "/admin/meldingen")).toBe("/admin/meldingen");

  // A contact message.
  const contactText = `Een vraag over de site ${stamp()}.`;
  await page.goto("/contact");
  await page.getByLabel("Onderwerp").click();
  await page.getByRole("option", { name: "Vraag of feedback" }).click();
  await page.getByLabel("Je naam").fill("Mila Contact");
  await page.getByLabel("Je e-mailadres").fill(requester);
  await page.getByLabel("Je bericht").fill(contactText);
  await page.getByRole("button", { name: "Bericht versturen" }).click();
  await expect(
    page.getByRole("heading", { name: "Je bericht is verstuurd" }),
  ).toBeVisible();
  const contactEmail = await waitForSubject(
    moderator,
    since,
    "Nieuw contactbericht op VolleyRumours",
  );
  expect(linkTo(contactEmail, "/admin/contact")).toBe("/admin/contact");

  // Content-free: no names, no rumour, no message.
  for (const email of [takedownEmail, reportEmail, contactEmail]) {
    const body = `${email.Subject} ${email.Text} ${email.HTML}`;
    for (const secret of [
      playerName,
      "Mila",
      requester,
      contactText,
      "ik verander niet van club",
      seedUsers.tom.username,
    ]) {
      expect(body).not.toContain(secret);
    }
  }

  // Every staff account, the seeded moderator and admin too.
  for (const staff of [seedUsers.moderator.email, seedUsers.admin.email]) {
    await waitForSubject(staff, since, "Nieuw contactbericht op VolleyRumours");
  }
  // Regular users get nothing.
  expect(
    (await emailsTo(seedUsers.tom.email, since)).filter((e) =>
      e.Subject.startsWith("Nieuw"),
    ),
  ).toHaveLength(0);

  // Removing the rumour through the report also decides the takedown
  // request, and its requester is emailed.
  const staffPage = await pageFor(browser, "moderator");
  await staffPage.goto("/admin/meldingen");
  const report = staffPage
    .getByRole("list", { name: "Open meldingen" })
    .getByRole("listitem")
    .filter({ has: staffPage.getByRole("heading", { name: playerName }) })
    // The takedown request has the same heading; the report has a reason.
    .filter({ hasText: "Onjuist of misleidend" });
  await report.getByRole("button", { name: "Inhoud verwijderen" }).click();
  await report.getByRole("button", { name: "Verwijderen bevestigen" }).click();
  await expect(
    staffPage
      .getByRole("list", { name: "Behandelde meldingen" })
      .getByRole("listitem")
      .filter({ has: staffPage.getByRole("heading", { name: playerName }) })
      .first(),
  ).toBeVisible();
  const [decision] = await waitForEmails(requester, since);
  expect(decision.Subject).toMatch(/^Beslissing over je verwijderverzoek VR-/);
});

test("a takedown requester gets one email with a link to the decision", async ({
  page,
  browser,
}) => {
  const { id, playerName } = await publicRumour();
  const requester = `aanvrager-${stamp()}@example.test`;
  const since = new Date();
  const { reference, statusLink } = await requestTakedown(page, id, requester);

  // Nothing yet: the requester is only emailed the decision.
  await page.waitForTimeout(1_000);
  expect(await emailsTo(requester, since)).toHaveLength(0);

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/meldingen");
  const item = moderator.getByRole("listitem").filter({ hasText: reference });
  await item.getByRole("button", { name: "Verzoek afwijzen" }).click();
  await item
    .getByLabel(/Toelichting voor de aanvrager/)
    .fill("Het gerucht steunt op een officieel clubbericht.");
  await item.getByRole("button", { name: "Afwijzen bevestigen" }).click();
  await expect(
    moderator.getByText(`Verzoek ${reference} afgewezen`),
  ).toBeVisible();

  const [email] = await waitForEmails(requester, since);
  expect(email.Subject).toBe(
    `Beslissing over je verwijderverzoek ${reference}`,
  );
  // Content-free: the reference, not the decision, the note or the rumour.
  const body = `${email.Text} ${email.HTML}`;
  for (const secret of [playerName, "afgewezen", "officieel clubbericht"]) {
    expect(body).not.toContain(secret);
  }

  // A second link to the same status page; the first one keeps working.
  const emailLink = linkTo(email, "/verwijderverzoek/status/");
  expect(emailLink).not.toBe(statusLink);
  for (const link of [emailLink, statusLink]) {
    await page.goto(link);
    await expect(page.getByText(reference)).toBeVisible();
    await expect(page.getByText("Verzoek afgewezen")).toBeVisible();
    await expect(
      page.getByText("Het gerucht steunt op een officieel clubbericht."),
    ).toBeVisible();
  }

  // One email only.
  await page.waitForTimeout(1_000);
  expect(await emailsTo(requester, since)).toHaveLength(1);
});
