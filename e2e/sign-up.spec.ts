import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { SEED_PASSWORD, test, expect, seedUsers } from "./fixtures";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";
import { getAuthLinkFromEmail } from "./mailpit";

// Sign-up (issue #89): Dutch errors under the field they belong to, a taken
// username refused instead of quietly changed, one password minimum, and the
// confirmation link returns to the page the visitor came from.

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ?next=/zoekertjes/nieuw, encoded or not, maybe after a message parameter.
const NEXT = String.raw`(.*&)?next=(%2F|/)zoekertjes(%2F|/)nieuw(&|$)`;
const atLogin = new RegExp(String.raw`/auth/login\?` + NEXT);
const atSignUp = new RegExp(String.raw`/auth/sign-up\?` + NEXT);

async function fillSignUp(
  page: Page,
  fields: { username: string; email: string; password: string },
) {
  await page.getByLabel("Gebruikersnaam").fill(fields.username);
  await page.getByLabel("E-mail").fill(fields.email);
  await page.getByLabel("Wachtwoord").fill(fields.password);
  await page.getByLabel("Ik bevestig dat ik 16 jaar of ouder ben.").check();
  await page.getByLabel(/Ik aanvaard de voorwaarden/).check();
}

function submit(page: Page) {
  return page
    .locator("form")
    .getByRole("button", { name: "Registreren" })
    .click();
}

async function deleteAccount(email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}

test("sign-up errors are Dutch and a taken username is refused", async ({
  page,
}) => {
  const stamp = Date.now();
  const email = `bezet-${stamp}@example.test`;

  await page.goto("/auth/sign-up");
  await expect(
    page.getByText("3 tot 30 tekens: letters, cijfers en _"),
  ).toBeVisible();
  await expect(page.getByText("Minimaal 8 tekens")).toBeVisible();

  // The browser checks first; switch that off to see what the server says.
  await page.locator("form").evaluate((f: HTMLFormElement) => {
    f.noValidate = true;
  });

  // A seeded username, in another case.
  await fillSignUp(page, {
    username: seedUsers.jana.username.toUpperCase(),
    email,
    password: SEED_PASSWORD,
  });
  await submit(page);
  const username = page.getByLabel("Gebruikersnaam");
  await expect(
    page.getByText("Deze gebruikersnaam bestaat al. Kies een andere."),
  ).toBeVisible();
  await expect(username).toHaveAttribute("aria-invalid", "true");
  // The form keeps what was filled in.
  await expect(page.getByLabel("E-mail")).toHaveValue(email);
  await expect(page.getByText("Controleer je e-mail")).toBeHidden();

  await username.fill("jan peeters");
  await submit(page);
  await expect(
    page.getByText("Gebruik alleen letters, cijfers en _ in je gebruikersnaam"),
  ).toBeVisible();

  await username.fill(`bezet_${stamp}`);
  await page.getByLabel("Wachtwoord").fill("kort123");
  await submit(page);
  await expect(
    page.getByText("Wachtwoord moet minimaal 8 tekens zijn"),
  ).toBeVisible();
  await expect(page.getByLabel("Wachtwoord")).toHaveAttribute(
    "aria-invalid",
    "true",
  );

  await page.getByLabel("E-mail").fill("geen-adres");
  await page.getByLabel("Wachtwoord").fill(SEED_PASSWORD);
  await submit(page);
  await expect(page.getByText("Vul een geldig e-mailadres in")).toBeVisible();

  // None of it made an account, and jana's name is still only hers.
  const { data: profiles } = await admin
    .from("profiles")
    .select("username")
    .ilike("username", `${seedUsers.jana.username}%`);
  expect(profiles).toEqual([{ username: seedUsers.jana.username }]);
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  expect(data.users.some((u) => u.email === email)).toBe(false);
});

test("the confirmation link logs in and returns to where the visitor was", async ({
  page,
  browser,
}) => {
  const stamp = Date.now();
  const username = `terugkeer_${stamp}`;
  const email = `terugkeer-${stamp}@example.test`;

  try {
    // From a page that needs an account, through login, to sign-up.
    await page.goto("/zoekertjes/nieuw");
    await page.waitForURL(atLogin);
    await page.getByRole("link", { name: "Registreer" }).click();
    await page.waitForURL(atSignUp);

    await fillSignUp(page, { username, email, password: SEED_PASSWORD });
    const sentAt = new Date(Date.now() - 1_000);
    await submit(page);
    await expect(page.getByText("Controleer je e-mail")).toBeVisible();
    const link = await getAuthLinkFromEmail(email, sentAt);

    // Opened in another browser: the address is confirmed, but that browser
    // has no session, so it asks to log in and keeps the destination.
    const other = await browser.newContext();
    try {
      const otherPage = await other.newPage();
      await otherPage.goto(link);
      await otherPage.waitForURL(atLogin);
      await expect(
        otherPage.getByText(
          "Je e-mailadres is bevestigd. Log in om verder te gaan.",
        ),
      ).toBeVisible();
    } finally {
      await other.close();
    }

    // A used link says so.
    await page.goto(link);
    await page.waitForURL(atLogin);
    await expect(
      page.getByText("Je bevestigingslink is ongeldig of verlopen."),
    ).toBeVisible();

    // In the browser that signed up, a fresh link logs in and returns.
    await page.goto("/auth/sign-up?next=%2Fzoekertjes%2Fnieuw");
    await fillSignUp(page, {
      username: `${username}_b`,
      email: `b-${email}`,
      password: SEED_PASSWORD,
    });
    const sentAgainAt = new Date(Date.now() - 1_000);
    await submit(page);
    await expect(page.getByText("Controleer je e-mail")).toBeVisible();
    await page.goto(await getAuthLinkFromEmail(`b-${email}`, sentAgainAt));
    await page.waitForURL("/zoekertjes/nieuw");
    await expect(
      page.getByRole("banner").getByText(`${username}_b`),
    ).toBeVisible();
  } finally {
    await deleteAccount(email);
    await deleteAccount(`b-${email}`);
  }
});
