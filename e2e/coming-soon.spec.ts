import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// The coming-soon homepage (#229), rendered by the test-only route
// app/e2e-binnenkort: the e2e build has coming-soon mode off.

const PATH = "/e2e-binnenkort";

function volleyball(page: Page) {
  return page.locator("[data-volleyball]");
}

async function canvasShot(page: Page) {
  return volleyball(page).locator("canvas").screenshot({ animations: "allow" });
}

test("counts down to the launch and shows a turning volleyball", async ({
  page,
}) => {
  await page.goto(PATH);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Dé community voor Belgische volleybaltransfers",
    }),
  ).toBeVisible();
  await expect(page.getByText("Lancering op 15 februari 2027")).toBeVisible();

  const timer = page.getByRole("timer", { name: "Tijd tot de lancering" });
  await expect(timer).toContainText("Dagen");
  await expect(timer).not.toContainText("--");

  // The ball's box is in the server HTML at its final size, so the page
  // doesn't move when three.js arrives.
  // three.js waits for the first pointer move (or 4 s after load).
  const before = await volleyball(page).boundingBox();
  await page.mouse.move(10, 10);
  await expect(volleyball(page)).toHaveAttribute("data-volleyball", "ready", {
    timeout: 10_000,
  });
  expect(await volleyball(page).boundingBox()).toEqual(before);

  // It moves: two frames apart differ.
  const first = await canvasShot(page);
  await page.waitForTimeout(400);
  expect((await canvasShot(page)).equals(first)).toBe(false);
});

test("joins the waitlist", async ({ page }) => {
  await page.goto(PATH);
  await page
    .getByPlaceholder("jouw@email.be")
    .fill(`wachtlijst-${Date.now()}@example.test`);
  await page.getByRole("button", { name: "Inschrijven" }).click();
  await expect(
    page.getByText("Bedankt! Je hoort van ons bij de lancering."),
  ).toBeVisible();
});

test.describe("on a phone with reduced motion", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test("the ball stands still and nothing scrolls sideways", async ({
    page,
  }) => {
    await page.goto(PATH);
    await page.mouse.move(10, 10);
    await expect(volleyball(page)).toHaveAttribute("data-volleyball", "ready", {
      timeout: 10_000,
    });

    const first = await canvasShot(page);
    await page.waitForTimeout(400);
    expect((await canvasShot(page)).equals(first)).toBe(true);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});
