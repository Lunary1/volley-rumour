import { expect, loginAs, pageFor, seedUsers, test } from "./fixtures";
import type { Page } from "@playwright/test";

// Suspensions, the verified badge and the moderator role (#80, J-15, D-016).
// Only admins change them; moderators can look. global-setup.ts lifts the
// suspension and resets the badge and role before every run.

/** Opens a user's page in /admin/gebruikers through the search. */
async function openUser(page: Page, username: string) {
  await page.goto("/admin/gebruikers");
  await page.getByRole("searchbox").fill(username);
  await page.getByRole("button", { name: "Zoeken" }).click();
  await page
    .getByRole("list", { name: "Gebruikers" })
    .getByRole("link", { name: new RegExp(username) })
    .click();
  await expect(
    page.getByRole("heading", { level: 2, name: username }),
  ).toBeVisible();
}

test("a moderator finds users but cannot sanction them", async ({ page }) => {
  await loginAs(page, "moderator");
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Beheer" })
    .getByRole("link", { name: "Gebruikers" })
    .click();
  await page.waitForURL("/admin/gebruikers");

  // Staff see who is staff; the public profile data doesn't show roles (#111).
  await page.getByLabel("Toon").selectOption("staff");
  await page.getByRole("button", { name: "Zoeken" }).click();
  const list = page.getByRole("list", { name: "Gebruikers" });
  await expect(
    list.getByRole("listitem").filter({ hasText: seedUsers.admin.username }),
  ).toContainText("Beheerder");
  await expect(
    list
      .getByRole("listitem")
      .filter({ hasText: seedUsers.moderator.username }),
  ).toContainText("Moderator");

  await openUser(page, seedUsers.kandidaat.username);
  await expect(
    page.getByText("Alleen beheerders kunnen schorsen"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Schorsen" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Badge toekennen" }),
  ).toHaveCount(0);
});

test("an admin suspends a user, who can read but not post, then lifts it", async ({
  page,
  browser,
}) => {
  // Unique per run: the audit log is append-only and outlives earlier runs.
  const reason = `Herhaalde spam in berichten (${Date.now()})`;
  await loginAs(page, "admin");
  await openUser(page, seedUsers.geschorst.username);

  await page.getByRole("button", { name: "Schorsen" }).click();
  const form = page.getByRole("form", { name: "Gebruiker schorsen" });
  await form.getByLabel("Hoe lang?").selectOption("7");
  await form.getByLabel("Reden (de gebruiker ziet ze)").fill(reason);
  await form.getByRole("button", { name: "Schorsing bevestigen" }).click();

  await expect(page.getByText("Gebruiker geschorst").first()).toBeVisible();
  await expect(
    page.getByRole("definition").filter({ hasText: /^Geschorst tot / }),
  ).toBeVisible();
  const history = page.getByRole("list", { name: "Geschiedenis" });
  await expect(history).toContainText(reason);
  await expect(history).toContainText(seedUsers.admin.username);

  // The suspended user still logs in and reads, sees why, and can't post.
  const suspended = await pageFor(browser, "geschorst");
  const notice = suspended.getByRole("status").filter({
    hasText: "Je account is geschorst",
  });
  await expect(notice).toContainText(reason);
  await expect(notice).toContainText("Je kan de site nog lezen");

  await suspended.goto("/geruchten/nieuw");
  await suspended.getByRole("combobox").first().click();
  await suspended.getByRole("option", { name: "Trainer Stopt" }).click();
  await suspended.getByLabel(/Achternaam/).fill("Schorstest");
  await suspended.getByLabel(/Voornaam/).fill("Toon");
  await suspended.getByLabel(/Huidige Club/).fill("VC Testdorp");
  await suspended.getByLabel(/Waar komt je gerucht vandaan/).click();
  await suspended.getByRole("option", { name: "Eigen waarneming" }).click();
  await suspended.getByLabel(/regels voor geruchten/).check();
  await suspended.getByRole("button", { name: "Gerucht Delen" }).click();
  await expect(
    suspended.getByText("Je account is geschorst. Je kan de site nog lezen"),
  ).toBeVisible();

  // The audit log links the entry to the user.
  await page.goto("/admin/logboek");
  const row = page.getByRole("row").filter({ hasText: reason });
  await expect(row).toContainText("Gebruiker geschorst");
  await row.getByRole("link", { name: seedUsers.geschorst.username }).click();

  await page.getByRole("button", { name: "Schorsing opheffen" }).click();
  await page
    .getByRole("form", { name: "Schorsing opheffen" })
    .getByRole("button", { name: "Opheffen bevestigen" })
    .click();
  await expect(page.getByText("Niet geschorst")).toBeVisible();
  await expect(page.getByRole("list", { name: "Geschiedenis" })).toContainText(
    "Schorsing opgeheven",
  );

  await suspended.reload();
  await expect(
    suspended.getByText("Je account is geschorst", { exact: false }),
  ).toHaveCount(0);
  await suspended.context().close();
});

test("an admin grants and revokes the verified badge and the moderator role", async ({
  page,
  browser,
}) => {
  await loginAs(page, "admin");
  await openUser(page, seedUsers.kandidaat.username);

  await page.getByRole("button", { name: "Badge toekennen" }).click();
  await page.getByRole("button", { name: "Toekennen bevestigen" }).click();
  await expect(
    page.getByRole("button", { name: "Badge intrekken" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Moderator maken" }).click();
  await page
    .getByRole("form", { name: "Moderator maken" })
    .getByLabel("Notitie voor het logboek (optioneel)")
    .fill("Helpt tijdens de transferperiode");
  await page.getByRole("button", { name: "Rol wijzigen bevestigen" }).click();
  await expect(
    page.getByRole("button", { name: "Moderatorrol afnemen" }),
  ).toBeVisible();

  // The new moderator reaches the admin area.
  const candidate = await pageFor(browser, "kandidaat");
  await candidate
    .getByRole("banner")
    .getByRole("link", { name: "Beheer" })
    .click();
  await candidate.waitForURL("/admin");

  await page.getByRole("button", { name: "Moderatorrol afnemen" }).click();
  await page.getByRole("button", { name: "Rol wijzigen bevestigen" }).click();
  await expect(
    page.getByRole("button", { name: "Moderator maken" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Badge intrekken" }).click();
  await page.getByRole("button", { name: "Intrekken bevestigen" }).click();
  await expect(
    page.getByRole("button", { name: "Badge toekennen" }),
  ).toBeVisible();

  const history = page.getByRole("list", { name: "Geschiedenis" });
  for (const entry of [
    "Badge toegekend",
    "Badge ingetrokken",
    "Gebruiker → Moderator",
    "Moderator → Gebruiker",
  ]) {
    await expect(history).toContainText(entry);
  }

  // Without the role, the admin area is gone again.
  const response = await candidate.goto("/admin");
  expect(response?.status()).toBe(404);
  await candidate.context().close();
});

test("an admin cannot suspend a moderator or themselves", async ({ page }) => {
  await loginAs(page, "admin");

  await openUser(page, seedUsers.moderator.username);
  await expect(page.getByRole("button", { name: "Schorsen" })).toHaveCount(0);
  await expect(
    page.getByText(
      "Om een moderator te schorsen, neem je eerst de moderatorrol af.",
    ),
  ).toBeVisible();

  await openUser(page, seedUsers.admin.username);
  await expect(page.getByRole("button", { name: "Schorsen" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Moderator maken" }),
  ).toHaveCount(0);
  await expect(page.getByText("Dit ben jij")).toBeVisible();
});
