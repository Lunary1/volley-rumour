import { createClient } from "@supabase/supabase-js";
import { SEED_PASSWORD, test, expect, newcomer } from "./fixtures";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// Age and terms gate (issue #75, D-003). Email sign-up asks for both
// declarations on the form. Everyone else who hasn't accepted (Google
// sign-ups, accounts from before the gate) is sent to /welkom once. Google
// itself can't be tested locally; the gate doesn't look at the provider, so
// test_nieuwkomer, a password account without an acceptance, stands in.

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const AGE = "Ik bevestig dat ik 16 jaar of ouder ben.";
const TERMS = /Ik aanvaard de voorwaarden/;

test("email sign-up needs both checkboxes and stores the acceptance", async ({
  page,
}) => {
  const stamp = Date.now();
  const username = `aanmelder_${stamp}`;
  const email = `aanmelder-${stamp}@example.test`;

  await page.goto("/auth/sign-up");
  await page.getByLabel("Gebruikersnaam").fill(username);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Wachtwoord").fill(SEED_PASSWORD);
  const submit = page
    .locator("form")
    .getByRole("button", { name: "Registreren" });

  // Only the age: the browser refuses the form.
  await page.getByLabel(AGE).check();
  await submit.click();
  await expect(page.getByLabel(TERMS)).toHaveJSProperty(
    "validity.valueMissing",
    true,
  );
  await expect(page.getByText("Controleer je e-mail")).toBeHidden();

  await page.getByLabel(TERMS).check();
  await submit.click();
  await expect(page.getByText("Controleer je e-mail")).toBeVisible();

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .single();
  expect(profile).not.toBeNull();
  try {
    const { data: acceptances } = await admin
      .from("terms_acceptances")
      .select("terms_version, accepted_at")
      .eq("user_id", profile!.id);
    const { data: version } = await admin.rpc("current_terms_version");
    expect(acceptances).toHaveLength(1);
    expect(acceptances![0].terms_version).toBe(version);
    expect(
      Date.now() - new Date(acceptances![0].accepted_at).getTime(),
    ).toBeLessThan(60_000);

    // Local sign-ups need no email confirmation, so the user is logged in,
    // and not asked again.
    await page.goto("/zoekertjes");
    await expect(page).toHaveURL("/zoekertjes");
  } finally {
    await admin.auth.admin.deleteUser(profile!.id);
  }
});

test("a user who hasn't accepted is asked once, before anything else", async ({
  page,
  browser,
}) => {
  await page.goto("/auth/login");
  await page.getByLabel("E-mailadres").fill(newcomer.email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(SEED_PASSWORD);
  await page
    .locator("form")
    .getByRole("button", { name: "Inloggen", exact: true })
    .click();
  await page.waitForURL("/welkom?next=%2F");
  await expect(
    page.getByRole("main").getByText("Welkom bij VolleyRumours"),
  ).toBeVisible();

  // Every other page sends them back here, and remembers where they wanted
  // to go.
  await page.goto("/zoekertjes?provincie=antwerpen");
  await expect(page).toHaveURL(
    "/welkom?next=%2Fzoekertjes%3Fprovincie%3Dantwerpen",
  );
  // The terms stay readable.
  await page.goto("/voorwaarden");
  await expect(page.getByText("Wie mag een account maken")).toBeVisible();
  await page.goto("/zoekertjes?provincie=antwerpen");

  const proceed = page.getByRole("button", { name: "Doorgaan" });
  await page.getByLabel(TERMS).check();
  await proceed.click();
  await expect(page.getByLabel(AGE)).toHaveJSProperty(
    "validity.valueMissing",
    true,
  );
  await expect(page).toHaveURL(/\/welkom/);

  await page.getByLabel(AGE).check();
  await proceed.click();
  await page.waitForURL("/zoekertjes?provincie=antwerpen");

  const { data: acceptances } = await admin
    .from("terms_acceptances")
    .select("terms_version")
    .eq("user_id", "a0000000-0000-4000-8000-00000000000d");
  expect(acceptances).toHaveLength(1);

  // Once: a new login goes straight to the homepage.
  const context = await browser.newContext();
  const again = await context.newPage();
  await again.goto("/auth/login");
  await again.getByLabel("E-mailadres").fill(newcomer.email);
  await again.getByLabel("Wachtwoord", { exact: true }).fill(SEED_PASSWORD);
  await again
    .locator("form")
    .getByRole("button", { name: "Inloggen", exact: true })
    .click();
  await again.waitForURL("/");
  await expect(
    again.getByRole("banner").getByText(newcomer.username),
  ).toBeVisible();
  await context.close();
});
