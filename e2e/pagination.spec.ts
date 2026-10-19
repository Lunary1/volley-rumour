import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";
import {
  SEED_PASSWORD,
  expect,
  loginAs,
  queueItem,
  seed,
  test,
} from "./fixtures";

// Transfer Talk and /transfers page on the server, with the tab and page in
// the URL, and the inbox loads in a fixed number of queries (#96, J-02). Each
// test makes its own rows: rumours and transfers dated 2001 sort last, so they
// push no other test's rows off page 1.

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PER_PAGE = 24;

const created = { rumours: [] as string[], transfers: [] as string[] };
const users: string[] = [];
test.afterEach(async () => {
  const rumours = created.rumours.splice(0);
  const transfers = created.transfers.splice(0);
  if (rumours.length) await admin.from("rumours").delete().in("id", rumours);
  if (transfers.length)
    await admin.from("transfers").delete().in("id", transfers);
  for (const id of users.splice(0)) {
    await admin
      .from("conversations")
      .delete()
      .or(`initiator_id.eq.${id},recipient_id.eq.${id}`);
    await admin.auth.admin.deleteUser(id);
  }
});

/** "Paginatest 1729… 07": zero-padded, so no name contains another. */
function names(prefix: string, count: number) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return Array.from(
    { length: count },
    (_, i) => `${prefix} ${stamp} ${String(i + 1).padStart(2, "0")}`,
  );
}

/** 2001-01-01 plus n days: older than every other row. */
function oldDate(n: number) {
  return new Date(Date.UTC(2001, 0, 1 + n)).toISOString();
}

function cards(page: Page) {
  return page.locator('[data-slot="card"]');
}

/** The last page number, from "Pagina 1 van N". */
async function lastPage(page: Page) {
  const text = await page
    .getByRole("navigation", { name: "Paginering" })
    .getByText(/^Pagina \d+ van \d+$/)
    .textContent();
  return Number(text!.split(" van ")[1]);
}

test("Transfer Talk shows one page at a time, with the page in the URL", async ({
  page,
}) => {
  // Niet bevestigd, without an author: no track record or homepage changes.
  const players = names("Paginagerucht", PER_PAGE + 1);
  const { data, error } = await admin
    .from("rumours")
    .insert(
      players.map((player_name, i) => ({
        player_name,
        category: "transfer",
        status: "expired",
        from_club_name: "VC Testdorp",
        to_club_name: "Volley Voorbeeld",
        source_type: "media",
        declared_good_faith: true,
        declared_senior: true,
        created_at: oldDate(i),
      })),
    )
    .select("id");
  expect(error).toBeNull();
  created.rumours.push(...data!.map((row) => row.id));

  await page.goto("/geruchten?status=expired");
  await expect(cards(page)).toHaveCount(PER_PAGE);
  // The oldest is past page 1.
  await expect(page.getByText(players[0])).toHaveCount(0);

  await page
    .getByRole("navigation", { name: "Paginering" })
    .getByRole("link", { name: "Volgende" })
    .click();
  await page.waitForURL("/geruchten?status=expired&pagina=2");

  const last = await lastPage(page);
  await page.goto(`/geruchten?status=expired&pagina=${last}`);
  await expect(page.getByRole("heading", { name: players[0] })).toBeVisible();

  // Past the last page goes back to page 1 of the same tab.
  await page.goto(`/geruchten?status=expired&pagina=${last + 1}`);
  await page.waitForURL("/geruchten?status=expired");
});

