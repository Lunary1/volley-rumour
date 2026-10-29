import type { Page } from "@playwright/test";
import { test, expect, loginAs, pageFor, seed, seedUsers } from "./fixtures";

// Reports (#69, #79, #87, D-015): logged-in users report a rumour, zoekertje
// or conversation; moderators handle them in /admin/meldingen. A reported
// conversation is readable only through its report, and reading is logged.

/** A report's card in the open part of the inbox. */
function openReport(page: Page, heading: string) {
  return page
    .getByRole("list", { name: "Open meldingen" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: heading }) });
}

/** A report's card in the decided part of the inbox. */
function decidedReport(page: Page, heading: string) {
  return page
    .getByRole("list", { name: "Behandelde meldingen" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: heading }) });
}

/** The "Melden" button on a rumour's card in Transfer Talk. */
function reportButtonOnCard(page: Page, playerName: string) {
  return page
    .locator('[data-slot="card"]')
    .filter({ hasText: playerName })
    .getByRole("button", { name: "Melden" });
}

test("a visitor is asked to log in before reporting", async ({ page }) => {
  await page.goto("/geruchten?status=denied");
  await reportButtonOnCard(page, seed.reportRumour.playerName).click();
  await page.waitForURL("/auth/login?next=%2Fgeruchten");
});

