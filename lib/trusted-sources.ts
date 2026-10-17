import { createClient } from "@/lib/supabase/server";
import type { TrackRecord } from "@/lib/rumours";

// "Betrouwbare bronnen" (#88, D-005): contributors with at least
// TRUSTED_SOURCE_MIN_RESOLVED resolved rumours, most accurate first. The
// database ranks them (trusted_sources()), so the minimum lives in one place.

export type TrustedSource = {
  id: string;
  username: string;
  avatar_url: string | null;
  is_verified_source: boolean;
} & TrackRecord;

export async function getTrustedSources(
  limit?: number,
): Promise<TrustedSource[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc(
    "trusted_sources",
    limit ? { p_limit: limit } : {},
  );
  return (data ?? []) as TrustedSource[];
}

/** "83%": the share of resolved rumours that were confirmed. */
export function accuracy(record: TrackRecord): string {
  const resolved = record.rumours_confirmed + record.rumours_denied;
  return `${Math.round((record.rumours_confirmed / resolved) * 100)}%`;
}
