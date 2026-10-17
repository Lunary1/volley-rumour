import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import {
  expect,
  loginAs,
  pageFor,
  queueItem,
  seed,
  seedUsers,
  test,
} from "./fixtures";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// Reputation is an accuracy track record, not points (issue #88, D-005,
// J-10, J-14). Only these tests use trouwe_bron. The last test changes its
// record for a moment, so the tests run one after the other.
test.describe.configure({ mode: "serial" });

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const createdRumours: string[] = [];
test.afterEach(async () => {
  const ids = createdRumours.splice(0);
  if (ids.length) await admin.from("rumours").delete().in("id", ids);
});

/** Inserts a rumour by trouwe_bron and returns its player name. */
async function rumourByTrustedSource(status: string): Promise<string> {
  const { data: author } = await admin
    .from("profiles")
    .select("id")
    .eq("username", seedUsers.bron.username)
    .single();
  const playerName = `Ruben Record${Date.now()}`;
  const { data, error } = await admin
    .from("rumours")
    .insert({
      creator_id: author!.id,
      player_name: playerName,
      category: "transfer",
      status,
      from_club_name: "VC Testdorp",
      to_club_name: "Volley Voorbeeld",
      source_type: "media",
      declared_good_faith: true,
      declared_senior: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Creating a rumour: ${error.message}`);
  createdRumours.push(data.id);
  return playerName;
}

function rumourCard(page: Page, playerName: string) {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: playerName }) });
}

const { trustedSource } = seed;

test("Betrouwbare bronnen lists contributors with at least 5 resolved rumours", async ({
  page,
}) => {
  // The old points leaderboard redirects.
  await page.goto("/leaderboard");
  await expect(page).toHaveURL("/betrouwbare-bronnen");
  await expect(
    page.getByRole("heading", { name: "Betrouwbare bronnen", level: 1 }),
  ).toBeVisible();

  const list = page.getByRole("list", { name: "Betrouwbare bronnen" });
  const entry = list
    .getByRole("listitem")
    .filter({ hasText: seedUsers.bron.username });
  await expect(entry).toContainText(trustedSource.trackRecord);
  await expect(entry).toContainText(trustedSource.accuracy);
  // speler_jana has 1 resolved rumour: too few.
  await expect(list).not.toContainText(seedUsers.jana.username);
  await expect(page.getByText(/punten/i)).toHaveCount(0);

  // The homepage shows the top three.
  await page.goto("/");
  await expect(
    page.getByRole("listitem").filter({ hasText: seedUsers.bron.username }),
  ).toContainText(trustedSource.trackRecord);
});

test("rumour cards show the author's track record and a neutral vote signal", async ({
  page,
}) => {
  await page.goto("/geruchten?status=confirmed");
  const card = rumourCard(page, trustedSource.confirmedRumour);
  await expect(card).toContainText(seedUsers.bron.username);
  await expect(card).toContainText(trustedSource.trackRecord);
  await expect(card).toContainText("Nog geen stemmen");

  await card.getByRole("button", { name: "Bekijk meer" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    trustedSource.trackRecord,
  );
  await page.keyboard.press("Escape");

  // Votes are a belief percentage, without good/evil labels (D-005).
  await page.goto("/geruchten?status=rumour");
  await expect(rumourCard(page, seed.openRumour.playerName)).toContainText(
    /\d+% van de stemmers denkt dat dit klopt/,
  );
  await expect(
    page.getByText(/^(Evil|Corrupt|Neutral|Heroic|Legendary)$/),
  ).toHaveCount(0);
});

test("my profile shows my track record and all my rumours with their status", async ({
  page,
}) => {
  await loginAs(page, "bron");
  await page.goto("/profile");

  await expect(page.getByText(trustedSource.trackRecord)).toBeVisible();
  await expect(page.getByText("Trust Score")).toHaveCount(0);

  const rumours = page.getByRole("list", { name: "Mijn geruchten" });
  await expect(rumours.getByRole("listitem")).toHaveCount(
    trustedSource.rumourCount,
  );
  await expect(
    rumours
      .getByRole("listitem")
      .filter({ hasText: trustedSource.expiredRumour }),
  ).toContainText("Niet bevestigd");
  await expect(
    rumours
      .getByRole("listitem")
      .filter({ hasText: trustedSource.deniedRumour }),
  ).toContainText("Ontkracht");
});

test("the queue shows the author's track record and a decision updates it", async ({
  page,
  browser,
}) => {
  const pending = await rumourByTrustedSource("pending");
  const lopend = await rumourByTrustedSource("rumour");

  // Moderators see the track record next to the author (D-005).
  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/wachtrij");
  await expect(queueItem(moderator, pending)).toContainText(
    `${seedUsers.bron.username} · ${trustedSource.trackRecord}`,
  );

  // A denial counts against the author at once.
  await moderator.goto("/admin/geruchten");
  const item = queueItem(moderator, lopend);
  await item.getByRole("button", { name: "Ontkrachten" }).click();
  await item.getByRole("button", { name: "Ontkrachten bevestigen" }).click();
  await expect(
    moderator.getByText(`Gerucht over ${lopend} ontkracht`),
  ).toBeVisible();

  await page.goto("/geruchten?status=denied");
  await expect(rumourCard(page, lopend)).toContainText("5 van 7 bevestigd");
});