test("a user reports a rumour and a moderator removes it", async ({
  page,
  browser,
}) => {
  const { playerName } = seed.reportRumour;

  await loginAs(page, "jana");
  await page.goto("/geruchten?status=denied");
  await reportButtonOnCard(page, playerName).click();
  const dialog = page.getByRole("dialog", { name: "Gerucht melden" });
  await expect(
    dialog.getByRole("link", { name: "Vraag de verwijdering aan" }),
  ).toBeVisible();
  await dialog
    .getByRole("radio", { name: "Beledigend of haatdragend" })
    .check();
  await dialog.getByLabel(/Uitleg/).fill("Dit is een persoonlijke aanval.");
  await dialog.getByRole("button", { name: "Melding versturen" }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    "Bedankt voor je melding.",
  );
  await dialog.getByRole("button", { name: "Sluiten" }).first().click();

  // One open report per user per item.
  await reportButtonOnCard(page, playerName).click();
  await dialog.getByRole("radio", { name: "Onjuist of misleidend" }).check();
  await dialog.getByRole("button", { name: "Melding versturen" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Je hebt dit al gemeld",
  );
  await page.keyboard.press("Escape");

  // Still visible until a moderator decides (D-015).
  await page.reload();
  await expect(page.getByText(playerName).first()).toBeVisible();

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/meldingen");
  const item = openReport(moderator, playerName);
  await expect(item).toContainText("Beledigend of haatdragend");
  await expect(item).toContainText(seedUsers.jana.username);
  await expect(item).toContainText("Dit is een persoonlijke aanval.");
  await item.getByRole("button", { name: "Inhoud verwijderen" }).click();
  await item
    .getByLabel(/Toelichting voor de auteur/)
    .fill("Dit gerucht viel een speler persoonlijk aan.");
  await item.getByRole("button", { name: "Verwijderen bevestigen" }).click();
  await expect(decidedReport(moderator, playerName)).toContainText(
    "Inhoud verwijderd",
  );

  await page.goto("/geruchten?status=denied");
  await expect(page.getByText(playerName)).toHaveCount(0);

  // The author sees the removal and the note on their profile.
  const author = await pageFor(browser, "club");
  await author.goto("/profile");
  // Inside <main>: while the page streams in, a second copy waits outside it.
  const profile = author.getByRole("main");
  await expect(
    profile.getByText(
      "Een moderator heeft dit gerucht van de site gehaald. Dit gerucht viel een speler persoonlijk aan.",
    ),
  ).toBeVisible();
  // With the way to contest it (DSA art. 17, #94).
  await expect(
    profile
      .getByText("Een moderator heeft dit gerucht van de site gehaald.")
      .getByRole("link", { name: "Laat het ons weten" }),
  ).toHaveAttribute("href", "/contact");
});

test("a user reports a zoekertje and a moderator dismisses it", async ({
  page,
  browser,
}) => {
  const { id, title } = seed.activeAd;

  await loginAs(page, "jana");
  await page.goto(`/zoekertjes/${id}`);
  await page.getByRole("button", { name: "Melden" }).click();
  const dialog = page.getByRole("dialog", { name: "Zoekertje melden" });
  await dialog.getByRole("radio", { name: "Andere" }).check();
  await dialog.getByRole("button", { name: "Melding versturen" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Leg in minstens 10 tekens uit",
  );
  await dialog
    .getByLabel(/Uitleg/)
    .fill("Dit team bestaat niet in deze reeks.");
  await dialog.getByRole("button", { name: "Melding versturen" }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    "Bedankt voor je melding.",
  );

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/meldingen");
  const item = openReport(moderator, title);
  await expect(item).toContainText("Zoekertje");
  await expect(item).toContainText("Dit team bestaat niet in deze reeks.");
  await item.getByRole("button", { name: "Geen actie" }).click();
  await item.getByRole("button", { name: "Afsluiten zonder actie" }).click();
  await expect(decidedReport(moderator, title)).toContainText("Geen actie");

  await page.goto(`/zoekertjes/${id}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("a user reports and blocks in a conversation; a moderator reads it through the report", async ({
  page,
  browser,
}) => {
  const { id, message } = seed.reportConversation;
  const club = seedUsers.club.username;
  // The log is append-only: a note per run finds this run's entry.
  const measure = `Gewaarschuwd per e-mail (${Date.now()}).`;

  await loginAs(page, "tom");
  await page.goto(`/messages/${id}`);
  await expect(page.getByText(message)).toBeVisible();
  await page.getByRole("button", { name: "Melden" }).click();
  const dialog = page.getByRole("dialog", { name: "Gesprek melden" });
  await dialog
    .getByRole("radio", { name: "Intimidatie of ongewenst gedrag" })
    .check();
  await dialog.getByRole("checkbox", { name: `Blokkeer ook ${club}` }).check();
  await dialog.getByRole("button", { name: "Melding versturen" }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    `Bedankt voor je melding. Je hebt ${club} geblokkeerd.`,
  );
  await dialog.getByRole("button", { name: "Sluiten" }).first().click();
  await expect(
    page.getByRole("status").filter({ hasText: "Jullie kunnen elkaar" }),
  ).toContainText(`Je hebt ${club} geblokkeerd.`);

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/meldingen");
  const item = openReport(moderator, `Gesprek met ${club}`);
  await expect(item).toContainText("Intimidatie of ongewenst gedrag");
  // Messages stay private until the moderator asks for them.
  await expect(item.getByText(message)).toHaveCount(0);
  await item.getByRole("button", { name: "Gesprek lezen" }).click();
  await expect(item.getByText(message)).toBeVisible();
  await expect(item.getByText("Je inzage is gelogd.")).toBeVisible();

  await item.getByRole("button", { name: "Maatregel genomen" }).click();
  const confirm = item.getByRole("button", { name: "Maatregel bevestigen" });
  await expect(confirm).toBeDisabled();
  await item.getByLabel(/Welke maatregel/).fill(measure);
  await confirm.click();
  await expect(decidedReport(moderator, `Gesprek met ${club}`)).toContainText(
    "Maatregel genomen",
  );

  await moderator.goto("/admin/logboek");
  await expect(
    moderator.getByRole("row").filter({ hasText: "Gemeld gesprek gelezen" }),
  ).not.toHaveCount(0);
  await expect(
    moderator.getByRole("row").filter({ hasText: measure }),
  ).toContainText("Maatregel na melding");
});
