import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./local-supabase.mjs";
import {
  test,
  expect,
  loginAs,
  seed,
  seedUsers,
  SEED_PASSWORD,
} from "./fixtures";

// Realtime scoping (#74, X-5): the unread badge subscribes only to the
// user's own incoming messages, and nobody receives Realtime events for a
// conversation they're not part of, whatever filter they ask for.

const ids = {
  jana: "a0000000-0000-4000-8000-000000000001",
  tom: "a0000000-0000-4000-8000-000000000002",
  wachtrij: "a0000000-0000-4000-8000-000000000008",
};

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// One conversation per test, each about its own ad (one per ad and pair).
// Only the badge test messages volle_wachtrij, so its count is exact.
async function freshConversation(
  id: string,
  adId: string,
  initiator: keyof typeof ids,
  recipient: keyof typeof ids,
) {
  await admin.from("conversations").delete().eq("id", id);
  const { error } = await admin.from("conversations").insert({
    id,
    ad_id: adId,
    ad_type: "classified",
    initiator_id: ids[initiator],
    recipient_id: ids[recipient],
  });
  expect(error).toBeNull();
}

async function signIn(user: keyof typeof seedUsers) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: seedUsers[user].email,
    password: SEED_PASSWORD,
  });
  expect(error).toBeNull();
  await client.realtime.setAuth();
  return client;
}

// Subscribes to message inserts and resolves once Realtime confirms.
async function listen(
  client: SupabaseClient,
  name: string,
  filter: string | undefined,
  events: unknown[],
) {
  await new Promise<void>((resolve, reject) => {
    client
      .channel(name)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter },
        (payload) => events.push(payload.new),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          reject(new Error(`${name}: ${status}`));
      });
  });
}

test("the unread badge counts a new message without a reload", async ({
  page,
}) => {
  const conversationId = "f0000000-0000-4000-8000-00000000074a";
  await freshConversation(conversationId, seed.activeAd.id, "jana", "wachtrij");

  await loginAs(page, "wachtrij");
  const messagesLink = page
    .getByRole("banner")
    .locator('a[href="/messages"]')
    .first();
  await expect(messagesLink).toBeVisible();
  await expect(messagesLink).not.toContainText(/\d/);

  // The badge has no ready marker; a message sent before it joins would
  // already be in the initial count, so the assertion holds either way.
  const jana = await signIn("jana");
  const { error } = await jana.from("messages").insert({
    conversation_id: conversationId,
    sender_id: ids.jana,
    content: "Heb je nog interesse?",
  });
  expect(error).toBeNull();

  // The link reads "Berichten" (for screen readers) followed by the count.
  await expect(messagesLink).toHaveText("Berichten1");

  await jana.removeAllChannels();
  await admin.from("conversations").delete().eq("id", conversationId);
});

test("a third user receives no Realtime events for someone else's conversation", async () => {
  const conversationId = "f0000000-0000-4000-8000-00000000074b";
  await freshConversation(
    conversationId,
    seed.adWithoutDescription.id,
    "wachtrij",
    "jana",
  );

  // Jana, the recipient, listens as the badge does: the control that events
  // flow.
  const jana = await signIn("jana");
  const received: unknown[] = [];
  await listen(jana, "recipient", `recipient_id=eq.${ids.jana}`, received);

  // Tom tries everything a modified client could: no filter at all, the
  // recipient's filter, and the conversation's filter.
  const tom = await signIn("tom");
  const leaked: unknown[] = [];
  await listen(tom, "all", undefined, leaked);
  await listen(tom, "spoof-recipient", `recipient_id=eq.${ids.jana}`, leaked);
  await listen(
    tom,
    "spoof-conversation",
    `conversation_id=eq.${conversationId}`,
    leaked,
  );

  const wachtrij = await signIn("wachtrij");
  const content = `Privébericht ${Date.now()}`;
  const { error } = await wachtrij.from("messages").insert({
    conversation_id: conversationId,
    sender_id: ids.wachtrij,
    content,
  });
  expect(error).toBeNull();

  await expect
    .poll(() => received.map((m) => (m as { content: string }).content))
    .toContain(content);
  // The recipient's event has arrived, so Realtime has processed the change.
  // Give any stray event to Tom a moment more before checking.
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  expect(
    leaked.filter(
      (m) =>
        (m as { conversation_id: string }).conversation_id === conversationId,
    ),
  ).toEqual([]);

  for (const client of [wachtrij, tom, jana]) await client.removeAllChannels();
  await admin.from("conversations").delete().eq("id", conversationId);
});
