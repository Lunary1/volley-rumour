import {
  test as base,
  expect,
  type Browser,
  type Page,
} from "@playwright/test";

// Accounts created by supabase/seed.sql. Keep the two in sync.
export const SEED_PASSWORD = "test-wachtwoord";

export const seedUsers = {
  jana: { email: "jana@example.test", username: "speler_jana" },
  tom: { email: "tom@example.test", username: "coach_tom" },
  club: { email: "club@example.test", username: "vc_testdorp" },
  moderator: { email: "moderator@example.test", username: "moderator_vr" },
  // Logging out ends every session of the user (global sign-out), which
  // would log out parallel tests on the same account. Only logout tests use it.
  uitlogger: { email: "uitlog@example.test", username: "test_uitlogger" },
  // Already has 5 pending rumours, the most one author may have (#54).
  wachtrij: { email: "wachtrij@example.test", username: "volle_wachtrij" },
} as const;

export type SeedUser = keyof typeof seedUsers;

// Accounts only the password-reset tests use, because those tests change the
// password. `google` has no password at all, like a Google sign-up.
export const resetUsers = {
  reset: { email: "reset@example.test", username: "test_reset" },
  google: { email: "google@example.test", username: "test_google" },
} as const;

// Rows from supabase/seed.sql that tests look for.
export const seed = {
  activeAdCount: 4,
  activeAd: {
    id: "d0000000-0000-4000-8000-000000000001",
    title: "VC Testdorp zoekt een setter",
    contactName: "VC Testdorp",
    description:
      "Ons herenteam in Nationale 2 zoekt een ervaren setter voor volgend seizoen. Training op dinsdag en donderdag.",
  },
  inactiveAd: { id: "d0000000-0000-4000-8000-000000000004" },
  adWithoutDescription: {
    id: "d0000000-0000-4000-8000-000000000005",
    title: "Hulptrainer beschikbaar in Gent",
    contactName: "Tom Testmans",
  },
  openRumour: {
    playerName: "Pieter Proefspeler",
    sourceLabel: "Eigen waarneming",
  },
  // Submitted before rumours had a source (#67).
  rumourWithoutSource: { playerName: "Sara Steekproef" },
  confirmedRumour: { playerName: "Koen Kladversie" },
  // creator_id is null, as after the creator deleted their account
  rumourWithoutCreator: { playerName: "Wout Weesgerucht" },
  // Not approved by a moderator (#65): Jana's is pending, Tom's rejected.
  pendingRumour: { playerName: "Nina Nagekeken" },
  rejectedRumour: { playerName: "Rik Retour" },
  // Jana (initiator) and VC Testdorp about activeAd.
  conversation: {
    id: "f0000000-0000-4000-8000-000000000001",
    firstMessage:
      "Hallo! Ik speel geen setter, maar ken iemand die interesse heeft.",
  },
  // Jana's own rows, shown on her profile.
  janaRumour: { playerName: "Pieter Proefspeler" },
  janaAd: { title: "Libero zoekt nieuwe ploeg" },
  // Audit log entries by moderator_vr (#64); the second one's rumour is gone.
  staffActions: [
    { label: "Gerucht afgesloten", reason: "Officieel bevestigd door de club" },
    { label: "Gerucht afgewezen", reason: "Geen bron opgegeven" },
  ],
} as const;

/** Logs in through the login form and waits for the header to show the user. */
export async function loginAs(page: Page, user: SeedUser) {
  const { email, username } = seedUsers[user];
  await page.goto("/auth/login");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(SEED_PASSWORD);
  await page
    .locator("form")
    .getByRole("button", { name: "Inloggen", exact: true })
    .click();
  await page.waitForURL("/");
  await expect(page.getByRole("banner").getByText(username)).toBeVisible();
}

/**
 * Submits a "Trainer Stopt" rumour through the form as the logged-in user and
 * waits for the confirmation. Use a unique last name per run, so reruns
 * against the same database don't collide.
 */
export async function submitRumour(
  page: Page,
  lastName: string,
  source: { type?: string; url?: string } = {},
) {
  await page.goto("/geruchten/nieuw");
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Trainer Stopt" }).click();
  await page.getByLabel(/Achternaam/).fill(lastName);
  await page.getByLabel(/Voornaam/).fill("Toon");
  await page.getByLabel(/Huidige Club/).fill("VC Testdorp");
  await page.getByLabel(/Waar komt je gerucht vandaan/).click();
  await page
    .getByRole("option", { name: source.type ?? "Eigen waarneming" })
    .click();
  if (source.url) await page.getByLabel(/Link naar de bron/).fill(source.url);
  await page.getByLabel(/seniorspeler of -trainer/).check();
  await page.getByLabel(/te goeder trouw/).check();
  await page.getByRole("button", { name: "Gerucht Delen" }).click();

  await expect(
    page.getByRole("heading", { name: "Je gerucht wordt nagekeken" }),
  ).toBeVisible();
}

/**
 * A second browser session, so e.g. an author and a moderator can act side by
 * side. Logging in twice is slow when the suite runs in parallel, so tests
 * that use it are marked slow.
 */
export async function pageFor(browser: Browser, user: SeedUser): Promise<Page> {
  test.slow();
  const context = await browser.newContext();
  await context.route(/datadoghq\.eu/, (route) => route.abort());
  const page = await context.newPage();
  await loginAs(page, user);
  return page;
}

/** A rumour's card in the moderation queue (/admin/wachtrij). */
export function queueItem(page: Page, playerName: string) {
  return page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: playerName }),
  });
}

export const test = base.extend<{ blockThirdParties: void }>({
  // A production build sends Datadog RUM sessions to the production app;
  // tests must never end up in its analytics.
  blockThirdParties: [
    async ({ context }, use) => {
      await context.route(/datadoghq\.eu/, (route) => route.abort());
      await use();
    },
    { auto: true },
  ],
});

export { expect };
