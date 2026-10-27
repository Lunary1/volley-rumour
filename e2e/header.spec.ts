import type { Locator, Page } from "@playwright/test";
import { test, expect, loginAs, seedUsers } from "./fixtures";

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

// The user card: avatar and name on one line, a long name cut off with an
// ellipsis (#258). Usernames can be 30 characters (#89); the seeded ones are
// short, so the test swaps in the widest 30-character name.
const longName = "w".repeat(30);

function userCard(page: Page) {
  return page
    .getByRole("banner")
    .locator(`[title="${seedUsers.moderator.username}"]`)
    .filter({ visible: true });
}

async function useLongName(page: Page) {
  await userCard(page)
    .locator("p")
    .evaluate((p, name) => (p.textContent = name), longName);
}

async function expectCutOff(page: Page) {
  const name = userCard(page).locator("p");
  const cut = await name.evaluate((p) => ({
    lines: Math.round(p.getBoundingClientRect().height),
    lineHeight: parseFloat(getComputedStyle(p).lineHeight),
    overflows: p.scrollWidth > p.clientWidth,
    ellipsis: getComputedStyle(p).textOverflow,
  }));
  expect(cut.lines).toBeLessThanOrEqual(Math.ceil(cut.lineHeight));
  expect(cut.overflows).toBe(true);
  expect(cut.ellipsis).toBe("ellipsis");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("in the mobile menu the avatar sits beside the name, and a long name is cut off", async ({
  page,
}) => {
  await loginAs(page, "moderator");
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/zoekertjes");
  await page.getByRole("button", { name: "Menu openen" }).click();

  const card = userCard(page);
  const avatar = await box(card.locator('[data-slot="avatar"]'));
  const name = await box(card.locator("p"));
  // One line: the name's middle at the avatar's middle, to its right.
  expect(
    Math.abs(avatar.y + avatar.height / 2 - (name.y + name.height / 2)),
  ).toBeLessThanOrEqual(2);
  expect(avatar.x + avatar.width).toBeLessThanOrEqual(name.x);
  // The avatar lines up with the icons of the links above it.
  const icon = await box(
    page
      .getByRole("banner")
      .getByRole("link", { name: "Profiel" })
      .filter({ visible: true })
      .locator("svg"),
  );
  expect(Math.abs(avatar.x - icon.x)).toBeLessThanOrEqual(1);

  await useLongName(page);
  await expectCutOff(page);
  const cardBox = await box(card);
  const cutName = await box(card.locator("p"));
  expect(cutName.x + cutName.width).toBeLessThanOrEqual(
    cardBox.x + cardBox.width,
  );
});

test("on desktop a long name is cut off and the user menu stays clear of the nav", async ({
  page,
}) => {
  await loginAs(page, "moderator");
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/zoekertjes");
  await useLongName(page);
  await expectCutOff(page);

  const toggle = await box(
    page
      .getByRole("banner")
      .getByRole("button", { name: "Thema wisselen" })
      .filter({ visible: true }),
  );
  const menu = await box(nav(page));
  expect(menu.x + menu.width).toBeLessThanOrEqual(toggle.x);
});
