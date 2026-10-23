import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { expect, loginAs, seedUsers, test } from "./fixtures";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// Authors withdraw their own pending or lopend rumour and edit it while it is
// pending (issue #192, D-042, J-09, J-10). Every test makes its own rumours
// by vc_testdorp and deletes them again.

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const created: string[] = [];
test.afterEach(async () => {
  const ids = created.splice(0);
  if (ids.length) await admin.from("rumours").delete().in("id", ids);
});

/** Inserts a player transfer rumour by vc_testdorp and returns its id. */
async function createRumour(
  playerName: string,
  status: "pending" | "rumour",
): Promise<string> {
  const { data: author } = await admin
    .from("profiles")
    .select("id")
    .eq("username", seedUsers.club.username)
    .single();
  const { data, error } = await admin
    .from("rumours")
    .insert({
      creator_id: author!.id,
      player_name: playerName,
      category: "transfer",
      status,
      gender: "female",
      from_club_name: "VC Testdorp",
      to_club_name: "Volley Voorbeeld",
      source_type: "club",
      declared_good_faith: true,
      declared_senior: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Creating a rumour: ${error.message}`);
  created.push(data.id);
  return data.id;
}

/** One of my rumours in "Mijn geruchten" on the profile. */
function myRumour(page: Page, playerName: string) {
  return page
    .getByRole("list", { name: "Mijn geruchten" })
    .getByRole("listitem")
    .filter({ hasText: playerName });
}

test("the author withdraws a lopend rumour and it leaves Transfer Talk", async ({
  page,
}) => {
  const playerName = `Wim Weggetrokken${Date.now()}`;
  const id = await createRumour(playerName, "rumour");

  await page.goto("/geruchten");
  await expect(page.getByRole("heading", { name: playerName })).toBeVisible();

  await loginAs(page, "club");
  await page.goto("/profile");
  const item = myRumour(page, playerName);
  await expect(item).toContainText("Lopend");
  // A published rumour can't be edited, only withdrawn (D-042).
  await expect(item.getByRole("link", { name: "Bewerken" })).toHaveCount(0);

  await item.getByRole("button", { name: "Intrekken" }).click();
  const dialog = page.getByRole("dialog", { name: "Gerucht intrekken?" });
  await expect(dialog).toContainText("verdwijnt van de site");
  await expect(dialog).toContainText("niet ongedaan maken");
  await dialog.getByRole("button", { name: "Intrekken" }).click();

  await expect(page.getByText("Je gerucht is ingetrokken")).toBeVisible();
  await expect(item).toContainText("Ingetrokken");
  await expect(item).toContainText("Je hebt dit gerucht ingetrokken");
  await expect(item.getByRole("button", { name: "Intrekken" })).toHaveCount(0);

  await page.goto("/geruchten");
  await expect(
    page.getByRole("heading", { name: "Transfer Talk" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: playerName })).toHaveCount(0);

  const response = await page.goto(`/geruchten/${id}`);
  expect(response?.status()).toBe(404);

  const { data } = await admin
    .from("rumours")
    .select("status, withdrawn_at")
    .eq("id", id)
    .single();
  expect(data?.status).toBe("withdrawn");
  expect(data?.withdrawn_at).not.toBeNull();
});

test("the author edits a pending rumour, which stays pending", async ({
  page,
}) => {
  const stamp = Date.now();
  const id = await createRumour(`Eva Bewerkbaar${stamp}`, "pending");

  await loginAs(page, "club");
  await page.goto("/profile");
  const item = myRumour(page, `Eva Bewerkbaar${stamp}`);
  await expect(item).toContainText("Wordt nagekeken");
  await item.getByRole("link", { name: "Bewerken" }).click();

  await expect(page).toHaveURL(`/geruchten/${id}/bewerken`);
  await expect(page.getByLabel("Voornaam")).toHaveValue("Eva");
  await expect(page.getByLabel("Achternaam")).toHaveValue(`Bewerkbaar${stamp}`);
  await expect(page.getByLabel("Nieuwe club")).toHaveValue("Volley Voorbeeld");

  await page.getByLabel("Nieuwe club").fill("Volley Verbeterd");
  // The declarations are asked again on every edit.
  await page.getByLabel(/regels voor geruchten/).check();
  await page.getByRole("button", { name: "Wijzigingen opslaan" }).click();

  await expect(page).toHaveURL("/profile");
  await expect(
    page.getByText("Je gerucht is aangepast en wacht op een moderator"),
  ).toBeVisible();

  const { data } = await admin
    .from("rumours")
    .select("status, to_club_name, gender")
    .eq("id", id)
    .single();
  expect(data).toEqual({
    status: "pending",
    to_club_name: "Volley Verbeterd",
    gender: "female",
  });

  // Once a moderator approved it, the edit page is gone.
  await admin.from("rumours").update({ status: "rumour" }).eq("id", id);
  const response = await page.goto(`/geruchten/${id}/bewerken`);
  expect(response?.status()).toBe(404);
});
