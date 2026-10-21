import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";
import { test, expect, seed } from "./fixtures";

// Rumour cards render on the server; their vote counts stay live through one
// Realtime channel per page instead of one per card (#200).

// Sara Steekproef, a lopend rumour, and volle_wachtrij, whose votes only the
// vote tests cast and global-setup.ts removes (#129).
const RUMOUR_ID = "e0000000-0000-4000-8000-000000000002";
const VOTER_ID = "a0000000-0000-4000-8000-000000000008";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function removeVote() {
  const { error } = await admin
    .from("rumour_votes")
    .delete()
    .eq("rumour_id", RUMOUR_ID)
    .eq("user_id", VOTER_ID);
  if (error) throw new Error(`Removing the test vote: ${error.message}`);
}

/**
 * The topics of the Realtime channels the page joins from now on, and those
 * whose database subscription is ready.
 */
function watchChannels(page: Page) {
  const joined: string[] = [];
  const ready: string[] = [];
  const topicOf = (frame: string) => frame.match(/"(realtime:[^"]+)"/)?.[1];
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      const frame = payload.toString();
      const topic = topicOf(frame);
      if (topic && frame.includes("phx_join")) joined.push(topic);
    });
    socket.on("framereceived", ({ payload }) => {
      const frame = payload.toString();
      const topic = topicOf(frame);
      if (topic && frame.includes("Subscribed to PostgreSQL")) {
        ready.push(topic);
      }
    });
  });
  return { joined, ready };
}

test.afterEach(removeVote);

test("a vote shows on another visitor's card, through one channel for the page", async ({
  page,
}) => {
  await removeVote();
  const channels = watchChannels(page);
  const rumourChannels = () =>
    channels.joined.filter((topic) => topic.startsWith("realtime:rumour"));

  await page.goto("/geruchten?status=rumour");
  const up = page
    .locator('[data-slot="card"]')
    .filter({ hasText: seed.rumourWithoutSource.playerName })
    .getByRole("button", { name: /^Waar/ });
  const before = Number((await up.textContent())?.replace("Waar", ""));

  // The channel opens once the page is idle.
  await expect.poll(rumourChannels).toHaveLength(1);
  await expect.poll(() => channels.ready).toContain(rumourChannels()[0]);

  const { error } = await admin
    .from("rumour_votes")
    .insert({ rumour_id: RUMOUR_ID, user_id: VOTER_ID, vote_type: true });
  if (error) throw new Error(`Casting the test vote: ${error.message}`);

  await expect(up).toHaveText(`Waar${before + 1}`);
  // Still one channel for every card on the page.
  expect(rumourChannels()).toEqual([
    expect.stringMatching(/^realtime:rumour-votes:/),
  ]);
});
