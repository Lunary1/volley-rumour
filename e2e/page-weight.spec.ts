import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect, loginAs, seed, seedUsers } from "./fixtures";

// Page weight (#199): the Supabase browser library loads on demand, not with
// the page, and the icons are small files. The rumour and zoekertje cards
// render on the server, and their dialogs load when first opened (#200).

/** The code of every script in a page's server-rendered HTML. */
async function firstLoadScripts(request: APIRequestContext, path: string) {
  const html = await (await request.get(path)).text();
  const scripts = [
    ...html.matchAll(/<script[^>]+src="([^"]+\.js)"(?![^>]*noModule)/g),
  ].map((match) => match[1]);
  expect(scripts.length).toBeGreaterThan(0);
  return Promise.all(
    scripts.map(async (src) => ({
      src,
      body: await (await request.get(src)).text(),
    })),
  );
}

const pages = [
  "/",
  "/zoekertjes",
  `/zoekertjes/${seed.activeAd.id}`,
  "/privacy",
];

for (const path of pages) {
  test(`${path} doesn't ship the Supabase library in its first load`, async ({
    request,
  }) => {
    for (const { src, body } of await firstLoadScripts(request, path)) {
      expect(body, src).not.toContain("GoTrueClient");
    }
  });
}

// Text that only the server-rendered cards or the on-demand dialogs contain.
const notInFirstLoad: Record<string, string[]> = {
  // the rumour card, the detail dialog, the report form
  "/": ["een officiële bron", "Bekijk bron", "Melding versturen"],
  "/geruchten": ["een officiële bron", "Bekijk bron", "Melding versturen"],
  // the zoekertjes list, the contact form
  "/zoekertjes": ["Alle zoekertjes", "Stuur je eerste bericht"],
};

for (const [path, texts] of Object.entries(notInFirstLoad)) {
  test(`${path} renders its cards on the server and loads dialogs on demand`, async ({
    request,
  }) => {
    for (const { src, body } of await firstLoadScripts(request, path)) {
      for (const text of texts) expect(body, src).not.toContain(text);
    }
  });
}

test("icons are small, purpose-sized files", async ({ request }) => {
  const html = await (await request.get("/privacy")).text();
  const icons = [
    ...html.matchAll(/<link[^>]+rel="(?:icon|apple-touch-icon)"[^>]*>/g),
  ].map((match) => match[0].match(/href="([^"?]+)/)![1]);
  expect(icons).toEqual(["/icon.png", "/icon-dark.png", "/apple-icon.png"]);

  for (const href of icons) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
    expect((await response.body()).length, href).toBeLessThan(10 * 1024);
  }
});

/** Records whether the page has loaded the Supabase library by now. */
function watchSupabaseLibrary(page: Page) {
  const loaded: string[] = [];
  page.on("response", async (response) => {
    if (!response.url().endsWith(".js")) return;
    const body = await response.text().catch(() => "");
    if (body.includes("GoTrueClient")) loaded.push(response.url());
  });
  return loaded;
}

// After the first load (#221): a visitor without a session doesn't load the
// library for the header, and the live vote counts wait until the rumour
// cards are near the screen.
test("a visitor's phone loads the Supabase library only once the rumours are in view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const loaded = watchSupabaseLibrary(page);
  await page.goto("/");
  const voteBar = page.locator("[data-live-votes]").first();
  await expect(voteBar).toBeAttached();
  await expect(voteBar).not.toBeInViewport();

  // Longer than whenIdle()'s 3 s timeout, so anything waiting for idle ran.
  await page.waitForTimeout(4000);
  expect(loaded).toEqual([]);

  await voteBar.scrollIntoViewIfNeeded();
  await expect.poll(() => loaded.length).toBeGreaterThan(0);
});

test("logging in in another tab shows in this tab when it's shown again", async ({
  page,
  context,
}) => {
  await page.goto("/over-ons");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Inloggen" }),
  ).toBeVisible();

  const other = await context.newPage();
  await loginAs(other, "jana");
  await other.close();

  // Switching back to a tab fires visibilitychange; headless tabs never
  // become hidden, so send it by hand.
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(
    page.getByRole("banner").getByText(seedUsers.jana.username),
  ).toBeVisible();
});