test("/transfers tabs are links and page on the server; a staff change shows at once", async ({
  page,
  browser,
}) => {
  test.slow(); // A moderator and a visitor.
  const players = names("Paginatransfer", PER_PAGE + 2);
  const { data, error } = await admin
    .from("transfers")
    .insert(
      players.map((player_name, i) => ({
        player_name,
        from_club: "VBC Fictief",
        category: "player_retirement",
        source_url: "https://example.test/afscheid",
        confirmed_at: oldDate(i),
      })),
    )
    .select("id");
  expect(error).toBeNull();
  created.transfers.push(...data!.map((row) => row.id));

  // Removing one through the admin pages expires the cached lists, so the
  // visitor sees the rows inserted above and not the removed one.
  const removed = players[PER_PAGE + 1];
  const moderator = await browser.newPage();
  await loginAs(moderator, "moderator");
  await moderator.goto("/admin/transfers");
  await queueItem(moderator, removed)
    .getByRole("button", { name: "Verwijderen" })
    .click();
  await moderator.getByRole("dialog").getByLabel(/Reden/).fill("Paginatest");
  await moderator.getByRole("button", { name: "Ja, verwijderen" }).click();
  await expect(
    moderator.getByText(`Transfer van ${removed} verwijderd`),
  ).toBeVisible();
  await moderator.close();

  await page.goto("/transfers");
  await page
    .getByRole("navigation", { name: "Soort transfer" })
    .getByRole("link", { name: "Gestopt" })
    .click();
  await page.waitForURL("/transfers?type=retirements");
  await expect(page.getByRole("link", { name: "Gestopt" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(cards(page)).toHaveCount(PER_PAGE);

  const last = await lastPage(page);
  await page.goto(`/transfers?type=retirements&pagina=${last}`);
  await expect(page.getByText(players[0])).toBeVisible();
  await expect(page.getByText(removed)).toHaveCount(0);

  // Another tab starts again on page 1.
  await page
    .getByRole("navigation", { name: "Soort transfer" })
    .getByRole("link", { name: "Alles" })
    .click();
  await page.waitForURL("/transfers");
});

test("the inbox shows each conversation's own last message", async ({
  page,
}) => {
  // A fresh account, so no other test changes this inbox.
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `inbox-${stamp}@example.test`;
  const { data: account, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: {
      username: `inbox_${stamp}`,
      age_confirmed: true,
      terms_accepted: true,
    },
  });
  expect(error).toBeNull();
  const me = account.user!.id;
  users.push(me);

  // One conversation per seeded ad: the club answered last in one, I did in
  // the other.
  const { data: ads } = await admin
    .from("classifieds")
    .select("id, user_id")
    .in("id", [seed.activeAd.id, seed.adWithoutDescription.id]);
  const conversations = [
    { ad: seed.activeAd, last: "Antwoord van de club", lastFromMe: false },
    {
      ad: seed.adWithoutDescription,
      last: "Mijn laatste bericht",
      lastFromMe: true,
    },
  ];
  for (const [i, c] of conversations.entries()) {
    const owner = ads!.find((ad) => ad.id === c.ad.id)!.user_id;
    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .insert({
        ad_id: c.ad.id,
        ad_type: "classified",
        initiator_id: me,
        recipient_id: owner,
      })
      .select("id")
      .single();
    expect(conversationError).toBeNull();
    const at = (minutes: number) =>
      new Date(Date.now() - (10 - i * 3 - minutes) * 60_000).toISOString();
    const { error: messagesError } = await admin.from("messages").insert([
      {
        conversation_id: conversation!.id,
        sender_id: c.lastFromMe ? owner : me,
        content: `Eerste bericht ${i}`,
        is_read: true,
        created_at: at(0),
      },
      {
        conversation_id: conversation!.id,
        sender_id: c.lastFromMe ? me : owner,
        content: c.last,
        is_read: c.lastFromMe,
        created_at: at(1),
      },
    ]);
    expect(messagesError).toBeNull();
  }

  await page.goto("/auth/login");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(SEED_PASSWORD);
  await page
    .locator("form")
    .getByRole("button", { name: "Inloggen", exact: true })
    .click();
  await page.waitForURL("/");
  await page.goto("/messages");

  const fromClub = page
    .locator('a[href^="/messages/"]')
    .filter({ hasText: seed.activeAd.title });
  await expect(fromClub).toContainText("Antwoord van de club");
  await expect(fromClub).not.toContainText("Jij:");
  await expect(fromClub).not.toContainText("Eerste bericht");
  await expect(fromClub.getByText("1", { exact: true })).toBeVisible();

  const fromMe = page
    .locator('a[href^="/messages/"]')
    .filter({ hasText: seed.adWithoutDescription.title });
  await expect(fromMe).toContainText("Jij: Mijn laatste bericht");
  await expect(fromMe).not.toContainText("Eerste bericht");
});
