import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { expect, loginAs, seedUsers, SEED_PASSWORD, test } from "./fixtures";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// Posting a zoekertje goes through a validated server action and stores every
// field, including gender and diploma (issue #71, J-04, J-08).

const AD_URL = /\/zoekertjes\/([0-9a-f-]{36})$/;

// Ads created here are deleted again, so the list keeps its seeded ads only.
const created: string[] = [];
test.afterEach(async () => {
  if (!created.length) return;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  await admin.from("classifieds").delete().in("id", created.splice(0));
});

async function choose(page: Page, label: RegExp, option: string) {
  await page.getByLabel(label).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function submitAndOpen(page: Page) {
  await page.getByRole("button", { name: "Zoekertje plaatsen" }).click();
  await expect(page).toHaveURL(AD_URL);
  created.push(AD_URL.exec(page.url())![1]);
  await expect(page.getByText("Je zoekertje staat online")).toBeVisible();
}

test("a logged-out visitor logs in and comes back to the form", async ({
  page,
}) => {
  await page.goto("/zoekertjes/nieuw");
  await expect(page).toHaveURL("/auth/login?next=/zoekertjes/nieuw");

  await page.getByLabel("E-mailadres").fill(seedUsers.jana.email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(SEED_PASSWORD);
  await page
    .locator("form")
    .getByRole("button", { name: "Inloggen", exact: true })
    .click();

  await expect(page).toHaveURL("/zoekertjes/nieuw");
  await expect(page.getByText("Nieuw Zoekertje Plaatsen")).toBeVisible();
});

test("a player posts a zoekertje and lands on it", async ({ page }) => {
  const lastName = `Proef${Date.now()}`;
  const name = `Zoë ${lastName}`;

  await loginAs(page, "jana");
  await page.goto("/zoekertjes/nieuw");
  await choose(page, /Type zoekertje/, "Speler/speelster zoekt team");
  await page.getByLabel(/^Voornaam/).fill("Zoë");
  await page.getByLabel(/^Naam/).fill(lastName);
  await page.getByLabel(/^Clubnaam/).fill("VC Proefstad");
  await choose(page, /Dames\/Heren/, "Dames");
  await choose(page, /Niveau/, "Nationale 2 Dames");
  await choose(page, /Positie/, "Libero");
  await choose(page, /Provincie/, "Limburg");
  await page
    .getByLabel(/Omschrijf hier kort/)
    .fill("Libero zoekt een ploeg met ambitie.");

  // Told before submitting that the ad is public.
  await expect(
    page.getByText(/Je zoekertje is openbaar: iedereen kan je naam, je club/),
  ).toBeVisible();

  await submitAndOpen(page);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("Libero", { exact: true })).toBeVisible();
  await expect(page.getByText("VC Proefstad", { exact: true })).toBeVisible();
  await expect(page.getByText("Dames", { exact: true })).toBeVisible();
  await expect(page.getByText("Nationale 2 Dames")).toBeVisible();
  await expect(page.getByText("Limburg")).toBeVisible();
  await expect(
    page.getByText("Libero zoekt een ploeg met ambitie."),
  ).toBeVisible();

  await page.goto("/zoekertjes");
  await expect(
    page.locator(`a[href="/zoekertjes/${created[0]}"]`).first(),
  ).toBeVisible();
});

test("a team asks for a trainer with a minimum diploma", async ({ page }) => {
  const team = `VC Proef${Date.now()}`;

  await loginAs(page, "club");
  await page.goto("/zoekertjes/nieuw");
  await choose(page, /Type zoekertje/, "Team zoekt trainer/trainster");
  await page.getByLabel(/^Teamnaam/).fill(team);

  // The divisions follow Dames/Heren.
  await expect(page.getByLabel(/Niveau/)).toBeDisabled();
  await choose(page, /Dames\/Heren/, "Heren");
  await page.getByLabel(/Niveau/).click();
  await expect(page.getByRole("option", { name: "Liga Heren" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Liga Dames" })).toHaveCount(0);
  await page.getByRole("option", { name: "Promo 4 Heren" }).click();

  await expect(
    page.getByLabel("Minimaal diploma (optioneel)"),
  ).not.toHaveAttribute("required");
  await choose(page, /Minimaal diploma/, "Trainer B");
  await choose(page, /Provincie/, "Antwerpen");

  await submitAndOpen(page);
  await expect(
    page.getByRole("heading", { level: 1, name: `${team} zoekt een trainer` }),
  ).toBeVisible();
  await expect(page.getByText("Minimaal diploma: Trainer B")).toBeVisible();
  await expect(page.getByText("Heren", { exact: true })).toBeVisible();
  await expect(page.getByText("Promo 4 Heren")).toBeVisible();
});

test("the server checks the input and answers in Dutch", async ({ page }) => {
  await loginAs(page, "tom");
  await page.goto("/zoekertjes/nieuw");
  await choose(page, /Type zoekertje/, "Trainer/trainster zoekt team");
  // One letter passes the browser's `required`, not the server's schema.
  await page.getByLabel(/^Voornaam/).fill("T");
  await page.getByLabel(/^Naam/).fill("Testmans");
  await choose(page, /Dames\/Heren/, "Heren");
  await choose(page, /Niveau/, "Nationale 1 Heren");
  await choose(page, /^Diploma/, "Trainer A");
  await choose(page, /Provincie/, "Oost-Vlaanderen");
  await page.getByRole("button", { name: "Zoekertje plaatsen" }).click();

  await expect(
    page.getByText("Voornaam moet minstens 2 tekens zijn"),
  ).toHaveRole("alert");
  await expect(page).toHaveURL("/zoekertjes/nieuw");
});
