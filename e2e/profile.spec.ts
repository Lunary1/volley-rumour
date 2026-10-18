import { createClient } from "@supabase/supabase-js";
import {
  SEED_PASSWORD,
  test,
  expect,
  loginAs,
  seed,
  seedUsers,
} from "./fixtures";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// The profile page loads its data on the server since #62.

test("profile shows the user's stats and recent activity", async ({ page }) => {
  await loginAs(page, "jana");
  await page.goto("/profile");

  await expect(
    page.getByRole("heading", { level: 1, name: seedUsers.jana.username }),
  ).toBeVisible();
  await expect(page.getByText("Statistieken")).toBeVisible();
  await expect(page.getByText(seed.janaRumour.playerName)).toBeVisible();
  await expect(page.getByText(seed.janaAd.title)).toBeVisible();
  // The edit form starts with the stored username.
  await page.getByRole("button", { name: "Bewerk profiel" }).click();
  await expect(page.getByLabel(/gebruikersnaam/i)).toHaveValue(
    seedUsers.jana.username,
  );
});

test("profile asks a visitor to log in", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByText("Je bent niet ingelogd")).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: "Inloggen" }),
  ).toBeVisible();
});

test("profile says it failed to load instead of asking to log in", async ({
  page,
}) => {
  // A logged-in user without a profile row: the profile query fails (#149).
  // Its own throwaway account, so no other test sees it.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const email = `geen-profiel-${Date.now()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { age_confirmed: true, terms_accepted: true },
  });
  expect(error).toBeNull();
  const userId = data.user!.id;
  try {
    await admin.from("profiles").delete().eq("id", userId);

    await page.goto("/auth/login");
    await page.getByLabel("E-mailadres").fill(email);
    await page.getByLabel("Wachtwoord", { exact: true }).fill(SEED_PASSWORD);
    await page
      .locator("form")
      .getByRole("button", { name: "Inloggen", exact: true })
      .click();
    await page.waitForURL("/");

    await page.goto("/profile");
    await expect(
      page.getByText("Je profiel kon niet geladen worden."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Opnieuw proberen" }),
    ).toBeVisible();
    await expect(page.getByText("Je bent niet ingelogd")).toHaveCount(0);
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
});
