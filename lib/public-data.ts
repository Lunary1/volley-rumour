import { cache } from "react";
import { unstable_cache, updateTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { PUBLIC_RUMOUR_STATUSES } from "@/lib/rumours";
import { TRANSFER_TABS, type TransferTab } from "@/lib/transfers";
import {
  TRANSFER_CARD_COLUMNS,
  type TransferCardData,
} from "@/components/transfer-card";

// Data that is the same for every visitor, cached across requests (#96). It
// is read as a logged-out visitor, so the cache only ever holds public rows.
// Staff actions expire a tag at once; REVALIDATE bounds anything else.

const REVALIDATE = 60;

/** Cache tags, expired by the server actions that change the data. */
export const PUBLIC_DATA_TAGS = {
  rumours: "public-rumours",
  transfers: "public-transfers",
} as const;

/** Expire cached public data after a change. Server actions only. */
export function expirePublicData(...tags: (keyof typeof PUBLIC_DATA_TAGS)[]) {
  for (const tag of tags) updateTag(PUBLIC_DATA_TAGS[tag]);
}

export const RUMOURS_PER_PAGE = 24;
export const TRANSFERS_PER_PAGE = 24;

/** The page number in `?pagina=`; anything else is page 1. */
export function parsePage(value: string | string[] | undefined): number {
  const page = Number.parseInt(
    (Array.isArray(value) ? value[0] : value) ?? "",
    10,
  );
  return Number.isSafeInteger(page) && page > 1 ? page : 1;
}

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

export type RumourStatusCounts = Record<
  (typeof PUBLIC_RUMOUR_STATUSES)[number],
  number
>;

/** Approved rumours per public status, for the Transfer Talk tabs. */
export const getRumourStatusCounts = unstable_cache(
  async (): Promise<RumourStatusCounts> => {
    const supabase = createPublicClient();
    const counts = await Promise.all(
      PUBLIC_RUMOUR_STATUSES.map(async (status) => {
        const { count, error } = await supabase
          .from("rumours")
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        if (error) throw error;
        return [status, count ?? 0] as const;
      }),
    );
    return Object.fromEntries(counts) as RumourStatusCounts;
  },
  ["rumour-status-counts"],
  { revalidate: REVALIDATE, tags: [PUBLIC_DATA_TAGS.rumours] },
);

/** One page of confirmed transfers on a /transfers tab, newest first. */
export const getTransfersPage = unstable_cache(
  async (
    tab: TransferTab,
    page: number,
  ): Promise<{ transfers: TransferCardData[]; total: number } | null> => {
    const categories = TRANSFER_TABS.find((t) => t.value === tab)!.categories;
    let query = createPublicClient()
      .from("transfers")
      .select(TRANSFER_CARD_COLUMNS, { count: "exact" })
      .order("confirmed_at", { ascending: false })
      .order("id");
    if (categories) query = query.in("category", categories);

    const from = (page - 1) * TRANSFERS_PER_PAGE;
    const { data, count, error } = await query.range(
      from,
      from + TRANSFERS_PER_PAGE - 1,
    );
    // Past the last page, PostgREST refuses the range.
    if (error?.code === "PGRST103") return null;
    if (error) throw error;
    return { transfers: (data ?? []) as TransferCardData[], total: count ?? 0 };
  },
  ["transfers-page"],
  { revalidate: REVALIDATE, tags: [PUBLIC_DATA_TAGS.transfers] },
);

/** The homepage: latest transfers and site-wide counts. */
export const getHomepageData = unstable_cache(
  async () => {
    const supabase = createPublicClient();
    const [latest, rumours, transfers, users] = await Promise.all([
      supabase
        .from("transfers")
        .select(TRANSFER_CARD_COLUMNS)
        .order("confirmed_at", { ascending: false })
        .limit(6),
      supabase
        .from("rumours")
        .select("id", { count: "exact", head: true })
        .eq("status", "rumour"),
      supabase.from("transfers").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    // Thrown, so a failed query is not cached.
    const error =
      latest.error ?? rumours.error ?? transfers.error ?? users.error;
    if (error) throw error;

    return {
      latestTransfers: (latest.data ?? []) as TransferCardData[],
      counts: {
        rumours: rumours.count ?? 0,
        transfers: transfers.count ?? 0,
        users: users.count ?? 0,
      },
    };
  },
  ["homepage-data"],
  {
    revalidate: REVALIDATE,
    tags: [PUBLIC_DATA_TAGS.rumours, PUBLIC_DATA_TAGS.transfers],
  },
);

/** Columns a rumour card needs, with the author's track record. */
export const RUMOUR_CARD_SELECT = `
  *,
  creator:creator_id(username, is_verified_source, rumours_confirmed, rumours_denied)
`;

/**
 * One approved rumour for /geruchten/[id], its metadata and share image
 * (#99), or null. Read as a visitor, so a pending or removed rumour is null
 * for its author too. Not cached across requests: its votes change.
 */
export const getPublicRumour = cache(async (id: string) => {
  const { data, error } = await createPublicClient()
    .from("rumours")
    .select(RUMOUR_CARD_SELECT)
    .eq("id", id)
    .in("status", PUBLIC_RUMOUR_STATUSES)
    .maybeSingle();
  // 22P02: the id isn't a uuid.
  if (error && error.code !== "22P02") {
    console.error("Error fetching rumour:", error);
  }
  return data ?? null;
});
