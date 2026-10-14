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
