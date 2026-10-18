import { test, expect, type Browser, type Page } from "@playwright/test";

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
  // Already has 5 pending rumours, the most one author may have (#54). The
  // vote tests vote as them; global-setup.ts removes those votes (#129).
  wachtrij: { email: "wachtrij@example.test", username: "volle_wachtrij" },
  // Suspends users and manages badges and roles (#80, D-016).
  admin: { email: "beheerder@example.test", username: "beheerder_vr" },
  // Only the sanction tests use these two; global-setup.ts lifts the
  // suspension and resets the badge and role before every run.
  geschorst: { email: "geschorst@example.test", username: "test_geschorst" },
  kandidaat: { email: "kandidaat@example.test", username: "test_kandidaat" },
  // A Betrouwbare bron: 5 confirmed, 1 denied, 1 expired rumour (#88). Only
  // track-record tests use it.
  bron: { email: "bron@example.test", username: "trouwe_bron" },
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
  // trouwe_bron's rumours (#88): "5 van 6 bevestigd"; the expired one is
  // neutral.
  trustedSource: {
    trackRecord: "5 van 6 bevestigd",
    accuracy: "83%",
    confirmedRumour: "Bas Bronvast",
    deniedRumour: "Gert Gemist",
    expiredRumour: "Hanne Halverwege",
    rumourCount: 7,
  },
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
  // Takedown requests (#68). Only takedown tests use these two rumours;
  // global-setup.ts undoes their requests and removal before every run.
  takedownRemoveRumour: {
    id: "e0000000-0000-4000-8000-000000000008",
    playerName: "Tim Terugtrek",
  },
  takedownRejectRumour: {
    id: "e0000000-0000-4000-8000-000000000009",
    playerName: "Bram Bezwaar",
  },
  // An open request about Lotte Lorem (a denied rumour).
  takedownRequest: {
    reference: "VR-SEED42",
    playerName: "Lotte Lorem",
    requesterName: "Lotte Lorem",
    requesterEmail: "lotte@example.test",
    statusPath:
      "/verwijderverzoek/status/seedtokenvoorlokaletestsVolleyRumours000001",
  },
  // Reports (#69, #79, #87). Only report tests use these two;
  // global-setup.ts deletes reports and undoes the removal and the block.
  reportRumour: {
    id: "e0000000-0000-4000-8000-00000000000a",
    playerName: "Mila Meldtest",
  },
  // VC Testdorp (initiator) and coach_tom about Tom's ad.
  reportConversation: {
    id: "f0000000-0000-4000-8000-000000000002",
    message: "Een jeugdploeg? Daar ben je veel te slecht voor.",
  },
  // Jana (initiator) and coach_tom about Tom's "Hulptrainer" ad. Only block
  // tests use it; global-setup.ts lifts the block and deletes sent messages.
  blockConversation: {
    id: "f0000000-0000-4000-8000-000000000003",
    message: "Dag Tom, zoek je nog iemand voor de jeugdtrainingen?",
  },
  // test_kandidaat (initiator) and VC Testdorp. Only date tests use it (#142):
  // one message at 23:30 UTC on 10 March, 00:30 on 11 March in Belgium.
  lateConversation: {
    id: "f0000000-0000-4000-8000-000000000004",
    message: "Is de plaats als hulptrainer nog vrij?",
  },
  // An open contact message from Jana (#81). Tests read it, never handle it.
  contactMessage: {
    senderName: "Jana Voorbeeld",
    senderEmail: "jana@example.test",
    message: "Kan ik mijn gebruikersnaam nog wijzigen na de registratie?",
  },
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

export { test, expect };
