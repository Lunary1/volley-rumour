import { test, expect, seed } from "./fixtures";

// Page weight (#199): the Supabase browser library loads on demand, not with
// the page, and the icons are small files.

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
    const html = await (await request.get(path)).text();
    const scripts = [
      ...html.matchAll(/<script[^>]+src="([^"]+\.js)"(?![^>]*noModule)/g),
    ].map((match) => match[1]);
    expect(scripts.length).toBeGreaterThan(0);

    for (const src of scripts) {
      const body = await (await request.get(src)).text();
      expect(body, src).not.toContain("GoTrueClient");
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
