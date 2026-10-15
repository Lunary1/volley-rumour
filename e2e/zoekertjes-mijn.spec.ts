import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import {
  expect,
  loginAs,
  pageFor,
  seedUsers,
  test,
  type SeedUser,
} from "./fixtures";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// "Mijn zoekertjes": owners edit, close ("gevonden") and delete their own ads
// (issue #72, J-05, J-08). Every test makes its own ads and deletes them again.

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

/** Inserts a team's "zoekt een setter" ad for `user` and returns its id. */
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

/** A conversation from `from` to the ad's owner, with one message. */
async function createConversation(
  adId: string,
  from: SeedUser,
  to: SeedUser,
  message: string,
): Promise<string> {
  const initiator = await userId(from);
  const { data, error } = await admin
    .from("conversations")
    .insert({
      ad_id: adId,
      ad_type: "classified",
      initiator_id: initiator,
      recipient_id: await userId(to),
    })
    .select("id")
    .single();
  if (error) throw error;
  await admin.from("messages").insert({
    conversation_id: data.id,
    sender_id: initiator,
    content: message,
  });
  return data.id;
}

function myAd(page: Page, title: string) {
  return page.getByTestId("my-classified").filter({
    has: page.getByRole("heading", { name: title }),
  });
}

test("Mijn zoekertjes lists every ad with its status", async ({ page }) => {
  const stamp = Date.now();
  await createAd("tom", `Online ${stamp}`);
  await createAd("tom", `Gevonden ${stamp}`, { is_active: false });
  await createAd("tom", `Verwijderd ${stamp}`, {
    removed_at: new Date().toISOString(),
  });

  await loginAs(page, "tom");
  await page.goto("/profile");
  await page.getByRole("link", { name: "Mijn zoekertjes" }).click();
  await expect(page).toHaveURL("/zoekertjes/mijn");

  await expect(
    myAd(page, `Online ${stamp}`).getByText("Online", { exact: true }),
  ).toBeVisible();
  await expect(
    myAd(page, `Gevonden ${stamp}`).getByText("Gevonden", { exact: true }),
  ).toBeVisible();
  const removed = myAd(page, `Verwijderd ${stamp}`);
  await expect(removed).toContainText("Verwijderd door een moderator");
  // A removed ad can only be deleted.
  await expect(removed.getByRole("link", { name: "Bewerken" })).toHaveCount(0);
  await expect(
    removed.getByRole("button", { name: "Verwijderen" }),
  ).toBeVisible();
});

test("an owner edits their ad with the same checks as posting", async ({
  page,
}) => {
  const team = `VC Bewerk${Date.now()}`;
  const id = await createAd("club", `${team} zoekt een setter`, {
    contact_name: team,
    team_name: team,
  });

  await loginAs(page, "club");
  await page.goto("/zoekertjes/mijn");
  await myAd(page, `${team} zoekt een setter`)
    .getByRole("link", { name: "Bewerken" })
    .click();
  await expect(page).toHaveURL(`/zoekertjes/${id}/bewerken`);

  // The form shows the ad as it is.
  const teamName = page.getByLabel(/^Teamnaam/);
  await expect(teamName).toHaveValue(team);
  await expect(page.getByLabel(/Niveau/)).toHaveText("Nationale 2 Heren");

  // One letter passes the browser's `required`, not the server's schema.
  await teamName.fill("V");
  await page.getByRole("button", { name: "Wijzigingen bewaren" }).click();
  await expect(
    page.getByText("Teamnaam moet minstens 2 tekens zijn"),
  ).toHaveRole("alert");

  await teamName.fill(team);
  await page.getByLabel(/Niveau/).click();
  await page.getByRole("option", { name: "Nationale 1 Heren" }).click();
  await page.getByLabel(/^Positie/).click();
  await page.getByRole("option", { name: "Libero", exact: true }).click();
  await page
    .getByLabel(/Omschrijf hier kort/)
    .fill("Nu op zoek naar een libero.");
  await page.getByRole("button", { name: "Wijzigingen bewaren" }).click();

  await expect(page).toHaveURL(`/zoekertjes/${id}`);
  await expect(page.getByText("Je zoekertje is bijgewerkt")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: `${team} zoekt een libero` }),
  ).toBeVisible();
  await expect(page.getByText("Nationale 1 Heren")).toBeVisible();
  await expect(page.getByText("Nu op zoek naar een libero.")).toBeVisible();
});

