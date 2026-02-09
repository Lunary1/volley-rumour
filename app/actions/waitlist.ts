"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const waitlistSchema = z.object({
  email: z.string().trim().email("Ongeldig e-mailadres"),
});

/**
 * Subscribe an email to the waitlist.
 * - Validates email format
 * - Honeypot field check (bot trap)
 * - Silently succeeds on duplicate to avoid leaking info
 */
export async function subscribeToWaitlist(formData: FormData) {
  // Honeypot: if this hidden field is filled, it's a bot
  const honeypot = formData.get("website");
  if (honeypot) {
    // Silently succeed — don't reveal it's a bot trap
    return { success: true as const };
  }

  const rawEmail = formData.get("email");
  const parsed = waitlistSchema.safeParse({ email: rawEmail });

  if (!parsed.success) {
    return { success: false as const, error: "Vul een geldig e-mailadres in." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("waitlist_subscribers")
    .insert({ email: parsed.data.email });

  if (error) {
    // Unique constraint violation — silently succeed
    if (error.code === "23505") {
      return { success: true as const };
    }
    console.error("Waitlist insert error:", error);
    return {
      success: false as const,
      error: "Er ging iets mis. Probeer het later opnieuw.",
    };
  }

  return { success: true as const };
}

/**
 * Get combined count of profiles + waitlist subscribers.
 * Calls a SECURITY DEFINER RPC so no service role key is needed.
 * Returns a display-friendly rounded number.
 */
export async function getInterestCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_interest_count");

    if (error) {
      console.error("Failed to fetch interest count:", error);
      return 0;
    }

    return roundCount(data ?? 0);
  } catch (error) {
    console.error("Failed to fetch interest count:", error);
    return 0;
  }
}

/** Round count for public display to avoid exact numbers */
function roundCount(n: number): number {
  if (n <= 10) return n;
  if (n < 100) return Math.floor(n / 10) * 10;
  return Math.floor(n / 50) * 50;
}
