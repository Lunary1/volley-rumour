import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";
import { expect, loginAs, pageFor, queueItem, seed, test } from "./fixtures";

// The person a rumour is about asks for its removal without an account; a
// moderator removes the rumour or rejects the request, and the requester
// follows it through the status link (issue #68, J-12, D-014).

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const createdRumours: string[] = [];
test.afterEach(async () => {
  const rumours = createdRumours.splice(0);
  if (!rumours.length) return;
  // A transfer left by a failed test would block deleting its rumour.
  await admin.from("transfers").delete().in("source_rumour_id", rumours);
  await admin.from("rumours").delete().in("id", rumours);
});

/** Fills in and sends the request form, and returns the reference. */
async function sendRequest(page: Page, email: string) {
  await page.getByLabel("Het gerucht gaat over mij", { exact: true }).check();
  await page.getByLabel("Je naam").fill("Test Aanvrager");
  await page.getByLabel("Je e-mailadres").fill(email);
  await page
    .getByLabel("Waarom moet dit gerucht weg?")
    .fill("Dit klopt niet, ik verander niet van club.");
  // The good-faith statement is required (DSA art. 16(2)(d), #94).
  const goodFaith = page.getByLabel(
    "Ik verklaar te goeder trouw dat mijn verzoek juist en volledig is.",
  );
  await expect(goodFaith).toHaveAttribute("required", "");
  await goodFaith.check();
  await page.getByRole("button", { name: "Verzoek versturen" }).click();

  await expect(
    page.getByRole("heading", { name: "Je verzoek is verstuurd" }),
  ).toBeVisible();
  const reference = await page.getByText(/^VR-[2-9A-Z]{6}$/).textContent();
  expect(reference).toBeTruthy();
  return reference!;
}

/** A request's card in the inbox (/admin/meldingen). */
function inboxItem(page: Page, reference: string) {
  return page.getByRole("listitem").filter({ hasText: reference });
}

