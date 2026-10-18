import { createClient } from "@supabase/supabase-js";
import { SEED_PASSWORD, test, expect, loginAs, seedUsers } from "./fixtures";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// Deleting an account removes it in one go: the login, the profile, the
// zoekertjes (D-021) and unpublished rumours; published rumours stay without
// a name (issue #76, J-11). That a failure halfway leaves everything in place
// is tested in pgTAP (delete_own_account.test.sql).

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

test("a user deletes their account and everything personal goes", async ({
  page,
}) => {
  // Its own throwaway account, with a zoekertje and two rumours.
  const stamp = Date.now();
  const email = `vertrekker-${stamp}@example.test`;
  const username = `vertrekker_${stamp}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { username, age_confirmed: true, terms_accepted: true },
  });
  expect(error).toBeNull();
  const userId = data.user!.id;

  const { data: ad, error: adError } = await admin
    .from("classifieds")
    .insert({
      user_id: userId,
      type: "player_seeks_team",
      title: `Vera Vertrek ${stamp} zoekt een ploeg`,
      contact_name: "Vera Vertrek",
      description: "Mijn echte naam staat in de titel.",
    })
    .select("id")
    .single();
  expect(adError).toBeNull();

  const rumour = (playerName: string, status: string) => ({
    creator_id: userId,
    player_name: playerName,
    category: "transfer",
    status,
    from_club_name: "VC Testdorp",
    to_club_name: "Volley Voorbeeld",
  });
  const published = `Pim Publiek${stamp}`;
  const pending = `Wout Wacht${stamp}`;
  const { error: rumourError } = await admin
    .from("rumours")
    .insert([rumour(published, "rumour"), rumour(pending, "pending")]);
  expect(rumourError).toBeNull();

  try {
    await page.goto("/auth/login");
    await page.getByLabel("E-mailadres").fill(email);
    await page.getByLabel("Wachtwoord", { exact: true }).fill(SEED_PASSWORD);
    await page
      .locator("form")
      .getByRole("button", { name: "Inloggen", exact: true })
      .click();
    await page.waitForURL("/");

    await page.goto("/profile");
    await page.getByRole("button", { name: "Account verwijderen" }).click();
    const dialog = page.getByRole("dialog", { name: "Account verwijderen" });
    await expect(dialog).toContainText("zoekertjes");
    const confirm = dialog.getByRole("button", {
      name: "Permanent verwijderen",
    });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Typ VERWIJDER om te bevestigen").fill("VERWIJDER");
    await confirm.click();

    await expect(page.getByText("Je account is verwijderd.")).toBeVisible();
    await page.waitForURL("/");
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Inloggen" }),
    ).toBeVisible();
    await expect(page.getByRole("banner").getByText(username)).toHaveCount(0);

    // The login, profile, zoekertje and pending rumour are gone.
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    expect(authUser.user).toBeNull();
    const { count: profiles } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("id", userId);
    expect(profiles).toBe(0);
    const { count: ads } = await admin
      .from("classifieds")
      .select("id", { count: "exact", head: true })
      .eq("id", ad!.id);
    expect(ads).toBe(0);
    const { data: rumours } = await admin
      .from("rumours")
      .select("player_name, creator_id")
      .in("player_name", [published, pending]);
    expect(rumours).toEqual([{ player_name: published, creator_id: null }]);

    // The zoekertje's page is gone too.
    const response = await page.goto(`/zoekertjes/${ad!.id}`);
    expect(response?.status()).toBe(404);

    // And the account can't log in any more.
    await page.goto("/auth/login");
    await page.getByLabel("E-mailadres").fill(email);
    await page.getByLabel("Wachtwoord", { exact: true }).fill(SEED_PASSWORD);
    await page
      .locator("form")
      .getByRole("button", { name: "Inloggen", exact: true })
      .click();
    await expect(page).toHaveURL(/\/auth\/login/);
  } finally {
    await admin
      .from("rumours")
      .delete()
      .in("player_name", [published, pending]);
    await admin.from("classifieds").delete().eq("id", ad!.id);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
});

test("the profile's delete dialog needs VERWIJDER", async ({ page }) => {
  // Only opens the dialog and cancels: jana's account stays.
  await loginAs(page, "jana");
  await page.goto("/profile");
  await page.getByRole("button", { name: "Account verwijderen" }).click();
  const dialog = page.getByRole("dialog", { name: "Account verwijderen" });
  await dialog.getByLabel("Typ VERWIJDER om te bevestigen").fill("verwijder");
  await expect(
    dialog.getByRole("button", { name: "Permanent verwijderen" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Annuleren" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: seedUsers.jana.username }),
  ).toBeVisible();
});
