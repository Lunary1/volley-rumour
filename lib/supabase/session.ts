import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Who is looking, read from the session's JWT (#212). The token is verified
 * against the project's public signing key in the process, so rendering a
 * page makes no call to Supabase Auth. Once per request (React cache()).
 *
 * A deleted account, or one signed out on another device, still counts as
 * logged in here until its token expires (1 hour); the database refuses its
 * writes anyway (RLS, the suspension trigger). Use it to decide what a page
 * shows. Server actions and staff checks keep `getUser()`, which asks Auth.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) return null;
  return { id: data.claims.sub, email: data.claims.email };
});
