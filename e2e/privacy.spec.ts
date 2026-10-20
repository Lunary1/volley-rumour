import { test, expect, loginAs } from "./fixtures";

// The privacy page lists every processor, and the site loads nothing from
// services it doesn't list (#77). Datadog is gone (D-023).

test("privacy page lists every processor and how long data is kept", async ({
  page,
}) => {
  await page.goto("/privacy");

  const processors = page
    .getByRole("heading", { name: "Wie verwerkt je gegevens" })
    .locator("..");
  for (const name of ["Supabase", "Vercel", "Resend", "Google"]) {
    await expect(
      processors.getByRole("listitem").filter({ hasText: `${name}:` }),
    ).toBeVisible();
  }

  const retention = page
    .getByRole("heading", { name: "Hoe lang we je gegevens bewaren" })
    .locator("..");
  await expect(
    retention.getByText("Logboek van moderatoracties"),
  ).toBeVisible();
  await expect(retention.getByText(/Wachtlijst/)).toBeVisible();
  await expect(
    retention.getByText(
      /Verwijderverzoeken en contactberichten:\s+12\s+maanden/,
    ),
  ).toBeVisible();
  // Withdrawn rumours (#192, D-042).
  await expect(
    retention.getByText(/Ingetrokken geruchten:.*12\s+maanden/),
  ).toBeVisible();

  await expect(page.getByText(/datadog|session replay/i)).toHaveCount(0);
});

test("pages load nothing from third-party hosts", async ({ page }) => {
  const appHost = new URL(test.info().project.use.baseURL!).hostname;
  const thirdParty: string[] = [];
  page.on("request", (request) => {
    const { protocol, hostname } = new URL(request.url());
    // The local Supabase API runs on 127.0.0.1 too.
    if (
      protocol.startsWith("http") &&
      ![appHost, "localhost", "127.0.0.1"].includes(hostname)
    ) {
      thirdParty.push(request.url());
    }
  });

  await page.goto("/");
  await page.goto("/privacy");
  // Logged in, the header subscribes to Realtime and loads the inbox count.
  await loginAs(page, "jana");
  await page.goto("/messages");
  await page.waitForLoadState("networkidle");

  expect(thirdParty).toEqual([]);
});
