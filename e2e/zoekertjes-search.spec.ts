import { test, expect, seed } from "./fixtures";

// Search on /zoekertjes matches title and description, and keeps working when
// an ad has no description (issue #59).

test("search works with an ad without a description", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/zoekertjes");
  const search = page.getByPlaceholder(
    "Zoek op titel, beschrijving of auteur...",
  );
  const activeAdLink = page.locator(
    `a[href="/zoekertjes/${seed.activeAd.id}"]`,
  );
  const adWithoutDescriptionLink = page.locator(
    `a[href="/zoekertjes/${seed.adWithoutDescription.id}"]`,
  );
  await expect(adWithoutDescriptionLink).toBeVisible();

  // Only in the description of the active ad, not in any title.
  await search.fill("ervaren");
  await expect(page.getByText("1 zoekertje •")).toBeVisible();
  await expect(activeAdLink).toBeVisible();
  await expect(adWithoutDescriptionLink).toHaveCount(0);

  // Only in the title of the ad without a description.
  await search.fill("hulptrainer");
  await expect(adWithoutDescriptionLink).toBeVisible();
  await expect(activeAdLink).toHaveCount(0);

  await adWithoutDescriptionLink.click();
  await expect(page).toHaveURL(`/zoekertjes/${seed.adWithoutDescription.id}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: seed.adWithoutDescription.contactName,
    }),
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
});
