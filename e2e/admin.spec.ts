import { expect, loginAs, test } from "./fixtures";

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
