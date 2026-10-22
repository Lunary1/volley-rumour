import { createClient } from "@supabase/supabase-js";
import { expect, loginAs, seedUsers, test } from "./fixtures";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// Zoekertjes cards are headed by the ad title, with the poster as secondary
// text (#173), and open the ad's detail page, featured cards too (#172).
// Type labels differ by shape and icon, not by colour (#207).
// Every test makes its own ads and deletes them again.

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const created: string[] = [];
test.afterEach(async () => {
  if (!created.length) return;
  await admin.from("classifieds").delete().in("id", created.splice(0));
});

async function createAd(
  title: string,
  featured: boolean,
  fields: Record<string, unknown> = {},
): Promise<string> {
  const { data: club } = await admin
    .from("profiles")
    .select("id")
    .eq("username", seedUsers.club.username)
    .single();
  const { data, error } = await admin
    .from("classifieds")
    .insert({
      user_id: club!.id,
      type: "team_seeks_player",
      title,
      contact_name: "Kaartjesclub",
      team_name: "Kaartjesclub Heren A",
      position: "setter",
      province: "antwerpen",
      gender: "heren",
      division: "nat2_heren",
      description: "Aangemaakt door een test.",
      is_featured: featured,
      featured_until: featured
        ? new Date(Date.now() + 86_400_000).toISOString()
        : null,
      ...fields,
    })
    .select("id")
    .single();
  if (error) throw error;
  created.push(data.id);
  return data.id;
}

const featuredSection = (page: import("@playwright/test").Page) =>
  page.getByRole("heading", { name: "Aanbevolen" }).locator("xpath=..");

test("a featured card shows the ad title and opens the ad", async ({
  page,
}) => {
  const title = `Uitgelichte spelverdeler gezocht ${Date.now()}`;
  const id = await createAd(title, true);

  await page.goto("/zoekertjes");
  const card = featuredSection(page).locator("article", { hasText: title });
  await expect(card.getByRole("heading", { name: title })).toBeVisible();
  await expect(
    card.getByText("Kaartjesclub · Kaartjesclub Heren A"),
  ).toBeVisible();

  await card.getByRole("heading", { name: title }).click();
  await expect(page).toHaveURL(`/zoekertjes/${id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
});

test("a regular card shows the ad title and opens the ad", async ({ page }) => {
  const title = `Gewone spelverdeler gezocht ${Date.now()}`;
  const id = await createAd(title, false);

  await page.goto(`/zoekertjes?q=${encodeURIComponent(title)}`);
  const card = page.locator("article", { hasText: title });
  await expect(card.getByRole("heading", { name: title })).toBeVisible();
  await expect(
    card.getByText("Kaartjesclub · Kaartjesclub Heren A"),
  ).toBeVisible();

  await card.getByRole("heading", { name: title }).click();
  await expect(page).toHaveURL(`/zoekertjes/${id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
});

test("the contact button on a featured card doesn't open the ad", async ({
  page,
}) => {
  const title = `Uitgelicht contact ${Date.now()}`;
  await createAd(title, true);
  await loginAs(page, "tom");

  await page.goto("/zoekertjes");
  await featuredSection(page)
    .locator("article", { hasText: title })
    .getByRole("button", { name: "Contact opnemen" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL("/zoekertjes");
});

test("a card shows its type label, meta line and an outline contact button", async ({
  page,
}) => {
  const stamp = Date.now();
  const teamTitle = `Teamlabel ${stamp}`;
  const trainerTitle = `Trainerlabel ${stamp}`;
  await createAd(teamTitle, false);
  await createAd(trainerTitle, false, {
    type: "trainer_seeks_team",
    position: null,
    trainer_diploma: "trainer_b",
  });

  await page.goto(`/zoekertjes?q=${stamp}`);
  const team = page.locator("article", { hasText: teamTitle });
  const trainer = page.locator("article", { hasText: trainerTitle });

  // Team ads: a filled label; ads by a person: an outlined one.
  const teamLabel = team.locator("[data-type-label]");
  const trainerLabel = trainer.locator("[data-type-label]");
  await expect(teamLabel).toHaveText("Team zoekt speler");
  await expect(teamLabel).toHaveAttribute("data-type-label", "team");
  await expect(trainerLabel).toHaveText("Trainer zoekt team");
  await expect(trainerLabel).toHaveAttribute("data-type-label", "person");
  const fill = (label: typeof teamLabel) =>
    label.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await fill(trainerLabel)).toBe("rgba(0, 0, 0, 0)");
  expect(await fill(teamLabel)).not.toBe("rgba(0, 0, 0, 0)");

  await expect(team.getByText("Setter · Nationale 2 Heren")).toBeVisible();
  await expect(
    trainer.getByText("Trainer B · Nationale 2 Heren"),
  ).toBeVisible();

  // An outline button: green is for the featured cards and the page CTA.
  const contact = team.getByRole("button", { name: "Contact" });
  await expect(contact).toBeVisible();
  expect(
    await contact.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgba(0, 0, 0, 0)");
});

test("a featured card shows the description and no emoji", async ({ page }) => {
  const title = `Uitgelichte beschrijving ${Date.now()}`;
  await createAd(title, true);

  await page.goto("/zoekertjes");
  const card = featuredSection(page).locator("article", { hasText: title });
  await expect(card.getByText("Aangemaakt door een test.")).toBeVisible();
  await expect(card.getByText("Aanbevolen", { exact: true })).toBeVisible();
  await expect(card.locator("[data-type-label]")).toHaveText(
    "Team zoekt speler",
  );
  // The label used to be "⭐ AANBEVOLEN".
  expect(await card.textContent()).not.toContain("⭐");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a long title wraps inside the card", async ({ page }) => {
    const stamp = Date.now();
    const title = `Spelverdelerdiewekeerhebbengezocht${stamp} voor ons herenteam in Nationale 2 dat volgend seizoen hoger mikt en extra trainers zoekt`;
    await createAd(title, true);
    await createAd(title, false);

    await page.goto("/zoekertjes");
    await expect(page.getByRole("heading", { name: title })).toHaveCount(2);
    const width = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(width).toBeLessThanOrEqual(390);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a featured card still opens the ad", async ({ page }) => {
    const title = `Uitgelicht zonder JavaScript ${Date.now()}`;
    const id = await createAd(title, true);

    await page.goto("/zoekertjes");
    await featuredSection(page)
      .locator("article", { hasText: title })
      .getByRole("heading", { name: title })
      .click();
    await expect(page).toHaveURL(`/zoekertjes/${id}`);
  });
});
