import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Category badges on rumour and transfer cards are readable in both themes
// (#174): the "Trainer Transfer" badge used light mode's --accent, a
// near-white background colour, as its text colour. The seed has a rumour of
// three categories and two transfer types.

const AA = 4.5;

/**
 * The badge's text colour and the colour behind it, both as sRGB. The browser
 * paints them: the badge's background is translucent, so the backgrounds of
 * its ancestors are painted first, up to the first opaque one.
 */
async function colours(badge: Locator) {
  return badge.evaluate((el) => {
    const layers: string[] = [];
    for (let node: Element | null = el; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      layers.unshift(bg);
      const probe = document.createElement("canvas").getContext("2d")!;
      probe.fillStyle = bg;
      probe.fillRect(0, 0, 1, 1);
      if (probe.getImageData(0, 0, 1, 1).data[3] === 255) break;
    }
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 1, 1);
    for (const layer of layers) {
      ctx.fillStyle = layer;
      ctx.fillRect(0, 0, 1, 1);
    }
    const background = Array.from(
      ctx.getImageData(0, 0, 1, 1).data.slice(0, 3),
    );
    ctx.fillStyle = getComputedStyle(el).color;
    ctx.fillRect(0, 0, 1, 1);
    const text = Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
    return { text, background };
  });
}

function luminance([r, g, b]: number[]) {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(a: number[], b: number[]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function badge(page: Page, label: string) {
  return page
    .locator('[data-slot="badge"]')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .first();
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => {
        localStorage.setItem("theme", t);
      }, theme);
    });

    test("rumour category badges meet AA contrast and stay distinct", async ({
      page,
    }) => {
      await page.goto("/geruchten");
      await expect(page.locator("html")).toHaveClass(
        new RegExp(`\\b${theme}\\b`),
      );

      const measured: Record<string, { text: number[]; background: number[] }> =
        {};
      for (const label of ["Transfer", "Trainer Transfer", "Speler Stopt"]) {
        const el = badge(page, label);
        await expect(el).toBeVisible();
        measured[label] = await colours(el);
        const ratio = contrast(
          measured[label].text,
          measured[label].background,
        );
        expect(ratio, `${label}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
          AA,
        );
      }
      expect(measured["Trainer Transfer"].text).not.toEqual(
        measured["Transfer"].text,
      );
    });

    test("transfer type badges meet AA contrast", async ({ page }) => {
      await page.goto("/transfers");
      await expect(page.locator("html")).toHaveClass(
        new RegExp(`\\b${theme}\\b`),
      );

      for (const label of ["Trainer", "Speelster"]) {
        const el = badge(page, label);
        await expect(el).toBeVisible();
        const { text, background } = await colours(el);
        const ratio = contrast(text, background);
        expect(ratio, `${label}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
          AA,
        );
      }
    });
  });
}
