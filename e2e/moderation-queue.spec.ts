import type { Browser, Page } from "@playwright/test";
import {
  expect,
  loginAs,
  seed,
  seedUsers,
  submitRumour,
  test,
  type SeedUser,
} from "./fixtures";

// Moderators approve or reject pending rumours from the queue in /admin
// (issue #66, D-012). Every decision is logged, and the author sees a
// rejection and its reason on their profile.

/**
 * A second browser session, so the author and moderator can act side by side.
 * Logging in twice is slow when the suite runs in parallel, so tests that use
 * it are marked slow.
 */
async function pageFor(browser: Browser, user: SeedUser): Promise<Page> {
  test.slow();
  const context = await browser.newContext();
  await context.route(/datadoghq\.eu/, (route) => route.abort());
  const page = await context.newPage();
  await loginAs(page, user);
  return page;
}

function queueItem(page: Page, playerName: string) {
  return page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: playerName }),
  });
}

test("the queue lists pending rumours only, oldest first", async ({ page }) => {
  await loginAs(page, "moderator");
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Beheer" })
    .getByRole("link", { name: "Moderatiewachtrij" })
    .click();
  await page.waitForURL("/admin/wachtrij");

  // The seeded pending rumour is older than any a test submits.
  const first = page
    .getByRole("list", { name: "Wachtende geruchten" })
    .getByRole("listitem")
    .first();
  await expect(first).toContainText(seed.pendingRumour.playerName);
  await expect(first).toContainText(seedUsers.jana.username);

  await expect(queueItem(page, seed.openRumour.playerName)).toHaveCount(0);
  await expect(queueItem(page, seed.rejectedRumour.playerName)).toHaveCount(0);
});

test("a moderator approves a rumour and it goes live", async ({
  page,
  browser,
}) => {
  const lastName = `Akkoord${Date.now()}`;
  const playerName = `Toon ${lastName}`;
  await loginAs(page, "tom");
  await submitRumour(page, lastName);

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/wachtrij");
  await queueItem(moderator, playerName)
    .getByRole("button", { name: "Goedkeuren" })
    .click();
  await expect(
    moderator.getByText(`Gerucht over ${playerName} goedgekeurd`),
  ).toBeVisible();
  await expect(queueItem(moderator, playerName)).toHaveCount(0);

  await page.goto("/geruchten");
  await expect(page.getByText(playerName).first()).toBeVisible();

  await page.goto("/profile");
  const item = page.getByRole("listitem").filter({ hasText: playerName });
  await expect(item.getByText("Lopend")).toBeVisible();
});

test("a moderator rejects a rumour with a reason the author sees", async ({
  page,
  browser,
}) => {
  const lastName = `Bezwaar${Date.now()}`;
  const playerName = `Toon ${lastName}`;
  const note = `Te vaag om na te gaan (${lastName})`;
  await loginAs(page, "tom");
  await submitRumour(page, lastName);

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/wachtrij");
  const item = queueItem(moderator, playerName);
  await item.getByRole("button", { name: "Afwijzen" }).click();

  const confirm = item.getByRole("button", { name: "Afwijzen bevestigen" });
  await expect(confirm).toBeDisabled();
  await item.getByLabel("Andere").check();
  // "Andere" needs a note before it can be sent.
  await expect(confirm).toBeDisabled();
  await item.getByLabel(/Toelichting voor de auteur/).fill(note);
  await confirm.click();

  await expect(
    moderator.getByText(`Gerucht over ${playerName} afgewezen`),
  ).toBeVisible();
  await expect(queueItem(moderator, playerName)).toHaveCount(0);

  // Logged with the reason as the author reads it.
  await moderator.goto("/admin/logboek");
  const row = moderator.getByRole("row").filter({ hasText: note });
  await expect(row).toContainText("Gerucht afgewezen");
  await expect(row).toContainText(`Andere: ${note}`);
  await expect(row).toContainText(seedUsers.moderator.username);

  await page.goto("/geruchten");
  await expect(page.getByText(playerName)).toHaveCount(0);

  await page.goto("/profile");
  const own = page.getByRole("listitem").filter({ hasText: playerName });
  await expect(own.getByText("Afgewezen")).toBeVisible();
  await expect(own).toContainText(`Reden: Andere — ${note}`);
});

test("a normal user gets a 404 on the moderation queue", async ({ page }) => {
  await loginAs(page, "jana");
  const response = await page.goto("/admin/wachtrij");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Moderatiewachtrij" }),
  ).toHaveCount(0);
});
