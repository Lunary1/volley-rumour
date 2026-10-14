import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * True when the current session came from a password-reset link (#58).
 * Supabase records how a session was created in the JWT's `amr` claim.
 */
export async function isRecoverySession(supabase: ServerClient) {
  const { data } = await supabase.auth.getClaims();
  const amr = (data?.claims.amr ?? []) as { method?: string }[];
  return amr.some((entry) => entry.method === "recovery");
}
