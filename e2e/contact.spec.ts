import type { Page } from "@playwright/test";
import { expect, loginAs, pageFor, seed, seedUsers, test } from "./fixtures";

// The contact form stores messages; staff read them at /admin/contact and
// mark them handled, which is logged (issue #81, D-017).

/** Fills in and sends the contact form. */
async function sendMessage(
  page: Page,
  { name, email, message }: { name: string; email?: string; message: string },
) {
  await page.getByLabel("Onderwerp").click();
  await page.getByRole("option", { name: "Vraag of feedback" }).click();
  await page.getByLabel("Je naam").fill(name);
  if (email) await page.getByLabel("Je e-mailadres").fill(email);
  await page.getByLabel("Je bericht").fill(message);
  await page.getByRole("button", { name: "Bericht versturen" }).click();
  await expect(
    page.getByRole("heading", { name: "Je bericht is verstuurd" }),
  ).toBeVisible();
}

/** A message's card on /admin/contact. */
function inboxItem(page: Page, text: string) {
  return page.getByRole("listitem").filter({ hasText: text });
}

test("a visitor's message reaches staff, who mark it handled", async ({
  page,
  browser,
}) => {
  const email = `vraag-${Date.now()}@example.test`;
  const message = `Wanneer gaat de site open? (${email})`;
  // The audit log is append-only, so the note must be unique per run.
  const note = `Beantwoord per mail (${email}).`;

  await page.goto("/contact");
  // Abuse goes elsewhere: "Melden" and the takedown form.
  await expect(
    page.getByRole("link", { name: "Vraag de verwijdering aan" }),
  ).toBeVisible();
  await sendMessage(page, { name: "Test Bezoeker", email, message });

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin");
  await moderator
    .getByRole("navigation", { name: "Beheer" })
    .getByRole("link", { name: "Contact" })
    .click();
  await moderator.waitForURL("/admin/contact");

  const item = inboxItem(moderator, email);
  await expect(item).toContainText("Test Bezoeker");
  await expect(item).toContainText(message);
  await expect(item).toContainText("Vraag of feedback");
  await expect(item).toContainText("Niet ingelogd");

  await item.getByRole("button", { name: "Afgehandeld" }).click();
  await item.getByLabel("Interne notitie (optioneel)").fill(note);
  await item.getByRole("button", { name: "Afhandelen bevestigen" }).click();
  await expect(moderator.getByText("Bericht afgehandeld")).toBeVisible();
  await expect(
    moderator
      .getByRole("list", { name: "Afgehandelde berichten" })
      .getByRole("listitem")
      .filter({ hasText: email }),
  ).toContainText(note);
  await expect(
    moderator
      .getByRole("list", { name: "Open berichten" })
      .getByRole("listitem")
      .filter({ hasText: email }),
  ).toHaveCount(0);

  await moderator.goto("/admin/logboek");
  await expect(
    moderator.getByRole("row").filter({ hasText: note }),
  ).toContainText("Contactbericht afgehandeld");
});

test("a logged-in user's email is filled in and staff see their account", async ({
  page,
  browser,
}) => {
  const message = `Kan ik mijn zoekertje verlengen? (${Date.now()})`;
  await loginAs(page, "tom");
  await page.goto("/contact");
  await expect(page.getByLabel("Je e-mailadres")).toHaveValue(
    seedUsers.tom.email,
  );
  await sendMessage(page, { name: "Tom Testmans", message });

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/contact");
  const item = inboxItem(moderator, message);
  await expect(item).toContainText(seedUsers.tom.email);
  await expect(
    item.getByRole("link", { name: seedUsers.tom.username }),
  ).toHaveAttribute("href", /\/admin\/gebruikers\//);
});

test("only staff read contact messages", async ({ page, browser }) => {
  const { senderName, senderEmail, message } = seed.contactMessage;

  await loginAs(page, "jana");
  const forbidden = await page.goto("/admin/contact");
  expect(forbidden?.status()).toBe(404);
  await expect(page.getByText(message)).toHaveCount(0);

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/contact");
  const item = inboxItem(moderator, message);
  await expect(item).toContainText(senderName);
  await expect(item).toContainText(senderEmail);
  await expect(item).toContainText("Mijn account of schorsing");
  await expect(
    item.getByRole("link", { name: seedUsers.jana.username }),
  ).toBeVisible();
});
