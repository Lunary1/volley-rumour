"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { dailyIpHash } from "@/lib/ip-hash";
import { z } from "zod";

const waitlistSchema = z.object({
  email: z.string().trim().email("Ongeldig e-mailadres"),
});

/**
 * Subscribe an email to the waitlist.
 * - Validates email format
 * - Honeypot field check (bot trap)
 * - Silently succeeds on duplicate to avoid leaking info
 * - At most 10 sign-ups per IP address a day (subscribe_to_waitlist)
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

  // Service role: the sign-up carries the server-side IP hash, so visitors
  // can't call the function themselves. It applies the limit and succeeds
  // silently for an address that is already on the list.
  const admin = createAdminClient();
  const { error } = await admin.rpc("subscribe_to_waitlist", {
    p_email: parsed.data.email,
    p_ip_hash: await dailyIpHash(),
  });

  if (error) {
    if (error.code === "VR002") {
      return {
        success: false as const,
        error:
          "Er zijn vandaag al veel inschrijvingen vanaf dit adres. Probeer het morgen opnieuw.",
      };
    }
    console.error("subscribe_to_waitlist failed:", error.code);
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
