import type { Page } from "@playwright/test";
import { test, expect, loginAs, seed, seedUsers } from "./fixtures";

// The homepage streams (#211): the hero goes out at once, each section
// follows with its own data, and its skeleton has the same size, so nothing
// moves when the content arrives.

const HERO = "Het centrum voor";

/**
 * The homepage's HTML as the chunks arrive, fetched with the page's cookies,
 * so it is the same request a logged-in browser makes.
 */
async function homepageChunks(page: Page): Promise<string[]> {
  const cookies = await page.context().cookies();
  const response = await fetch(new URL("/", page.url()), {
    headers: {
      cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    },
  });
  expect(response.status).toBe(200);

  const chunks: string[] = [];
  const decoder = new TextDecoder();
  const reader = response.body!.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }
  return chunks;
}

test("the hero is sent before the hot topics, which wait for the user's votes", async ({
  page,
}) => {
  await loginAs(page, "jana");
  const chunks = await homepageChunks(page);

  const hero = chunks.findIndex((chunk) => chunk.includes(HERO));
  const hotTopic = chunks.findIndex((chunk) =>
    chunk.includes(seed.openRumour.playerName),
  );
  expect(hero).toBeGreaterThanOrEqual(0);
  expect(hotTopic).toBeGreaterThan(hero);
});

/** The page's cumulative layout shift so far, as Lighthouse counts it. */
async function layoutShift(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        // Buffered entries are delivered before the next frame.
        requestAnimationFrame(() => setTimeout(() => resolve(total), 0));
      }),
  );
}

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1350, height: 940 },
]) {
  test(`nothing moves while the homepage loads (${viewport.name})`, async ({
    page,
  }) => {
    // Logged in, the header and the hot topics wait for Supabase Auth, so
    // their skeletons are on screen first.
    await loginAs(page, "jana");
    await page.setViewportSize(viewport);
    await page.reload();

    await expect(page.getByText(seedUsers.bron.username)).toBeVisible();
    await expect(page.getByText("Actieve geruchten")).toBeVisible();
    await expect(
      page.getByText(seed.openRumour.playerName).first(),
    ).toBeVisible();
    await page.waitForLoadState("load");

    expect(await layoutShift(page)).toBe(0);
  });
}

test("the homepage preloads one web font", async ({ request }) => {
  const response = await request.get("/");
  const html = await response.text();
  const fonts = new Set(
    [
      ...(response.headers()["link"] ?? "").matchAll(
        /<([^>]+\.woff2)>; rel=preload/g,
      ),
      ...html.matchAll(/<link rel="preload" href="([^"]+\.woff2)"/g),
    ].map((match) => match[1]),
  );
  // Inter; reference codes use the system's monospace font.
  expect(fonts.size).toBe(1);

  const css = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/);
  const stylesheet = await (await request.get(css![1])).text();
  expect(stylesheet).not.toContain("Space Grotesk");
});
