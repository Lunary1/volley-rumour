import { createClient } from "@supabase/supabase-js";
import { expect, seed, seedUsers, test } from "./fixtures";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// Filters and the page number of /zoekertjes live in the URL, and the server
// filters and pages (issue #85).

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const created: string[] = [];
test.afterEach(async () => {
  if (!created.length) return;
  await admin.from("classifieds").delete().in("id", created.splice(0));
});

const adLink = (page: import("@playwright/test").Page, id: string) =>
  page.locator(`a[href="/zoekertjes/${id}"]`);

test("division and position filters are kept in the URL", async ({ page }) => {
  await page.goto("/zoekertjes");
  await expect(adLink(page, seed.activeAd.id)).toBeVisible();

  // Readable Dutch labels, not slugs.
  const division = page.getByRole("combobox", { name: "Reeks" });
  const position = page.getByRole("combobox", { name: "Positie" });
  await expect(
    division.locator("option", { hasText: "PROMO 4 Heren" }),
  ).toHaveCount(1);
  await expect(
    position.locator("option", { hasText: "Receptie/hoek" }),
  ).toHaveCount(1);

  await division.selectOption({ label: "PROMO 1 Dames" });
  await expect(page).toHaveURL(/[?&]reeks=promo1_dames/);
  await position.selectOption({ label: "Libero" });
  await expect(page).toHaveURL(/[?&]positie=libero/);
  await expect(adLink(page, seed.activeAd.id)).toHaveCount(0);

  // A shared link opens the same search.
  await page.goto(page.url());
  await expect(division).toHaveValue("promo1_dames");
  await expect(position).toHaveValue("libero");
  // Jana's libero ad, in PROMO 1 Dames.
  await expect(page.getByText("Jana Voorbeeld")).toBeVisible();
  await expect(adLink(page, seed.activeAd.id)).toHaveCount(0);
  await expect(page.getByText("1 zoekertje •")).toBeVisible();

  // A type pill keeps the other filters and is a plain link.
  await page
    .getByRole("navigation", { name: "Soort zoekertje" })
    .getByRole("link", { name: "Speler zoekt team" })
    .click();
  await expect(page).toHaveURL(/type=player_seeks_team/);
  await expect(page).toHaveURL(/reeks=promo1_dames/);

  await page.getByRole("link", { name: "Reset" }).click();
  await expect(page).toHaveURL("/zoekertjes");
  await expect(adLink(page, seed.activeAd.id)).toBeVisible();
});

test("the server pages a search, and the page is in the URL", async ({
  page,
}) => {
  const word = `Paginatest${Date.now()}`;
  const { data: club } = await admin
    .from("profiles")
    .select("id")
    .eq("username", seedUsers.club.username)
    .single();
  const { data, error } = await admin
    .from("classifieds")
    .insert(
      Array.from({ length: 13 }, (_, i) => ({
        user_id: club!.id,
        type: "team_seeks_player",
        title: `${word} ${i + 1}`,
        contact_name: "Paginaclub",
        position: "setter",
        gender: "heren",
        division: "nat2_heren",
        province: "antwerpen",
        // Ad 13 is the newest. All are older than the seeded ads, so tests
        // running alongside still find those on page 1.
        created_at: new Date(
          Date.now() - (100 + 13 - i) * 86_400_000,
        ).toISOString(),
      })),
    )
    .select("id");
  if (error) throw error;
  created.push(...data.map((row) => row.id));

  await page.goto(`/zoekertjes?q=${word}`);
  await expect(page.getByRole("searchbox", { name: "Zoeken" })).toHaveValue(
    word,
  );
  await expect(page.getByText("13 zoekertjes • Toon 1-12")).toBeVisible();
  await expect(page.getByText(`${word} 13`)).toBeVisible();
  await expect(page.getByText(`${word} 1`, { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Volgende pagina" }).click();
  await expect(page).toHaveURL(`/zoekertjes?q=${word}&pagina=2`);
  await expect(page.getByText("13 zoekertjes • Toon 13-13")).toBeVisible();
  await expect(page.getByText(`${word} 1`, { exact: true })).toBeVisible();
  await expect(page.getByText(`${word} 13`)).toHaveCount(0);

  // Past the last page: back to page 1 of the same search.
  await page.goto(`/zoekertjes?q=${word}&pagina=9`);
  await expect(page).toHaveURL(`/zoekertjes?q=${word}`);
  await expect(page.getByText("13 zoekertjes • Toon 1-12")).toBeVisible();

  // Typing a search puts it in the URL.
  await page.goto("/zoekertjes");
  await page.getByRole("searchbox", { name: "Zoeken" }).fill(`${word} 7`);
  await expect(page).toHaveURL(new RegExp(`q=${word}\\+7`));
  await expect(page.getByText("1 zoekertje •")).toBeVisible();
});
