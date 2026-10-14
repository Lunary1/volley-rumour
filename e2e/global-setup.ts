import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase";

// coach_tom in supabase/seed.sql
const TOM_ID = "a0000000-0000-4000-8000-000000000002";
// Tim Terugtrek and Bram Bezwaar, only used by the takedown tests (#68).
const TAKEDOWN_RUMOUR_IDS = [
  "e0000000-0000-4000-8000-000000000008",
  "e0000000-0000-4000-8000-000000000009",
];

/**
 * Undoes what earlier runs left behind, so reruns without `npm run db:reset`
 * start from the seed:
 * - coach_tom's pending rumours. Tests submit rumours as Tom, and an author
 *   may only have 5 waiting (#54). Tom has no seeded pending rumours, so only
 *   test leftovers go.
 * - takedown requests about the two takedown-test rumours, and the removal
 *   of Tim Terugtrek. Requests count towards the daily limits (#68).
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
}
