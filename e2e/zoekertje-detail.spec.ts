import { test, expect, seed, seedUsers, SEED_PASSWORD } from "./fixtures";

// The detail page is about the ad, not the poster (issue #108).

test("zoekertje detail uses the ad title and shows the contact name", async ({
  page,
}) => {
  const ad = seed.adWithoutDescription;
  await page.goto(`/zoekertjes/${ad.id}`);

  await expect(
    page.getByRole("heading", { level: 1, name: ad.title }),
  ).toBeVisible();
  await expect(page).toHaveTitle(`${ad.title} | Zoekertjes`);
  await expect(page.getByText(`Contact: ${ad.contactName}`)).toBeVisible();
});

test("team zoekertje shows the team name once", async ({ page }) => {
  const ad = seed.activeAd;
  await page.goto(`/zoekertjes/${ad.id}`);

  await expect(
    page.getByRole("heading", { level: 1, name: ad.title }),
  ).toBeVisible();
  // The team is the contact, so there's no separate contact line.
  await expect(page.getByText(ad.contactName, { exact: true })).toHaveCount(1);
  await expect(page.getByText(/^Contact:/)).toHaveCount(0);
});

test("sharing a zoekertje uses the ad title", async ({ page }) => {
  // Force the desktop fallback and capture the WhatsApp link.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
    const opened: string[] = [];
    (window as unknown as { opened: string[] }).opened = opened;
    window.open = (url) => {
      opened.push(String(url));
      return null;
    };
  });

  const ad = seed.activeAd;
  await page.goto(`/zoekertjes/${ad.id}`);
  await page.getByRole("button", { name: "Delen" }).click();
  await page.getByRole("button", { name: "Deel via WhatsApp" }).click();

  const opened = await page.evaluate(
    () => (window as unknown as { opened: string[] }).opened,
  );
  expect(opened).toHaveLength(1);
  const text = new URL(opened[0]).searchParams.get("text");
  expect(text).toContain(`Bekijk dit zoekertje op VolleyRumours: ${ad.title}`);
  expect(text).toContain(`/zoekertjes/${ad.id}`);
});

test("logged-out contact goes to login and back to the ad (#86)", async ({
  page,
}) => {
  const ad = seed.activeAd;
  await page.goto(`/zoekertjes/${ad.id}`);
  await page.getByRole("link", { name: "Contact opnemen" }).click();

  // No message form before login: straight to the login page.
  await page.waitForURL(
    `/auth/login?next=${encodeURIComponent(`/zoekertjes/${ad.id}`)}`,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByLabel("E-mailadres").fill(seedUsers.tom.email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(SEED_PASSWORD);
  await page
    .locator("form")
    .getByRole("button", { name: "Inloggen", exact: true })
    .click();

  await page.waitForURL(`/zoekertjes/${ad.id}`);
  // Tom has no conversation about this ad yet, so the message form opens.
  await page.getByRole("button", { name: "Contact opnemen" }).click();
  await expect(
    page.getByRole("dialog", { name: "Contact vc_testdorp" }),
  ).toBeVisible();
});
