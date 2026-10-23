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

test("counts down to the launch and shows a moving volleyball", async ({
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

test("the ball is a keep-up game, by click and by keyboard", async ({
  page,
}) => {
  await page.goto(PATH);
  await page.mouse.move(10, 10);
  await expect(volleyball(page)).toHaveAttribute("data-volleyball", "ready", {
    timeout: 10_000,
  });
  const score = page.getByTestId("hooghouden-score");
  await expect(score).toHaveText("Hou de bal hoog: tik erop");

  // A click on the ball knocks it up; the run ends when it lands.
  await volleyball(page).click();
  await expect(score).toHaveText("1 keer hoog");
  await expect(score).toHaveText("Nieuw record: 1 keer hoog", {
    timeout: 5_000,
  });

  // Space on the focused ball does the same.
  const ball = page.getByRole("button", { name: "Bal hooghouden" });
  await ball.focus();
  await page.keyboard.press("Space");
  await expect(score).toHaveText("1 keer hoog · record 1");
});

test("the example rumour walks through its steps", async ({ page }) => {
  await page.goto(PATH);
  const steps = page.getByRole("listitem").getByRole("button");
  const card = page
    .locator("[data-slot=card]")
    .filter({ hasText: "Voorbeeld" });
  await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText("Wordt nagekeken");
  // It moves on by itself while on screen.
  await expect(card).toContainText("Lopend", { timeout: 6_000 });
  // A click shows a step.
  await steps.filter({ hasText: "Bevestigd of ontkracht" }).click();
  await expect(card).toContainText("Bevestigd");
  await expect(
    steps.filter({ hasText: "Bevestigd of ontkracht" }),
  ).toHaveAttribute("aria-current", "step");
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

    // No game, no moving band, no card changing by itself.
    await expect(
      page.getByRole("button", { name: "Bal hooghouden" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("hooghouden-score")).toBeEmpty();
    const band = page
      .getByRole("region", { name: "Voorbeelden van zoekertjes" })
      .locator("div")
      .first();
    expect(
      await band.evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    const card = page
      .locator("[data-slot=card]")
      .filter({ hasText: "Voorbeeld" });
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(4_500);
    await expect(card).toContainText("Wordt nagekeken");

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});
