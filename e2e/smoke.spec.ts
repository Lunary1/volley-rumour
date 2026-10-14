import { test, expect, loginAs, seed, seedUsers } from "./fixtures";

// Smoke tests: the main public pages render seeded data, and a seeded user
// can log in and out (issue #56).

test("homepage shows open rumours and confirmed transfers", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /transfer talk/i }),
  ).toBeVisible();
  await expect(
    page.getByText(seed.openRumour.playerName).first(),
  ).toBeVisible();
  await expect(
    page.getByText(seed.confirmedRumour.playerName).first(),
  ).toBeVisible();
});

test("zoekertjes list links to the detail page", async ({ page }) => {
  await page.goto("/zoekertjes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Zoekertjes" }),
  ).toBeVisible();
  await expect(
    page.getByText(`${seed.activeAdCount} zoekertjes`),
  ).toBeVisible();
  await expect(
    page.locator(`a[href="/zoekertjes/${seed.inactiveAd.id}"]`),
  ).toHaveCount(0);

  await page.locator(`a[href="/zoekertjes/${seed.activeAd.id}"]`).click();
  await expect(page).toHaveURL(`/zoekertjes/${seed.activeAd.id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: seed.activeAd.title }),
  ).toBeVisible();
  await expect(page.getByText(seed.activeAd.description)).toBeVisible();
});

test("inactive zoekertje is not found", async ({ page }) => {
  const response = await page.goto(`/zoekertjes/${seed.inactiveAd.id}`);
  expect(response?.status()).toBe(404);
});

test("geruchten lists rumours and filters by status", async ({ page }) => {
  await page.goto("/geruchten");
  await expect(
    page.getByRole("heading", { level: 1, name: "Transfer Talk" }),
  ).toBeVisible();
  await expect(
    page.getByText(seed.openRumour.playerName).first(),
  ).toBeVisible();

  await page.goto("/geruchten?status=confirmed");
  await expect(
    page.getByText(seed.confirmedRumour.playerName).first(),
  ).toBeVisible();
  await expect(page.getByText(seed.openRumour.playerName)).toHaveCount(0);
});

test("a seeded user can log in and out", async ({ page }) => {
  await loginAs(page, "uitlogger");

  await page.getByRole("button", { name: "Uitloggen" }).click();
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Inloggen" })).toBeVisible();
  await expect(header.getByText(seedUsers.uitlogger.username)).toHaveCount(0);
});

test("a wrong password shows a Dutch error", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByLabel("E-mailadres").fill(seedUsers.jana.email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill("fout-wachtwoord");
  await page
    .locator("form")
    .getByRole("button", { name: "Inloggen", exact: true })
    .click();
  await expect(
    page.getByText("Ongeldig e-mailadres of wachtwoord."),
  ).toBeVisible();
});
