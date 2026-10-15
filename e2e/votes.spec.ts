import type { Page } from "@playwright/test";
import { test, expect, loginAs, seed } from "./fixtures";

// Votes on rumours. The page loads the user's votes in one query and hands
// them to the cards (#129): cards no longer call a server action each on
// mount, which queued every other action behind them.

/** A rumour's card on Transfer Talk or the homepage. */
function rumourCard(page: Page, playerName: string) {
  return page.locator('[data-slot="card"]').filter({ hasText: playerName });
}

/** Counts the server actions the page sends from now on. */
function countServerActions(page: Page) {
  const actions: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) {
      actions.push(request.url());
    }
  });
  return actions;
}

test("a user's votes come with the page, without a server action per card", async ({
  page,
}) => {
  // speler_jana voted "niet waar" on Sara Steekproef in the seed.
  await loginAs(page, "jana");
  const actions = countServerActions(page);

  await page.goto("/geruchten");
  const sara = rumourCard(page, seed.rumourWithoutSource.playerName);
  await expect(
    sara.getByRole("button", { name: /^Niet waar/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(sara.getByRole("button", { name: /^Waar/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(
    rumourCard(page, seed.openRumour.playerName).getByRole("button", {
      name: /^Waar/,
    }),
  ).toHaveAttribute("aria-pressed", "false");

  await page.waitForLoadState("networkidle");
  expect(actions).toEqual([]);
});

test("a vote on Transfer Talk is saved and shows on the homepage", async ({
  page,
}) => {
  // volle_wachtrij hasn't voted in the seed; global-setup.ts removes the vote
  // this test casts.
  await loginAs(page, "wachtrij");
  await page.goto("/geruchten");
  const card = rumourCard(page, seed.openRumour.playerName);
  const up = card.getByRole("button", { name: /^Waar/ });
  await expect(up).toHaveAttribute("aria-pressed", "false");
  await expect(up).toHaveText("Waar2");

  // The card counts the vote before the server has it; reloading earlier
  // would cancel the request.
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      !!response.request().headers()["next-action"],
  );
  await up.click();
  await expect(up).toHaveAttribute("aria-pressed", "true");
  await expect(up).toHaveText("Waar3");
  await saved;

  await page.reload();
  await expect(up).toHaveAttribute("aria-pressed", "true");
  await expect(up).toHaveText("Waar3");

  // Pieter Proefspeler has the most "waar" votes of the open rumours, so he
  // is one of the homepage's hot topics.
  await page.goto("/");
  await expect(
    rumourCard(page, seed.openRumour.playerName).getByRole("button", {
      name: /^Waar/,
    }),
  ).toHaveAttribute("aria-pressed", "true");
});
