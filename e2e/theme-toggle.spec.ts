import { test, expect } from "./fixtures";

// The theme toggle renders a placeholder until hydration, then cycles
// system → light → dark (#62 replaced its `mounted` effect).

test("theme toggle switches between light and dark", async ({ page }) => {
  await page.goto("/");
  const toggle = page
    .getByRole("banner")
    .getByRole("button", { name: "Thema wisselen" })
    .filter({ visible: true });

  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await expect(toggle).toHaveAttribute("title", "Schakel naar donker thema");

  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});

test("in the mobile menu the toggle shows the current theme", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/zoekertjes");
  await page.getByRole("button", { name: "Menu openen" }).click();
  const banner = page.getByRole("banner");
  const toggle = banner
    .getByRole("button", { name: /^Thema:/ })
    .filter({ visible: true });

  // A row like the links above it: label visible, icon in line with theirs.
  await expect(toggle).toHaveText("Thema: systeem");
  const icon = await toggle.locator("svg").boundingBox();
  const loginIcon = await banner
    .getByRole("button", { name: "Inloggen" })
    .filter({ visible: true })
    .locator("svg")
    .boundingBox();
  expect(Math.abs(icon!.x - loginIcon!.x)).toBeLessThanOrEqual(1);

  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await expect(toggle).toHaveText("Thema: licht");
  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(toggle).toHaveText("Thema: donker");
});
