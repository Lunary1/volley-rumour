import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// The Transfer Talk pages and `/zoekertjes` share the header's content column
// (#243, #255). They used Tailwind's `container`, which is narrower than the
// header between 1024 and 1280px and wider from 1536px.

const PAGES = [
  "/geruchten",
  "/transfers",
  "/betrouwbare-bronnen",
  "/zoekertjes",
];

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element has no box");
  return b;
}

// The left edge of the header's content column, where the logo starts.
async function headerLeft(page: Page) {
  const logo = page
    .getByRole("banner")
    .getByRole("link", { name: "VolleyRumours" })
    .filter({ visible: true })
    .first();
  return (await box(logo)).x;
}

// Where the page's content column starts. Every column is centred, so the
// same left edge means the same width.
async function contentLeft(page: Page) {
  return (await box(page.getByRole("heading", { level: 1 }))).x;
}

for (const width of [1024, 1440, 1700]) {
  test(`the listing pages line up with the header at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of PAGES) {
      await page.goto(path);
      const offset = (await contentLeft(page)) - (await headerLeft(page));
      expect(Math.abs(offset), path).toBeLessThanOrEqual(1);
    }
  });
}

test("the listing pages keep a 16px gutter on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const path of PAGES) {
    await page.goto(path);
    expect(Math.round(await contentLeft(page)), path).toBe(16);
    const scrollsSideways = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(scrollsSideways, path).toBe(false);
  }
});
