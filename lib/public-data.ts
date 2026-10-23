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

/**
 * getHomepageData for the homepage sections: read once per request, however
 * many sections use it, and empty when it fails to load.
 */
export const getHomepageDataOrEmpty = cache(() =>
  getHomepageData().catch((error) => {
    console.error("Error loading homepage data:", error);
    return {
      latestTransfers: [] as TransferCardData[],
      counts: { rumours: 0, transfers: 0, users: 0 },
    };
  }),
);

/** Columns a rumour card needs, with the author's track record. */
export const RUMOUR_CARD_SELECT = `
  *,
  creator:creator_id(username, is_verified_source, rumours_confirmed, rumours_denied)
`;

/**
 * The homepage's hot topics: the three lopende rumours with the most "true"
 * votes. Not cached across requests: the vote counts must be fresh (#129).
 */
export async function getFeaturedRumours() {
  const { data, error } = await createPublicClient()
    .from("rumours")
    .select(RUMOUR_CARD_SELECT)
    .eq("status", "rumour")
    .order("votes_true", { ascending: false })
    .limit(3);
  if (error) console.error("Error loading featured rumours:", error);
  return data ?? [];
}

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

/** A row on the homepage's transfer board (#240). */
export interface BoardRumour {
  id: string;
  player_name: string;
  from_club_name: string | null;
  to_club_name: string | null;
  category: string;
  status: string;
  votes_true: number;
  votes_false: number;
  to_division: string | null;
  from_division: string | null;
  created_at: string;
}

/**
 * The transfer board on the homepage (#240): the newest public rumours,
 * whatever their status. The share who believe it may lag a vote by up to
 * REVALIDATE; the hot topics below it show live counts.
 */
export const getTransferBoard = unstable_cache(
  async (): Promise<BoardRumour[]> => {
    const { data, error } = await createPublicClient()
      .from("rumours")
      .select(
        "id, player_name, from_club_name, to_club_name, category, status, votes_true, votes_false, to_division, from_division, created_at",
      )
      .in("status", PUBLIC_RUMOUR_STATUSES)
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) throw error;
    return (data ?? []) as BoardRumour[];
  },
  ["transfer-board"],
  { revalidate: REVALIDATE, tags: [PUBLIC_DATA_TAGS.rumours] },
);

/** A zoekertje as the homepage lists it: no names or contact details. */
export interface HomeClassified {
  id: string;
  title: string;
  type: string;
  division: string | null;
  province: string | null;
  created_at: string;
}

/**
 * The homepage's zoekertjes (#240): the four newest online ads, and how many
 * online ads each division has. RLS shows a visitor only online ads; the
 * filters say so too, as on /zoekertjes.
 */
export const getHomeClassifieds = unstable_cache(
  async () => {
    const supabase = createPublicClient();
    const online = (columns: string) =>
      supabase
        .from("classifieds")
        .select(columns)
        .eq("is_active", true)
        .is("removed_at", null)
        .gt("expires_at", new Date().toISOString());
    const [latest, divisions] = await Promise.all([
      online("id, title, type, division, province, created_at")
        .order("created_at", { ascending: false })
        .limit(4),
      online("division").not("division", "is", null),
    ]);
    const error = latest.error ?? divisions.error;
    if (error) throw error;

    const perDivision: Record<string, number> = {};
    for (const { division } of (divisions.data ?? []) as unknown as {
      division: string | null;
    }[]) {
      if (division) perDivision[division] = (perDivision[division] ?? 0) + 1;
    }
    return {
      latest: (latest.data ?? []) as unknown as HomeClassified[],
      perDivision,
    };
  },
  ["home-classifieds"],
  { revalidate: REVALIDATE },
);

/** getHomeClassifieds once per request for both sections, empty on failure. */
export const getHomeClassifiedsOrEmpty = cache(() =>
  getHomeClassifieds().catch((error) => {
    console.error("Error loading homepage zoekertjes:", error);
    return {
      latest: [] as HomeClassified[],
      perDivision: {} as Record<string, number>,
    };
  }),
);
