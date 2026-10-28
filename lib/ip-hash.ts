import { createHmac } from "node:crypto";
import { headers } from "next/headers";

/**
 * The visitor's IP address as an HMAC whose key changes every day (UTC), for
 * rate limits only: hashes from different days can't be linked. Vercel sets
 * x-forwarded-for itself. Null when there is no address (local runs).
 * Server only: the key is derived from IP_HASH_SECRET, or from the service
 * role key while that isn't set (#269).
 */
export async function dailyIpHash() {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip")?.trim();
  if (!ip) return null;
  const secret =
    process.env.IP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const day = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", `${secret}:${day}`).update(ip).digest("hex");
}
