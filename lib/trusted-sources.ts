import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { PUBLIC_DATA_TAGS } from "@/lib/public-data";
import type { TrackRecord } from "@/lib/rumours";

// "Betrouwbare bronnen" (#88, D-005): contributors with at least
// TRUSTED_SOURCE_MIN_RESOLVED resolved rumours, most accurate first. The
// database ranks them (trusted_sources()), so the minimum lives in one place.

export type TrustedSource = {
  id: string;
  username: string;
  avatar_path: string | null;
  is_verified_source: boolean;
} & TrackRecord;

/**
 * The same for every visitor, so cached across requests like the other
 * public data (#211). Resolving, reopening or removing a rumour, the verified
 * badge and account deletion expire it; a failure is thrown, so not cached.
 */
export const getTrustedSources = unstable_cache(
  async (limit?: number): Promise<TrustedSource[]> => {
    const { data, error } = await createPublicClient().rpc(
      "trusted_sources",
      limit ? { p_limit: limit } : {},
    );
    if (error) throw error;
    return (data ?? []) as TrustedSource[];
  },
  ["trusted-sources"],
  { revalidate: 60, tags: [PUBLIC_DATA_TAGS.rumours] },
);

/** "83%": the share of resolved rumours that were confirmed. */
export function accuracy(record: TrackRecord): string {
  const resolved = record.rumours_confirmed + record.rumours_denied;
  return `${Math.round((record.rumours_confirmed / resolved) * 100)}%`;
}