test("a gevonden ad leaves the list and its conversation stays", async ({
  page,
  browser,
}) => {
  const title = `VC Gevonden${Date.now()} zoekt een setter`;
  const id = await createAd("club", title);
  const conversationId = await createConversation(
    id,
    "jana",
    "club",
    "Ik ken een setter voor jullie!",
  );

  await loginAs(page, "club");
  await page.goto("/zoekertjes/mijn");
  await myAd(page, title).getByRole("button", { name: "Gevonden" }).click();
  await expect(page.getByText(/Gemarkeerd als gevonden/)).toBeVisible();
  await expect(
    myAd(page, title).getByText("Gevonden", { exact: true }),
  ).toBeVisible();

  // Gone from the list and the detail page for everyone else.
  const jana = await pageFor(browser, "jana");
  await jana.goto("/zoekertjes");
  await expect(jana.locator(`a[href="/zoekertjes/${id}"]`)).toHaveCount(0);
  const response = await jana.goto(`/zoekertjes/${id}`);
  expect(response?.status()).toBe(404);

  // The conversation stays readable.
  await jana.goto(`/messages/${conversationId}`);
  await expect(jana.getByText("Ik ken een setter voor jullie!")).toBeVisible();

  // The owner can put it back online.
  await myAd(page, title)
    .getByRole("button", { name: "Weer online zetten" })
    .click();
  await expect(page.getByText("Je zoekertje staat weer online")).toBeVisible();
  await expect(
    myAd(page, title).getByText("Online", { exact: true }),
  ).toBeVisible();
  await jana.goto("/zoekertjes");
  await expect(
    jana.locator(`a[href="/zoekertjes/${id}"]`).first(),
  ).toBeVisible();
  await jana.context().close();
});

test("deleting asks for confirmation and keeps the conversation", async ({
  page,
}) => {
  const title = `VC Weg${Date.now()} zoekt een setter`;
  const id = await createAd("tom", title);
  const conversationId = await createConversation(
    id,
    "jana",
    "tom",
    "Is deze plaats nog vrij?",
  );

  await loginAs(page, "tom");
  await page.goto("/zoekertjes/mijn");
  await myAd(page, title).getByRole("button", { name: "Verwijderen" }).click();

  const dialog = page.getByRole("dialog", { name: "Zoekertje verwijderen?" });
  await expect(dialog).toContainText(title);
  await dialog.getByRole("button", { name: "Annuleren" }).click();
  await expect(myAd(page, title)).toBeVisible();

  await myAd(page, title).getByRole("button", { name: "Verwijderen" }).click();
  await dialog.getByRole("button", { name: "Definitief verwijderen" }).click();
  await expect(page.getByText("Je zoekertje is verwijderd")).toBeVisible();
  await expect(myAd(page, title)).toHaveCount(0);

  const response = await page.goto(`/zoekertjes/${id}`);
  expect(response?.status()).toBe(404);

  await page.goto(`/messages/${conversationId}`);
  await expect(page.getByText("Is deze plaats nog vrij?")).toBeVisible();
  await expect(page.getByText("Verwijderd zoekertje")).toBeVisible();
});

test("only the owner can edit an ad", async ({ page }) => {
  const id = await createAd(
    "club",
    `VC Andermans${Date.now()} zoekt een setter`,
  );

  await loginAs(page, "jana");
  const response = await page.goto(`/zoekertjes/${id}/bewerken`);
  expect(response?.status()).toBe(404);

  // Neither the detail page nor the list offers it to someone else.
  await page.goto(`/zoekertjes/${id}`);
  await expect(page.getByRole("link", { name: "Bewerken" })).toHaveCount(0);
});