test("a visitor asks to remove a rumour and a moderator removes it", async ({
  page,
  browser,
}) => {
  const { playerName } = seed.takedownRemoveRumour;

  // Not logged in: from the rumour's detail view to the form.
  await page.goto("/geruchten?status=denied");
  await page
    .locator('[data-slot="card"]')
    .filter({ hasText: playerName })
    .getByRole("button", { name: "Bekijk meer" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Vraag de verwijdering aan" })
    .click();
  await page.waitForURL(/\/verwijderverzoek\?gerucht=/);
  await expect(page.getByText(playerName)).toBeVisible();

  const reference = await sendRequest(page, `tim-${Date.now()}@example.test`);
  await page.getByRole("link", { name: "Status bekijken" }).click();
  await page.waitForURL(/\/verwijderverzoek\/status\//);
  await expect(page.getByText("In behandeling")).toBeVisible();
  await expect(page.getByText(reference)).toBeVisible();
  // The rumour stays up until a moderator decides (D-014).
  const statusUrl = page.url();
  await page.goto("/geruchten?status=denied");
  await expect(page.getByText(playerName).first()).toBeVisible();

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/meldingen");
  const item = inboxItem(moderator, reference);
  await expect(item).toContainText("Test Aanvrager");
  await expect(item).toContainText("Dit klopt niet");
  await item.getByRole("button", { name: "Gerucht verwijderen" }).click();
  await item
    .getByLabel(/Toelichting voor de aanvrager/)
    .fill("Verwijderd, bedankt voor je melding.");
  await item.getByRole("button", { name: "Verwijderen bevestigen" }).click();
  await expect(
    moderator.getByText(`Gerucht verwijderd (${reference})`),
  ).toBeVisible();
  await expect(
    moderator
      .getByRole("list", { name: "Behandelde meldingen" })
      .getByRole("listitem")
      .filter({ hasText: reference }),
  ).toContainText("Gerucht verwijderd");

  await moderator.goto("/admin/logboek");
  await expect(
    moderator.getByRole("row").filter({ hasText: reference }),
  ).toContainText("Inhoud verwijderd");

  await page.goto(statusUrl);
  await expect(page.getByText("Gerucht verwijderd")).toBeVisible();
  await expect(
    page.getByText("Verwijderd, bedankt voor je melding."),
  ).toBeVisible();
  // How to contest the decision (DSA art. 16(5), #94).
  await expect(
    page.getByText("Niet akkoord met deze beslissing?"),
  ).toBeVisible();
  await page.goto("/geruchten?status=denied");
  await expect(page.getByText(playerName)).toHaveCount(0);
});

test("a moderator rejects a request found from the footer", async ({
  page,
  browser,
}) => {
  const { playerName } = seed.takedownRejectRumour;
  const email = `bram-${Date.now()}@example.test`;

  await page.goto("/");
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Gerucht over jou laten verwijderen" })
    .click();
  await page.waitForURL("/verwijderverzoek");
  await page.getByLabel("Naam van de speler of trainer").fill("bezwaar");
  await page.getByRole("button", { name: "Zoeken" }).click();
  await page
    .getByRole("list", { name: "Gevonden geruchten" })
    .getByRole("listitem")
    .filter({ hasText: playerName })
    .getByRole("link", { name: "Dit gerucht" })
    .click();
  await page.waitForURL(/\/verwijderverzoek\?gerucht=/);

  const reference = await sendRequest(page, email);
  const statusUrl = await page
    .getByText(/\/verwijderverzoek\/status\//)
    .textContent();

  // A second request from the same email about the same rumour adds nothing.
  await page.reload();
  await page.getByLabel("Het gerucht gaat over mij", { exact: true }).check();
  await page.getByLabel("Je naam").fill("Test Aanvrager");
  await page.getByLabel("Je e-mailadres").fill(email.toUpperCase());
  await page
    .getByLabel("Waarom moet dit gerucht weg?")
    .fill("Nog eens: dit klopt niet.");
  await page
    .getByLabel(
      "Ik verklaar te goeder trouw dat mijn verzoek juist en volledig is.",
    )
    .check();
  await page.getByRole("button", { name: "Verzoek versturen" }).click();
  await expect(
    page.getByRole("form", { name: "Verwijderverzoek" }).getByRole("alert"),
  ).toContainText("Je hebt al een verwijderverzoek voor dit gerucht lopen");

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/meldingen");
  const item = inboxItem(moderator, reference);
  await item.getByRole("button", { name: "Verzoek afwijzen" }).click();
  const confirm = item.getByRole("button", { name: "Afwijzen bevestigen" });
  await expect(confirm).toBeDisabled();
  // A standard reply (#93) is enough to send.
  await item
    .getByLabel("Sjabloon invoegen")
    .selectOption("Gaat over de transfer");
  await expect(item.getByLabel(/Toelichting voor de aanvrager/)).toHaveValue(
    /^Het gerucht gaat over een mogelijke transfer/,
  );
  await expect(confirm).toBeEnabled();
  await item
    .getByLabel(/Toelichting voor de aanvrager/)
    .fill("Het gerucht steunt op een officieel clubbericht.");
  await confirm.click();
  await expect(
    moderator.getByText(`Verzoek ${reference} afgewezen`),
  ).toBeVisible();

  await page.goto(statusUrl!);
  await expect(page.getByText("Verzoek afgewezen")).toBeVisible();
  await expect(
    page.getByText("Het gerucht steunt op een officieel clubbericht."),
  ).toBeVisible();
  await page.goto("/geruchten?status=denied");
  await expect(page.getByText(playerName).first()).toBeVisible();
});

test("removing a confirmed rumour takes its transfer off the site", async ({
  page,
  browser,
}) => {
  test.slow(); // A visitor and a moderator.
  // Its own lopend rumour without an author, so no track record changes
  // (#151). Dated 2001, so it pushes no other test's rumour off page 1.
  const playerName = `Tanja Transfer ${Date.now()}`;
  const { data: rumour, error } = await admin
    .from("rumours")
    .insert({
      player_name: playerName,
      category: "transfer",
      status: "rumour",
      gender: "female",
      from_club_name: "VC Testdorp",
      to_club_name: "Volley Voorbeeld",
      source_type: "media",
      declared_good_faith: true,
      declared_senior: true,
      created_at: new Date(Date.UTC(2001, 0, 1)).toISOString(),
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdRumours.push(rumour!.id);

  // Confirmed the way staff do it, which expires the cached transfer lists.
  // The transfer is the newest, so it heads /transfers and the homepage.
  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/geruchten");
  const queued = queueItem(moderator, playerName);
  await queued.getByRole("button", { name: "Bevestigen", exact: true }).click();
  await queued
    .getByLabel(/Link naar de officiële bron/)
    .fill("https://volley-voorbeeld.example.test/nieuws/tanja");
  await queued
    .getByRole("button", { name: "Bevestigen en transfer aanmaken" })
    .click();
  await expect(
    moderator.getByText(
      `Gerucht over ${playerName} bevestigd, de transfer staat online`,
    ),
  ).toBeVisible();

  await page.goto("/transfers");
  await expect(page.getByText(playerName)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(playerName)).toBeVisible();

  await page.goto(`/verwijderverzoek?gerucht=${rumour!.id}`);
  const reference = await sendRequest(page, `tanja-${Date.now()}@example.test`);

  await moderator.goto("/admin/meldingen");
  const item = inboxItem(moderator, reference);
  await item.getByRole("button", { name: "Gerucht verwijderen" }).click();
  await item
    .getByLabel(/Toelichting voor de aanvrager/)
    .fill("Verwijderd, ook de transfer.");
  await item.getByRole("button", { name: "Verwijderen bevestigen" }).click();
  await expect(
    moderator.getByText(`Gerucht verwijderd (${reference})`),
  ).toBeVisible();

  await page.goto("/transfers");
  await expect(page.getByText(playerName)).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByText(playerName)).toHaveCount(0);

  await moderator.goto("/admin/logboek");
  await expect(
    moderator
      .getByRole("row")
      .filter({ hasText: reference })
      .filter({ hasText: "Transfer verwijderd" }),
  ).toContainText(`Gerucht verwijderd na verwijderverzoek ${reference}`);
});

test("only staff see requests, and status links are private", async ({
  page,
}) => {
  const { reference, requesterEmail, statusPath } = seed.takedownRequest;

  // The status page shows the decision, not the requester's details.
  await page.goto(statusPath);
  await expect(page.getByText(reference)).toBeVisible();
  await expect(page.getByText("In behandeling")).toBeVisible();
  await expect(page.getByText(requesterEmail)).toHaveCount(0);

  const unknown = await page.goto(
    "/verwijderverzoek/status/onbekendetokenonbekendetokenonbekendetoken0",
  );
  expect(unknown?.status()).toBe(404);

  await loginAs(page, "jana");
  const forbidden = await page.goto("/admin/meldingen");
  expect(forbidden?.status()).toBe(404);
});

test("the inbox shows the requester's details to a moderator", async ({
  page,
}) => {
  const { reference, requesterName, requesterEmail } = seed.takedownRequest;
  await loginAs(page, "moderator");
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Beheer" })
    .getByRole("link", { name: "Meldingen" })
    .click();
  await page.waitForURL("/admin/meldingen");

  const item = inboxItem(page, reference);
  await expect(item).toContainText(requesterName);
  await expect(item).toContainText(requesterEmail);
  await expect(item).toContainText("De persoon zelf");
});

test.describe("before the page has hydrated", () => {
  // Without JavaScript the page stays as it was server-rendered, which is
  // what an early click on a slow connection hits (#127).
  test.use({ javaScriptEnabled: false });

  test("the form can't be sent, so nothing reaches the URL", async ({
    page,
  }) => {
    const { id } = seed.takedownRejectRumour;
    await page.goto(`/verwijderverzoek?gerucht=${id}`);

    await page.getByLabel("Het gerucht gaat over mij", { exact: true }).check();
    await page.getByLabel("Je naam").fill("Vroege Klikker");
    await page.getByLabel("Je e-mailadres").fill("vroeg@example.test");
    await page
      .getByLabel("Waarom moet dit gerucht weg?")
      .fill("Ik klik voor de pagina klaar is met laden.");

    const send = page.getByRole("button", { name: "Verzoek versturen" });
    await expect(send).toBeDisabled();
    // Enter in a field would submit natively, unless the button is disabled.
    await page.getByLabel("Je naam").press("Enter");

    await expect(page).toHaveURL(`/verwijderverzoek?gerucht=${id}`);
    expect(page.url()).not.toContain("vroeg");
    await expect(page.getByLabel("Je naam")).toHaveValue("Vroege Klikker");
  });
});
