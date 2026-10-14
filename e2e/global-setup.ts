import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase";

// coach_tom in supabase/seed.sql
const TOM_ID = "a0000000-0000-4000-8000-000000000002";

/**
 * Removes the pending rumours earlier runs left behind. Tests submit rumours
 * as coach_tom, and an author may only have 5 waiting (#54), so a few local
 * reruns without `npm run db:reset` would otherwise hit the cap. Tom has no
 * seeded pending rumours, so only test leftovers go.
 */
export default async function globalSetup() {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await admin
    .from("rumours")
    .delete()
    .eq("creator_id", TOM_ID)
    .eq("status", "pending");
  if (error) throw new Error(`Cleaning up pending rumours: ${error.message}`);
}
