import { test, expect, seed } from "./fixtures";

// Rumours keep creator_id = null after their creator deletes their account.
// Transfer Talk and the homepage must still load and show a neutral author
// (issue #57).

const { playerName } = seed.rumourWithoutCreator;

test("Transfer Talk shows a rumour from a deleted account", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/geruchten");
  const card = page
    .locator('[data-slot="card"]')
    .filter({ hasText: playerName });
  await expect(card).toBeVisible();
  await expect(card.getByText("Verwijderd account")).toBeVisible();

  await card.getByRole("button", { name: "Bekijk meer" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(playerName)).toBeVisible();
  await expect(dialog.getByText("Verwijderd account")).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("homepage shows a rumour from a deleted account", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/");
  const card = page
    .locator('[data-slot="card"]')
    .filter({ hasText: playerName });
  await expect(card).toBeVisible();
  await expect(card.getByText("Verwijderd account")).toBeVisible();

  expect(pageErrors).toEqual([]);
});
