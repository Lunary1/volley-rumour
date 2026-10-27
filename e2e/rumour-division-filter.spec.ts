import type { Page } from "@playwright/test";
import { test, expect, seed } from "./fixtures";

// Transfer Talk filters on division (#242): where a player or trainer goes,
// or where one who stops played. The homepage's Per reeks links to it.

const open = seed.openRumour.playerName; // lopend, to Nationale 1 Heren
const stops = seed.trustedSource.expiredRumour; // stops in Promo 2 Heren
const noDivision = seed.rumourWithoutCreator.playerName; // from before #67

function card(page: Page, playerName: string) {
  return page.locator('[data-slot="card"]').filter({ hasText: playerName });
}

test("the division filter combines with the status tabs", async ({ page }) => {
  await page.goto("/geruchten?status=rumour");
  await expect(card(page, noDivision)).toBeVisible();

  // The filter is a list of links, opened from its chip.
  await page.getByText("Reeks: Alle reeksen").click();
  await page
    .getByRole("navigation", { name: "Reeks" })
    .getByRole("link", { name: "Nationale 1 Heren" })
    .click();
  await expect(page).toHaveURL("/geruchten?status=rumour&reeks=nat1_heren");
  await expect(page.getByText("Reeks: Nationale 1 Heren")).toBeVisible();
  await expect(card(page, open)).toBeVisible();
  await expect(card(page, noDivision)).toHaveCount(0);

  // A status tab keeps the division.
  await page
    .getByRole("navigation", { name: "Status" })
    .getByRole("link", { name: /^Alle/ })
    .click();
  await expect(page).toHaveURL("/geruchten?reeks=nat1_heren");
  await expect(card(page, open)).toBeVisible();
});

test("a rumour about one who stops counts in their old division", async ({
  page,
}) => {
  await page.goto("/geruchten?reeks=promo2_heren");
  await expect(card(page, stops)).toBeVisible();
  await expect(card(page, open)).toHaveCount(0);

  await page.goto("/geruchten?status=rumour&reeks=promo2_heren");
  await expect(page.getByText("Geen lopende geruchten")).toBeVisible();
});

test("an unknown division is ignored", async ({ page }) => {
  await page.goto("/geruchten?reeks=onbekend");
  await expect(page.getByText("Reeks: Alle reeksen")).toBeVisible();
  await expect(card(page, open)).toBeVisible();
  await expect(card(page, noDivision)).toBeVisible();
});

test("the homepage links each division to its lopende rumours", async ({
  page,
}) => {
  await page.goto("/");
  const link = page.getByRole("link", {
    name: /^Nationale 1 Heren: \d+ gerucht(en)?$/,
  });
  await expect(link).not.toHaveAccessibleName(/: 0 /);
  await link.click();
  await expect(page).toHaveURL("/geruchten?status=rumour&reeks=nat1_heren");
  await expect(card(page, open)).toBeVisible();
});
