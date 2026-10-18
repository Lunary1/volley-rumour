import { createClient } from "@supabase/supabase-js";
import { expect, loginAs, seedUsers, test, type SeedUser } from "./fixtures";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// Zoekertjes expire on the next 31 August, at least 30 days after posting,
// and the owner renews them (issue #84, D-024). Offline ads are visible only
// to their owner and staff, and contact goes through messaging (#83, D-022).
// Every test makes its own ads and deletes them again.

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const created: string[] = [];
test.afterEach(async () => {
  if (!created.length) return;
  const ids = created.splice(0);
  await admin.from("conversations").delete().in("ad_id", ids);
  await admin.from("classifieds").delete().in("id", ids);
});

async function userId(user: SeedUser): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("username", seedUsers[user].username)
    .single();
  return data!.id;
}

/** Inserts a team's ad for `user` and returns its id. */
async function createAd(
  user: SeedUser,
  title: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await admin
    .from("classifieds")
    .insert({
      user_id: await userId(user),
      type: "team_seeks_player",
      title,
      contact_name: title,
      team_name: title,
      position: "setter",
      gender: "heren",
      division: "nat2_heren",
      province: "antwerpen",
      description: "Aangemaakt door een test.",
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  created.push(data.id);
  return data.id;
}

const yesterday = () => new Date(Date.now() - 86_400_000).toISOString();

test("an expired ad leaves the list until its owner renews it", async ({
  page,
}) => {
  const title = `Verlopen ${Date.now()}`;
  const id = await createAd("club", title, { expires_at: yesterday() });

  // Visitors find it neither in the list nor on its own page.
  await page.goto("/zoekertjes");
  await expect(
    page.getByRole("heading", { name: "Alle zoekertjes" }),
  ).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
  const response = await page.goto(`/zoekertjes/${id}`);
  expect(response?.status()).toBe(404);

  // The owner sees it as expired and renews it.
  await loginAs(page, "club");
  await page.goto(`/zoekertjes/${id}`);
  await expect(page.getByText(/Je zoekertje is verlopen op/)).toBeVisible();

  await page.goto("/zoekertjes/mijn");
  const ad = page.getByTestId("my-classified").filter({
    has: page.getByRole("heading", { name: title }),
  });
  await expect(ad.getByText("Verlopen", { exact: true })).toBeVisible();
  await expect(ad.getByRole("button", { name: "Gevonden" })).toHaveCount(0);
  await ad.getByRole("button", { name: "Verlengen" }).click();
  await expect(
    page.getByText(/Je zoekertje staat weer online tot \d+ \w+ \d{4}/),
  ).toBeVisible();
  await expect(ad.getByText("Online", { exact: true })).toBeVisible();
  await expect(ad).toContainText(/Online tot \d+ \w+ \d{4}/);

  // Back in the list, with its expiry date on the ad.
  await page.goto("/zoekertjes");
  await expect(page.getByText(title).first()).toBeVisible();
  await page.goto(`/zoekertjes/${id}`);
  await expect(page.getByText(/Online tot \d+ \w+ \d{4}/)).toBeVisible();
});

test("a featured ad is no longer featured after featured_until", async ({
  page,
}) => {
  const stamp = Date.now();
  await createAd("club", `Uitgelicht ${stamp}`, {
    is_featured: true,
    featured_until: new Date(Date.now() + 86_400_000).toISOString(),
  });
  await createAd("club", `Uitlichting voorbij ${stamp}`, {
    is_featured: true,
    featured_until: yesterday(),
  });

  await page.goto("/zoekertjes");
  // The section directly around the "Aanbevolen" heading.
  const featured = page
    .getByRole("heading", { name: "Aanbevolen" })
    .locator("xpath=..");
  await expect(featured.getByText(`Uitgelicht ${stamp}`).first()).toBeVisible();
  await expect(featured.getByText(`Uitlichting voorbij ${stamp}`)).toHaveCount(
    0,
  );
  // Still listed, as a regular ad.
  await expect(
    page.getByText(`Uitlichting voorbij ${stamp}`).first(),
  ).toBeVisible();
});

test("a conversation keeps the title of an ad that went offline", async ({
  page,
}) => {
  const title = `Gesprek over verlopen ${Date.now()}`;
  const adId = await createAd("club", title);

  // Contact goes through messaging, from the ad page.
  await loginAs(page, "bron");
  await page.goto(`/zoekertjes/${adId}`);
  await page.getByRole("button", { name: "Contact opnemen" }).click();
  await page.getByRole("textbox").fill("Is de plaats nog vrij?");
  await page.getByRole("button", { name: /Verstuur/ }).click();
  await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+$/);
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  await admin
    .from("classifieds")
    .update({ expires_at: yesterday() })
    .eq("id", adId);

  await page.reload();
  await expect(page.getByText(`${title} (niet meer online)`)).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);
  await page.goto("/messages");
  await expect(page.getByText(title).first()).toBeVisible();
});
