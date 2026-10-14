import { test, expect, loginAs, seed, seedUsers } from "./fixtures";

// The profile page loads its data on the server since #62.

test("profile shows the user's stats and recent activity", async ({ page }) => {
  await loginAs(page, "jana");
  await page.goto("/profile");

  await expect(
    page.getByRole("heading", { level: 1, name: seedUsers.jana.username }),
  ).toBeVisible();
  await expect(page.getByText("Statistieken")).toBeVisible();
  await expect(page.getByText(seed.janaRumour.playerName)).toBeVisible();
  await expect(page.getByText(seed.janaAd.title)).toBeVisible();
  // The edit form starts with the stored username.
  await page.getByRole("button", { name: "Bewerk profiel" }).click();
  await expect(page.getByLabel(/gebruikersnaam/i)).toHaveValue(
    seedUsers.jana.username,
  );
});

test("profile asks a visitor to log in", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByText("Je bent niet ingelogd")).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: "Inloggen" }),
  ).toBeVisible();
});
