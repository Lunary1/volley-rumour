import { expect, loginAs, seed, seedUsers, test } from "./fixtures";
import type { Page } from "@playwright/test";

// Search and share basics (#99): robots.txt, a sitemap of public content only,
// Dutch titles, share images, and rumour pages that can be shared but are
// never indexed (D-035).

function meta(page: Page, selector: string) {
  return page.locator(`head meta[${selector}]`).first();
}

/** Fetches the page's og:image and checks it is a PNG. */
async function expectShareImage(page: Page) {
  const url = await meta(page, 'property="og:image"').getAttribute("content");
  expect(url).toBeTruthy();
  // The tags carry the canonical domain; fetch the image from this server.
  const { pathname, search } = new URL(url!);
  const response = await page.request.get(pathname + search);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
}

test("robots.txt keeps crawlers out of private pages and names the sitemap", async ({
  request,
}) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  const body = await response.text();
  for (const path of ["/admin", "/messages", "/profile", "/zoekertjes/mijn"]) {
    expect(body).toContain(`Disallow: ${path}`);
  }
  expect(body).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
});

test("the sitemap lists public pages and online zoekertjes, never rumours", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toMatch(/<loc>[^<]*\/zoekertjes<\/loc>/);
  expect(body).toMatch(/<loc>[^<]*\/privacy<\/loc>/);
  expect(body).toContain(`/zoekertjes/${seed.activeAd.id}</loc>`);
  expect(body).not.toContain(seed.inactiveAd.id);
  // /geruchten itself is listed, no single rumour is.
  expect(body).not.toMatch(/\/geruchten\/[^<]/);
  expect(body).not.toMatch(/\/(admin|messages|profile)/);
});

test("a zoekertje has a Dutch title, a description and a share image", async ({
  page,
}) => {
  await page.goto(`/zoekertjes/${seed.activeAd.id}`);
  await expect(page).toHaveTitle(
    `${seed.activeAd.title} | Zoekertjes | VolleyRumours`,
  );
  await expect(meta(page, 'name="description"')).toHaveAttribute(
    "content",
    /^Team zoekt speler/,
  );
  await expect(meta(page, 'property="og:title"')).toHaveAttribute(
    "content",
    new RegExp(seed.activeAd.title),
  );
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
  await expectShareImage(page);
});

test("list pages have their own title and description", async ({ page }) => {
  await page.goto("/geruchten");
  await expect(page).toHaveTitle("Transfer Talk | VolleyRumours");
  await expect(meta(page, 'name="description"')).toHaveAttribute(
    "content",
    /transfermarkt/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/geruchten$/,
  );
  await expectShareImage(page);
});

test("a rumour has its own page with a share image, but noindex", async ({
  page,
}) => {
  await page.goto(`/geruchten/${seed.openRumour.id}`);
  await expect(
    page.getByText(seed.openRumour.playerName).first(),
  ).toBeVisible();
  await expect(page).toHaveTitle(
    `${seed.openRumour.playerName} van VC Testdorp naar Volley Voorbeeld? | VolleyRumours`,
  );
  await expect(meta(page, 'name="robots"')).toHaveAttribute(
    "content",
    /noindex/,
  );
  // The author's name is on the page, but not in what a share shows.
  await expect(meta(page, 'property="og:description"')).not.toHaveAttribute(
    "content",
    new RegExp(seedUsers.jana.username),
  );
  await expectShareImage(page);
});

test("a pending rumour has no page, not even for its author", async ({
  page,
}) => {
  const visitor = await page.request.get(`/geruchten/${seed.pendingRumour.id}`);
  expect(visitor.status()).toBe(404);
  const image = await page.request.get(
    `/geruchten/${seed.pendingRumour.id}/opengraph-image`,
  );
  expect(image.status()).toBe(404);

  await loginAs(page, "jana");
  const response = await page.goto(`/geruchten/${seed.pendingRumour.id}`);
  expect(response?.status()).toBe(404);
});

test("sharing a rumour links to its own page", async ({ page }) => {
  // Catch what the share sheet would get.
  await page.addInitScript(() => {
    const shared: ShareData[] = [];
    Object.assign(window, { __shared: shared });
    navigator.share = async (data?: ShareData) => {
      if (data) shared.push(data);
    };
  });
  await page.goto("/geruchten");
  await page
    .locator('[data-slot="card"]')
    .filter({
      has: page.getByRole("heading", { name: seed.openRumour.playerName }),
    })
    .getByRole("button", { name: "Bekijk meer" })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Delen" }).click();
  const shared = await page.evaluate(
    () => (window as unknown as { __shared: ShareData[] }).__shared,
  );
  expect(shared[0]?.url).toMatch(
    new RegExp(`/geruchten/${seed.openRumour.id}$`),
  );
});

test("private pages are noindex", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page).toHaveTitle("Inloggen | VolleyRumours");
  await expect(meta(page, 'name="robots"')).toHaveAttribute(
    "content",
    /noindex/,
  );
});
