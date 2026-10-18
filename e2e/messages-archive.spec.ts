import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";
import { test, expect, loginAs, seed, seedUsers } from "./fixtures";

// Per-user archive (#91, J-07): archiving a conversation hides it from my
// inbox only, and a new message from the other participant brings it back.

const ids = {
  tom: "a0000000-0000-4000-8000-000000000002",
  club: "a0000000-0000-4000-8000-000000000003",
};
// VC Testdorp answers Tom's "Hulptrainer" ad. Only this spec uses it.
const conversationId = "f0000000-0000-4000-8000-000000000091";
const conversationLink = `a[href="/messages/${conversationId}"]`;
const subject = `gesprek met ${seedUsers.tom.username} over ${seed.adWithoutDescription.title}`;
const archiveLabel = `Archiveer ${subject}`;
const restoreLabel = `Zet ${subject} terug naar inbox`;

// Both tests recreate the same conversation, so they can't overlap.
test.describe.configure({ mode: "serial" });

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

test.beforeEach(async () => {
  // Deleting the conversation also deletes its messages and archive rows.
  await admin.from("conversations").delete().eq("id", conversationId);
  const { error } = await admin.from("conversations").insert({
    id: conversationId,
    ad_id: seed.adWithoutDescription.id,
    ad_type: "classified",
    initiator_id: ids.club,
    recipient_id: ids.tom,
  });
  expect(error).toBeNull();
  // Read, so no unread count changes for anyone.
  const { error: messageError } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: ids.club,
    content: "Zoeken jullie nog een hulptrainer voor de jeugd?",
    is_read: true,
  });
  expect(messageError).toBeNull();
});

test("archiving hides a conversation from my inbox only, and I can put it back", async ({
  page,
  browser,
}) => {
  test.slow(); // Two users log in.
  await loginAs(page, "club");
  await page.goto("/messages");
  await page
    .getByRole("button", {
      name: archiveLabel,
    })
    .click();
  await expect(page.getByText("Gesprek gearchiveerd")).toBeVisible();
  await expect(page.locator(conversationLink)).toHaveCount(0);

  // Tom still has it in his inbox.
  const tomContext = await browser.newContext();
  const tom = await tomContext.newPage();
  await loginAs(tom, "tom");
  await tom.goto("/messages");
  await expect(tom.locator(conversationLink)).toBeVisible();
  await tomContext.close();

  // It's in the archive, and it goes back to the inbox from there.
  await page.getByRole("link", { name: "Archief" }).click();
  await expect(page).toHaveURL(/map=archief/);
  await expect(page.locator(conversationLink)).toBeVisible();
  await page
    .getByRole("button", {
      name: restoreLabel,
    })
    .click();
  await expect(
    page.getByText("Gesprek teruggezet naar je inbox"),
  ).toBeVisible();
  await expect(page.locator(conversationLink)).toHaveCount(0);

  await page.getByRole("link", { name: "Inbox" }).click();
  await expect(page.locator(conversationLink)).toBeVisible();
});

test("a new message brings an archived conversation back to the inbox", async ({
  page,
}) => {
  await loginAs(page, "club");
  await page.goto("/messages");
  await page
    .getByRole("button", {
      name: archiveLabel,
    })
    .click();
  await expect(page.locator(conversationLink)).toHaveCount(0);

  // Tom replies. Read, so VC Testdorp's unread count doesn't change.
  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: ids.tom,
    content: "Ja, kom gerust eens langs op training.",
    is_read: true,
  });
  expect(error).toBeNull();

  await page.reload();
  await expect(page.locator(conversationLink)).toBeVisible();
});
