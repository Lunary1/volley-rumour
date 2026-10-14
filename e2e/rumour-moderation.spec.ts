import { test, expect, loginAs, seed, submitRumour } from "./fixtures";

// New rumours stay pending until a moderator approves them (issue #65).
// Pending and rejected rumours never appear on Transfer Talk or the homepage,
// not even for their author or staff; the author sees them on their profile.

const hidden = [seed.pendingRumour.playerName, seed.rejectedRumour.playerName];

async function expectOnlyApprovedRumours(
  page: import("@playwright/test").Page,
) {
  await page.goto("/geruchten");
  await expect(
    page.getByText(seed.openRumour.playerName).first(),
  ).toBeVisible();
  for (const name of hidden) await expect(page.getByText(name)).toHaveCount(0);

  await page.goto("/");
  await expect(
    page.getByText(seed.openRumour.playerName).first(),
  ).toBeVisible();
  for (const name of hidden) await expect(page.getByText(name)).toHaveCount(0);
}

test("visitors only see approved rumours", async ({ page }) => {
  await expectOnlyApprovedRumours(page);
});

test("a moderator doesn't see pending rumours on Transfer Talk", async ({
  page,
}) => {
  await loginAs(page, "moderator");
  await expectOnlyApprovedRumours(page);
});

test("the author sees their pending rumour on their profile only", async ({
  page,
}) => {
  await loginAs(page, "jana");
  await expectOnlyApprovedRumours(page);

  await page.goto("/profile");
  const item = page
    .getByRole("listitem")
    .filter({ hasText: seed.pendingRumour.playerName });
  await expect(item.getByText("Wordt nagekeken")).toBeVisible();
});

test("a submitted rumour waits for a moderator", async ({ page }) => {
  // Unique per run, so reruns against the same database don't collide.
  const lastName = `Wachtrij${Date.now()}`;

  await loginAs(page, "tom");
  await submitRumour(page, lastName);

  await page.goto("/geruchten");
  await expect(
    page.getByText(seed.openRumour.playerName).first(),
  ).toBeVisible();
  await expect(page.getByText(lastName)).toHaveCount(0);

  await page.goto("/profile");
  const item = page.getByRole("listitem").filter({ hasText: lastName });
  await expect(item.getByText("Wordt nagekeken")).toBeVisible();
});
