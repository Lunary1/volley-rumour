import type { APIRequestContext } from "@playwright/test";
import { test, expect, seed } from "./fixtures";

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
