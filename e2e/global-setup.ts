import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// speler_jana, coach_tom and vc_testdorp in supabase/seed.sql
const JANA_ID = "a0000000-0000-4000-8000-000000000001";
const TOM_ID = "a0000000-0000-4000-8000-000000000002";
// Jana and Tom's conversation and its seeded message, only used by the block
// tests (#73).
const BLOCK_CONVERSATION_ID = "f0000000-0000-4000-8000-000000000003";
const BLOCK_SEED_MESSAGE_ID = "f1000000-0000-4000-8000-000000000001";
const CLUB_ID = "a0000000-0000-4000-8000-000000000003";
// Mila Meldtest, only used by the report tests (#69).
const REPORT_RUMOUR_ID = "e0000000-0000-4000-8000-00000000000a";
// test_geschorst and test_kandidaat, only used by the sanction tests (#80).
const SUSPENDED_ID = "a0000000-0000-4000-8000-00000000000a";
const CANDIDATE_ID = "a0000000-0000-4000-8000-00000000000b";
// The seeded contact message (#81); messages tests send are deleted.
const SEED_CONTACT_MESSAGE_ID = "c0000000-0000-4000-8000-000000000001";
// Tim Terugtrek and Bram Bezwaar, only used by the takedown tests (#68).
const TAKEDOWN_RUMOUR_IDS = [
  "e0000000-0000-4000-8000-000000000008",
  "e0000000-0000-4000-8000-000000000009",
];
// volle_wachtrij, who has no seeded votes; only the vote tests vote as them
// (#129).
const VOTER_ID = "a0000000-0000-4000-8000-000000000008";

/**
 * Undoes what earlier runs left behind, so reruns without `npm run db:reset`
 * start from the seed:
 * - coach_tom's pending rumours. Tests submit rumours as Tom, and an author
 *   may only have 5 waiting (#54). Tom has no seeded pending rumours, so only
 *   test leftovers go.
 * - takedown requests about the two takedown-test rumours, and the removal
 *   of Tim Terugtrek. Requests count towards the daily limits (#68).
 * - every report, the removal of Mila Meldtest and coach_tom's block of
 *   vc_testdorp (#69). Reports count towards the daily limit, and a user may
 *   have one open report per item.
 * - coach_tom's block of speler_jana and the messages the block tests sent in
 *   their conversation (#73).
 * - test_geschorst's suspension, and test_kandidaat's badge and moderator
 *   role (#80).
 * - contact messages sent by tests, which count towards the daily limits
 *   (#81).
 * - volle_wachtrij's votes (#129). The vote trigger recounts the rumours
 *   they were on (#78).
 */
export default async function globalSetup() {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const pending = await admin
    .from("rumours")
    .delete()
    .eq("creator_id", TOM_ID)
    .eq("status", "pending");
  if (pending.error) {
    throw new Error(`Cleaning up pending rumours: ${pending.error.message}`);
  }

  const requests = await admin
    .from("takedown_requests")
    .delete()
    .in("rumour_id", TAKEDOWN_RUMOUR_IDS);
  if (requests.error) {
    throw new Error(`Cleaning up takedown requests: ${requests.error.message}`);
  }

  const restored = await admin
    .from("rumours")
    .update({ status: "denied" })
    .in("id", TAKEDOWN_RUMOUR_IDS);
  if (restored.error) {
    throw new Error(
      `Restoring takedown-test rumours: ${restored.error.message}`,
    );
  }

  const reports = await admin.from("reports").delete().not("id", "is", null);
  if (reports.error) {
    throw new Error(`Cleaning up reports: ${reports.error.message}`);
  }

  const reportRumour = await admin
    .from("rumours")
    .update({ status: "denied", removal_note: null })
    .eq("id", REPORT_RUMOUR_ID);
  if (reportRumour.error) {
    throw new Error(
      `Restoring the report-test rumour: ${reportRumour.error.message}`,
    );
  }

  const block = await admin
    .from("blocked_users")
    .delete()
    .eq("blocker_id", TOM_ID)
    .eq("blocked_id", CLUB_ID);
  if (block.error) {
    throw new Error(`Lifting the report-test block: ${block.error.message}`);
  }

  const blockTest = await admin
    .from("blocked_users")
    .delete()
    .eq("blocker_id", TOM_ID)
    .eq("blocked_id", JANA_ID);
  if (blockTest.error) {
    throw new Error(`Lifting the block-test block: ${blockTest.error.message}`);
  }

  const blockMessages = await admin
    .from("messages")
    .delete()
    .eq("conversation_id", BLOCK_CONVERSATION_ID)
    .neq("id", BLOCK_SEED_MESSAGE_ID);
  if (blockMessages.error) {
    throw new Error(
      `Cleaning up block-test messages: ${blockMessages.error.message}`,
    );
  }

  const suspension = await admin
    .from("user_suspensions")
    .delete()
    .eq("user_id", SUSPENDED_ID);
  if (suspension.error) {
    throw new Error(
      `Lifting the sanction-test suspension: ${suspension.error.message}`,
    );
  }

  const candidate = await admin
    .from("profiles")
    .update({ role: "user", is_verified_source: false })
    .eq("id", CANDIDATE_ID);
  if (candidate.error) {
    throw new Error(
      `Resetting the sanction-test candidate: ${candidate.error.message}`,
    );
  }

  const contact = await admin
    .from("contact_messages")
    .delete()
    .neq("id", SEED_CONTACT_MESSAGE_ID);
  if (contact.error) {
    throw new Error(`Cleaning up contact messages: ${contact.error.message}`);
  }

  const votes = await admin
    .from("rumour_votes")
    .delete()
    .eq("user_id", VOTER_ID);
  if (votes.error) {
    throw new Error(`Cleaning up vote-test votes: ${votes.error.message}`);
  }
}
