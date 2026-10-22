import type { Locator, Page } from "@playwright/test";
import { test, expect, loginAs } from "./fixtures";

// The desktop nav sits on the page's centre, whatever the logo and the user
// menu next to it take (#228). It used to be centred between the two, so it
// moved with the width of the user menu.

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element has no box");
  return b;
}

function nav(page: Page) {
  return page
    .getByRole("banner")
    .getByRole("navigation", { name: "Hoofdmenu" });
}

async function expectNavCentred(page: Page) {
  const b = await box(nav(page));
  const pageWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  expect(Math.abs(b.x + b.width / 2 - pageWidth / 2)).toBeLessThanOrEqual(2);
}

test.use({ viewport: { width: 1280, height: 800 } });

test("the nav is centred on the page when logged out", async ({ page }) => {
  await page.goto("/zoekertjes");
  await expectNavCentred(page);
});

test("the nav is centred on the page with a staff member's user menu", async ({
  page,
}) => {
  // The moderator's menu is the widest: inbox, "Beheer", profile, name, logout.
  await loginAs(page, "moderator");
  await page.goto("/zoekertjes");
  await expectNavCentred(page);

  // At the lg breakpoint the menu is wider than its share, so the nav may
  // shift off-centre, but nothing overlaps and the page doesn't scroll sideways.
  await page.setViewportSize({ width: 1024, height: 800 });
  const banner = page.getByRole("banner");
  const logo = await box(
    banner
      .getByRole("link", { name: "VolleyRumours" })
      .filter({ visible: true }),
  );
  const menu = await box(nav(page));
  const toggle = await box(
    banner
      .getByRole("button", { name: "Thema wisselen" })
      .filter({ visible: true }),
  );
  expect(logo.x + logo.width).toBeLessThanOrEqual(menu.x);
  expect(menu.x + menu.width).toBeLessThanOrEqual(toggle.x);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  // Narrower, the nav and the menu move behind the hamburger.
  await page.setViewportSize({ width: 768, height: 800 });
  await expect(nav(page)).toBeHidden();
  await expect(
    banner.getByRole("button", { name: "Uitloggen" }).filter({ visible: true }),
  ).toHaveCount(0);
});
