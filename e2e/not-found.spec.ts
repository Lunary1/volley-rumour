import { test, expect, seed } from "./fixtures";

// #90: unknown URLs and ads that are gone show a Dutch page with links back,
// not Next's English 404.

test("an unknown URL shows the Dutch 404 page", async ({ page }) => {
  const response = await page.goto("/bestaat-niet");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Pagina niet gevonden | VolleyRumours");
  await expect(
    page.getByRole("heading", { level: 1, name: "Pagina niet gevonden" }),
  ).toBeVisible();
  await expect(page.getByText("This page could not be found")).toHaveCount(0);

  await page.getByRole("link", { name: "Naar de startpagina" }).click();
  await expect(page).toHaveURL("/");
});

test("an ad that is gone or never existed says so in Dutch", async ({
  page,
}) => {
  for (const id of [
    seed.inactiveAd.id,
    "00000000-0000-0000-0000-000000000000",
    "geen-uuid",
  ]) {
    const response = await page.goto(`/zoekertjes/${id}`);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Zoekertje niet beschikbaar",
      }),
    ).toBeVisible();
  }

  await page.getByRole("link", { name: "Bekijk alle zoekertjes" }).click();
  await expect(page).toHaveURL("/zoekertjes");
  await expect(
    page.getByRole("heading", { name: "Alle zoekertjes" }),
  ).toBeVisible();
});
