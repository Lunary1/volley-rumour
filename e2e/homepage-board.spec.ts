import { test, expect, seed } from "./fixtures";

// The homepage's transfer board, zoekertjes and divisions (#240).

test("the transfer board links each rumour to its page", async ({ page }) => {
  await page.goto("/");
  const board = page.getByRole("region", { name: "Transferbord" });
  const rows = board.getByRole("listitem");
  await expect(rows).toHaveCount(8);

  // Every row with a rumour says what voters think and what its status is.
  const first = rows.first().getByRole("link");
  await expect(first).toHaveAttribute("href", /^\/geruchten\/[0-9a-f-]{36}$/);
  await expect(first).toContainText(
    /Lopend|Bevestigd|Ontkracht|Niet bevestigd/,
  );
  await expect(first).toContainText(/% van de stemmers|Nog geen stemmen/);

  const player = (await first
    .locator("span.truncate.font-semibold")
    .textContent())!;
  await first.click();
  await expect(page).toHaveURL(/\/geruchten\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: `Gerucht: ${player}` }),
  ).toBeAttached();
});

test("each division links to its zoekertjes, with how many there are", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Nu op de markt" }).getByRole("link", {
      name: new RegExp(seed.activeAd.title),
    }),
  ).toBeVisible();

  // The seed's setter ad is in Nationale 2 Heren. Its rumour count beside it
  // is in rumour-division-filter.spec.ts (#242).
  const division = page.getByRole("link", {
    name: /^Nationale 2 Heren: \d+ zoekertjes?$/,
  });
  await expect(division).not.toHaveAccessibleName(/: 0 /);
  await division.click();
  await expect(page).toHaveURL("/zoekertjes?reeks=nat2_heren");
  await expect(
    page.locator(`a[href="/zoekertjes/${seed.activeAd.id}"]`),
  ).toBeVisible();
});

test("nothing on the homepage moves by itself", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const looping = await page.evaluate(
    () =>
      [...document.querySelectorAll("*")].filter((el) => {
        const style = getComputedStyle(el);
        return (
          style.animationName !== "none" &&
          style.animationIterationCount === "infinite"
        );
      }).length,
  );
  expect(looping).toBe(0);
});
