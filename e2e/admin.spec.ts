import { expect, loginAs, seed, seedUsers, test } from "./fixtures";

// The admin area (issue #63, D-006) is for staff only. Everyone else gets a
// plain 404, so the area doesn't advertise itself.

test("a moderator reaches the admin area from the header", async ({ page }) => {
  await loginAs(page, "moderator");

  await page.getByRole("banner").getByRole("link", { name: "Beheer" }).click();
  await page.waitForURL("/admin");

  await expect(
    page.getByRole("heading", { level: 1, name: "Beheer" }),
  ).toBeVisible();
  const menu = page.getByRole("navigation", { name: "Beheer" });
  for (const section of ["Moderatiewachtrij", "Meldingen", "Gebruikers"]) {
    await expect(menu.getByText(section)).toBeVisible();
  }
});

test("a normal user gets a 404 on /admin and sees no Beheer link", async ({
  page,
}) => {
  await loginAs(page, "jana");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Beheer" }),
  ).toHaveCount(0);

  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Beheer" })).toHaveCount(0);
});

test("a visitor who isn't logged in gets a 404 on /admin", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Beheer" })).toHaveCount(0);
});

test("a moderator reads the audit log", async ({ page }) => {
  await loginAs(page, "moderator");
  await page.goto("/admin");

  await page
    .getByRole("navigation", { name: "Beheer" })
    .getByRole("link", { name: "Logboek" })
    .click();
  await page.waitForURL("/admin/logboek");

  for (const entry of seed.staffActions) {
    const row = page.getByRole("row").filter({ hasText: entry.reason });
    await expect(row).toContainText(entry.label);
    await expect(row).toContainText(seedUsers.moderator.username);
  }
});

test("a normal user gets a 404 on the audit log", async ({ page }) => {
  await loginAs(page, "jana");
  const response = await page.goto("/admin/logboek");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Logboek" })).toHaveCount(0);
});
