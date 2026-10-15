import { createHmac } from "node:crypto";
import { headers } from "next/headers";

/**
 * The visitor's IP address as an HMAC whose key changes every day (UTC), for
 * rate limits only: hashes from different days can't be linked. Vercel sets
 * x-forwarded-for itself. Null when there is no address (local runs).
 * Server only: the key is derived from the service role key.
 */
export async function dailyIpHash() {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip")?.trim();
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", `${process.env.SUPABASE_SERVICE_ROLE_KEY}:${day}`)
    .update(ip)
    .digest("hex");
}
