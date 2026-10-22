import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import {
  expect,
  loginAs,
  pageFor,
  queueItem,
  seedUsers,
  test,
} from "./fixtures";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// Moderators resolve lopende rumours and manage confirmed transfers (issue
// #70, D-020, J-14), and /transfers shows each type on its own tab (#82).
// Every test makes its own rumours and transfers and deletes them again.
// Expiring every lopend rumour at once is tested in pgTAP only: here it would
// close the seeded rumours other tests vote on.

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const createdRumours: string[] = [];
const createdNames: string[] = [];
test.afterEach(async () => {
  const ids = createdRumours.splice(0);
  const names = createdNames.splice(0);
  if (ids.length) {
    await admin.from("transfers").delete().in("source_rumour_id", ids);
    await admin.from("rumours").delete().in("id", ids);
  }
  if (names.length) {
    await admin.from("transfers").delete().in("player_name", names);
  }
});

/**
 * Inserts a lopend rumour and returns its player name. By volle_wachtrij:
 * other tests submit rumours as coach_tom, which could push these off the
 * five on his profile.
 */
async function openRumour(
  lastName: string,
  fields: Record<string, string | null> = {},
): Promise<string> {
  const { data: author } = await admin
    .from("profiles")
    .select("id")
    .eq("username", seedUsers.wachtrij.username)
    .single();
  const playerName = `Rita ${lastName}${Date.now()}`;
  const { data, error } = await admin
    .from("rumours")
    .insert({
      creator_id: author!.id,
      player_name: playerName,
      category: "transfer",
      status: "rumour",
      from_club_name: "VC Testdorp",
      to_club_name: "Volley Voorbeeld",
      source_type: "own_observation",
      declared_good_faith: true,
      declared_senior: true,
      ...fields,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Creating a lopend rumour: ${error.message}`);
  createdRumours.push(data.id);
  return playerName;
}

/** A /transfers tab: a link, with the tab in the URL (#96). */
function transferTab(page: Page, label: string) {
  return page
    .getByRole("navigation", { name: "Soort transfer" })
    .getByRole("link", { name: label });
}

/** A transfer's card on /transfers or the homepage. */
function transferCard(page: Page, playerName: string) {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: playerName }) });
}

test("a moderator confirms a rumour with a source and it becomes a transfer", async ({
  page,
  browser,
}) => {
  const playerName = await openRumour("Rond", {
    gender: "female",
    to_division: "nat1_dames",
  });
  const source = "https://volley-voorbeeld.example.test/nieuws/rita";

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin");
  await moderator
    .getByRole("navigation", { name: "Beheer" })
    .getByRole("link", { name: "Lopende geruchten" })
    .click();
  await moderator.waitForURL("/admin/geruchten");

  const item = queueItem(moderator, playerName);
  await item.getByRole("button", { name: "Bevestigen", exact: true }).click();
  // The author said she plays in the women's league.
  await expect(item.getByLabel("Speelster")).toBeChecked();
  const confirm = item.getByRole("button", {
    name: "Bevestigen en transfer aanmaken",
  });
  await expect(confirm).toBeDisabled();
  await item.getByLabel(/Link naar de officiële bron/).fill(source);
  await item
    .getByLabel(/Toelichting voor het logboek/)
    .fill("Aangekondigd op de clubsite");
  await confirm.click();

  await expect(
    moderator.getByText(
      `Gerucht over ${playerName} bevestigd, de transfer staat online`,
    ),
  ).toBeVisible();
  await expect(queueItem(moderator, playerName)).toHaveCount(0);

  // Visitors see the transfer on its tab, with the source and no contact
  // button (D-004).
  await page.goto("/transfers");
  await transferTab(page, "Spelers").click();
  const card = transferCard(page, playerName);
  await expect(card).toBeVisible();
  await expect(card.getByText("Speelster")).toBeVisible();
  await expect(card.getByText("Volley Voorbeeld")).toBeVisible();
  await expect(
    card.getByRole("link", { name: "Officiële bron" }),
  ).toHaveAttribute("href", source);
  await expect(card.getByRole("button", { name: /Contact/ })).toHaveCount(0);
  await transferTab(page, "Trainers").click();
  await expect(transferCard(page, playerName)).toHaveCount(0);

  // On Transfer Talk the rumour is confirmed, with the source, and closed to
  // votes.
  await loginAs(page, "jana");
  await page.goto("/geruchten?status=confirmed");
  const rumour = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: playerName }) });
  await expect(rumour.getByText("Bevestigd", { exact: true })).toBeVisible();
  await expect(
    rumour.getByRole("link", { name: "een officiële bron" }),
  ).toHaveAttribute("href", source);
  await expect(rumour.getByRole("button", { name: /^Waar/ })).toBeDisabled();

  // The decision is in the log.
  await moderator.goto("/admin/logboek");
  await expect(
    moderator.getByText("Bevestigd: Aangekondigd op de clubsite").first(),
  ).toBeVisible();
});

test("a second confirmation is refused and makes no second transfer", async ({
  browser,
}) => {
  const playerName = await openRumour("Dubbel", { gender: "male" });

  // Two tabs of the same moderator, both with the form open.
  const first = await pageFor(browser, "moderator");
  const second = await first.context().newPage();
  for (const tab of [first, second]) {
    await tab.goto("/admin/geruchten");
    const item = queueItem(tab, playerName);
    await item.getByRole("button", { name: "Bevestigen", exact: true }).click();
    await item
      .getByLabel(/Link naar de officiële bron/)
      .fill("https://example.test/dubbel");
  }

  await queueItem(first, playerName)
    .getByRole("button", { name: "Bevestigen en transfer aanmaken" })
    .click();
  await expect(
    first.getByText(`Gerucht over ${playerName} bevestigd`, { exact: false }),
  ).toBeVisible();

  await queueItem(second, playerName)
    .getByRole("button", { name: "Bevestigen en transfer aanmaken" })
    .click();
  await expect(
    second.getByText("Dit gerucht is al afgesloten of bestaat niet meer"),
  ).toBeVisible();

  const { count } = await admin
    .from("transfers")
    .select("id", { count: "exact", head: true })
    .eq("player_name", playerName);
  expect(count).toBe(1);
});

test("a moderator denies one rumour and marks another not confirmed", async ({
  page,
  browser,
}) => {
  const denied = await openRumour("Nee");
  const expired = await openRumour("Vaag", { category: "player_retirement" });

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/geruchten");

  let item = queueItem(moderator, denied);
  await item.getByRole("button", { name: "Ontkrachten" }).click();
  await item.getByLabel(/Toelichting voor het logboek/).fill("Speler ontkent");
  await item.getByRole("button", { name: "Ontkrachten bevestigen" }).click();
  await expect(
    moderator.getByText(`Gerucht over ${denied} ontkracht`),
  ).toBeVisible();

  item = queueItem(moderator, expired);
  await item.getByRole("button", { name: "Niet bevestigd" }).click();
  await item.getByRole("button", { name: "Op niet bevestigd zetten" }).click();
  await expect(
    moderator.getByText(`Gerucht over ${expired} op niet bevestigd gezet`),
  ).toBeVisible();

  // Neither became a transfer.
  const { count } = await admin
    .from("transfers")
    .select("id", { count: "exact", head: true })
    .in("player_name", [denied, expired]);
  expect(count).toBe(0);

  // The author sees both outcomes on their profile.
  await loginAs(page, "wachtrij");
  await page.goto("/profile");
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: denied })
      .getByText("Ontkracht"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: expired })
      .getByText("Niet bevestigd"),
  ).toBeVisible();

  // Transfer Talk has a filter for rumours that weren't confirmed.
  await page.goto("/geruchten");
  await page.getByRole("link", { name: /^Niet bevestigd \(\d+\)$/ }).click();
  await page.waitForURL("/geruchten?status=expired");
  await expect(page.getByRole("heading", { name: expired })).toBeVisible();
  await expect(page.getByRole("heading", { name: denied })).toHaveCount(0);
});

test("a moderator reopens a wrongly denied rumour with a reason", async ({
  browser,
}) => {
  const playerName = await openRumour("Fout", {
    status: "denied",
    resolved_at: new Date().toISOString(),
  });
  const reason = `Club bevestigt toch ${Date.now()}`;

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/geruchten");
  await moderator
    .getByRole("navigation", { name: "Geruchten" })
    .getByRole("link", { name: "Afgesloten" })
    .click();
  await moderator.waitForURL("/admin/geruchten?lijst=afgesloten");

  const closed = moderator.getByRole("list", { name: "Afgesloten geruchten" });
  const item = queueItem(moderator, playerName);
  await expect(closed.getByRole("heading", { name: playerName })).toBeVisible();
  await expect(item).toContainText("Ontkracht");

  // No reason, no reopening.
  await item.getByRole("button", { name: "Heropenen" }).click();
  const confirm = item.getByRole("button", { name: "Heropenen bevestigen" });
  await expect(confirm).toBeDisabled();
  await item.getByLabel("Reden voor het logboek").fill(reason);
  await confirm.click();
  await expect(
    moderator.getByText(`Gerucht over ${playerName} is weer lopend`),
  ).toBeVisible();
  await expect(closed.getByRole("heading", { name: playerName })).toHaveCount(
    0,
  );

  // Lopend again, so it can be resolved the right way.
  await moderator.goto("/admin/geruchten");
  await expect(
    queueItem(moderator, playerName).getByRole("button", {
      name: "Bevestigen",
    }),
  ).toBeVisible();

  await moderator.goto("/admin/logboek");
  await expect(
    moderator.getByRole("row").filter({ hasText: reason }),
  ).toContainText("Gerucht heropend");
});

test("expiring every lopend rumour asks for confirmation first", async ({
  page,
}) => {
  await loginAs(page, "moderator");
  await page.goto("/admin/geruchten");
  await page
    .getByRole("button", { name: "Alle lopende geruchten afsluiten" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(/krijgen de status “Niet bevestigd”/);
  await dialog.getByRole("button", { name: "Annuleren" }).click();
  await expect(dialog).toHaveCount(0);
});

test("a moderator adds, corrects and removes a transfer", async ({ page }) => {
  const playerName = `Directe Transfer${Date.now()}`;
  const corrected = `${playerName} Jr`;
  createdNames.push(playerName, corrected);

  await loginAs(page, "moderator");
  await page.goto("/admin/transfers");
  await page.getByRole("button", { name: "Transfer toevoegen" }).click();
  const form = page.getByRole("form", { name: "Transfer toevoegen" });
  await form.getByLabel("Naam").fill(playerName);
  await form.getByLabel("Trainer", { exact: true }).check();
  await form.getByLabel(/Vorige club/).fill("VBC Fictief");
  await form.getByLabel("Nieuwe club").fill("VC Testdorp");
  await form
    .getByLabel(/Link naar de officiële bron/)
    .fill("https://example.test/officieel");
  await form.getByRole("button", { name: "Transfer toevoegen" }).click();
  await expect(
    page.getByText(`Transfer van ${playerName} toegevoegd`),
  ).toBeVisible();

  const item = queueItem(page, playerName);
  await expect(item.getByText("Trainer", { exact: true })).toBeVisible();

  // A trainer stopping has no new club.
  await item.getByRole("button", { name: "Aanpassen" }).click();
  const edit = page.getByRole("form", { name: "Transfer aanpassen" });
  await edit.getByLabel("Naam").fill(corrected);
  await edit.getByLabel("Trainer stopt").check();
  await expect(edit.getByLabel("Nieuwe club")).toHaveCount(0);
  await edit.getByRole("button", { name: "Wijzigingen opslaan" }).click();
  await expect(
    page.getByText(`Transfer van ${corrected} aangepast`),
  ).toBeVisible();

  await page.goto("/transfers");
  await transferTab(page, "Gestopt").click();
  await expect(
    transferCard(page, corrected).getByText("Trainer stopt"),
  ).toBeVisible();

  await page.goto("/admin/transfers");
  await queueItem(page, corrected)
    .getByRole("button", { name: "Verwijderen" })
    .click();
  await page.getByRole("dialog").getByLabel(/Reden/).fill("Dubbel ingevoerd");
  await page.getByRole("button", { name: "Ja, verwijderen" }).click();
  await expect(
    page.getByText(`Transfer van ${corrected} verwijderd`),
  ).toBeVisible();
  await expect(queueItem(page, corrected)).toHaveCount(0);

  await page.goto("/admin/logboek");
  await expect(page.getByText("Transfer verwijderd").first()).toBeVisible();
  await expect(page.getByText("Dubbel ingevoerd").first()).toBeVisible();
});

test("removing a confirmed rumour's transfer makes the rumour lopend again", async ({
  page,
}) => {
  const playerName = await openRumour("Terug", { gender: "male" });

  await loginAs(page, "moderator");
  await page.goto("/admin/geruchten");
  const item = queueItem(page, playerName);
  await item.getByRole("button", { name: "Bevestigen", exact: true }).click();
  await item
    .getByLabel(/Link naar de officiële bron/)
    .fill("https://example.test/vergissing");
  await item
    .getByRole("button", { name: "Bevestigen en transfer aanmaken" })
    .click();
  await expect(queueItem(page, playerName)).toHaveCount(0);

  await page.goto("/admin/transfers");
  const transfer = queueItem(page, playerName);
  await expect(transfer.getByText("Uit een gerucht")).toBeVisible();
  await transfer.getByRole("button", { name: "Verwijderen" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Dat gerucht wordt weer lopend",
  );
  await page.getByRole("button", { name: "Ja, verwijderen" }).click();
  await expect(
    page.getByText(`Transfer van ${playerName} verwijderd`),
  ).toBeVisible();

  await page.goto("/admin/geruchten");
  await expect(queueItem(page, playerName)).toBeVisible();
});
