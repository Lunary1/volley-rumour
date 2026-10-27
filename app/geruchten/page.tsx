import { createClient } from "@/lib/supabase/server";
import { RumourCard } from "@/components/rumour-card";
import { RumourVotesProvider } from "@/components/rumour-votes";
import { getUserVotes } from "@/lib/votes";
import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronDown, Flame, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PUBLIC_RUMOUR_STATUSES,
  RUMOUR_DIVISIONS,
  isPublicRumourStatus,
  parseRumourDivision,
  rumourDivisionFilter,
  voteCounts,
  type RumourDivision,
} from "@/lib/rumours";
import {
  RUMOURS_PER_PAGE,
  getRumourStatusCounts,
  pageCount,
  parsePage,
} from "@/lib/public-data";
import { PageNav } from "@/components/page-nav";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata = pageMetadata({
  title: "Transfer Talk",
  description:
    "De geruchten van de Belgische volleybal transfermarkt, nagekeken door een moderator. Stem of je denkt dat ze kloppen.",
  path: "/geruchten",
});

// Rendered per request: the cards show the user's own votes, and a cached
// query showed vote counts up to a minute old (#129).
export const dynamic = "force-dynamic";

// Authors and staff can read pending and rejected rumours through RLS, but
// Transfer Talk only ever lists approved ones (#65). One page at a time, newest
// first (#96), optionally in one division (#242).
async function getRumoursPage({ status, division, page }: Filters) {
  const supabase = await createClient();
  let query = supabase
    .from("rumours")
    .select(
      `
      *,
      creator:creator_id(username, is_verified_source, rumours_confirmed, rumours_denied)
    `,
      { count: "exact" },
    )
    .in("status", PUBLIC_RUMOUR_STATUSES)
    .order("created_at", { ascending: false })
    .order("id");

  if (status) {
    query = query.eq("status", status);
  }
  if (division) {
    query = query.or(rumourDivisionFilter(division));
  }

  const from = (page - 1) * RUMOURS_PER_PAGE;
  const { data, count, error } = await query.range(
    from,
    from + RUMOURS_PER_PAGE - 1,
  );
  // Past the last page, PostgREST refuses the range.
  if (error?.code === "PGRST103") return null;
  if (error) console.error("Error fetching rumours:", error);
  return { rumours: data ?? [], total: count ?? 0 };
}

interface Filters {
  status: string | undefined;
  division: RumourDivision | null;
  page: number;
}

/**
 * The /geruchten URL for these filters, leaving out the defaults. Changing a
 * filter goes back to page 1 unless `page` is given.
 */
function geruchtenUrl(
  filters: Filters,
  changes: Partial<Filters> = {},
): string {
  const { status, division, page } = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (division) params.set("reeks", division);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return query ? `/geruchten?${query}` : "/geruchten";
}

// "Geen ... geruchten" per filter.
const emptyTitles: Record<string, string> = {
  rumour: "Geen lopende geruchten",
  confirmed: "Geen bevestigde geruchten",
  denied: "Geen ontkrachte geruchten",
  expired: "Geen niet bevestigde geruchten",
};

interface SearchParams {
  status?: string;
  reeks?: string;
  pagina?: string;
}

const DIVISION_GROUPS = [
  { title: "Heren", suffix: "_heren" },
  { title: "Dames", suffix: "_dames" },
] as const;

/**
 * The division filter (#242): a disclosure of links, so it works before
 * hydration like the status chips. Keyed on the division, so it closes once
 * one is picked.
 */
function DivisionFilter({ filters }: { filters: Filters }) {
  const label = filters.division
    ? RUMOUR_DIVISIONS[filters.division]
    : "Alle reeksen";
  return (
    <details key={filters.division ?? "all"} className="group">
      <summary
        className={cn(
          chipVariants({ active: !!filters.division }),
          "w-fit cursor-pointer",
        )}
      >
        Reeks: {label}
        <ChevronDown
          className="ml-1.5 h-4 w-4 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <nav
        aria-label="Reeks"
        className="mt-3 grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
      >
        <Link
          href={geruchtenUrl(filters, { division: null })}
          aria-current={filters.division ? undefined : "page"}
          className={cn(
            chipVariants({ active: !filters.division }),
            "w-fit sm:col-span-2",
          )}
        >
          Alle reeksen
        </Link>
        {DIVISION_GROUPS.map((group) => (
          <div key={group.title}>
            <h2 className="mb-2 text-label font-semibold tracking-wide text-muted-foreground uppercase">
              {group.title}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {(Object.keys(RUMOUR_DIVISIONS) as RumourDivision[])
                .filter((key) => key.endsWith(group.suffix))
                .map((division) => (
                  <li key={division}>
                    <Link
                      href={geruchtenUrl(filters, { division })}
                      aria-current={
                        division === filters.division ? "page" : undefined
                      }
                      className={chipVariants({
                        active: division === filters.division,
                      })}
                    >
                      {RUMOUR_DIVISIONS[division]}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>
    </details>
  );
}

export default async function GeruchtenPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const status =
    searchParams?.status && isPublicRumourStatus(searchParams.status)
      ? searchParams.status
      : undefined;
  const filters: Filters = {
    status,
    division: parseRumourDivision(searchParams?.reeks),
    page: parsePage(searchParams?.pagina),
  };
  const { division, page } = filters;

  const [result, counts] = await Promise.all([
    getRumoursPage(filters),
    // The tabs leave out their counts when these fail to load.
    getRumourStatusCounts(division).catch((error) => {
      console.error("Error counting rumours:", error);
      return null;
    }),
  ]);
  if (!result) redirect(geruchtenUrl(filters));

  const displayRumours = result.rumours;
  const totalPages = pageCount(result.total, RUMOURS_PER_PAGE);
  const userVotes = await getUserVotes(displayRumours.map((r) => r.id));
  const tabCount = (count: number | undefined) =>
    count === undefined ? "" : ` (${count})`;
  const allCount = counts
    ? Object.values(counts).reduce((sum, n) => sum + n, 0)
    : undefined;

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Transfer Talk</h1>
            <p className="text-muted-foreground">
              Ontdek de nieuwste volleybal transfers in de maak en stem of ze
              waar zijn
            </p>
          </div>
          <Button asChild>
            <Link href="/geruchten/nieuw">
              <Plus className="size-5" />
              Nieuw Gerucht
            </Link>
          </Button>
        </div>

        {/* Status filter, as chips like the zoekertjes types (#208) */}
        <div className="mb-8 space-y-3">
          <nav aria-label="Status" className="flex flex-wrap gap-2">
            {[
              { value: undefined, label: "Alle", count: allCount },
              { value: "rumour", label: "Trending", count: counts?.rumour },
              {
                value: "confirmed",
                label: "Bevestigd",
                count: counts?.confirmed,
              },
              { value: "denied", label: "Ontkracht", count: counts?.denied },
              {
                value: "expired",
                label: "Niet bevestigd",
                count: counts?.expired,
              },
            ].map((tab) => {
              const active = tab.value === status;
              return (
                <Link
                  key={tab.value ?? "all"}
                  href={geruchtenUrl(filters, { status: tab.value })}
                  aria-current={active ? "page" : undefined}
                  className={chipVariants({ active })}
                >
                  {tab.value === "rumour" && (
                    <Flame className="mr-1.5 h-4 w-4" aria-hidden />
                  )}
                  {tab.label}
                  {tabCount(tab.count)}
                </Link>
              );
            })}
          </nav>
          <DivisionFilter filters={filters} />
        </div>

        {/* Rumours Grid - 1 col mobile, 2–3 desktop */}
        {displayRumours.length > 0 ? (
          <>
            <RumourVotesProvider
              rumours={voteCounts(displayRumours)}
              userVotes={userVotes.votes}
              currentUserId={userVotes.userId}
            >
              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
                {displayRumours.map((rumour) => (
                  <RumourCard
                    key={rumour.id}
                    rumour={{
                      id: rumour.id,
                      player_name: rumour.player_name,
                      from_club_name: rumour.from_club_name,
                      to_club_name: rumour.to_club_name,
                      category: rumour.category,
                      description: rumour.description,
                      source_type: rumour.source_type,
                      source_url: rumour.source_url,
                      resolution_source_url: rumour.resolution_source_url,
                      created_at: rumour.created_at,
                      status: rumour.status,
                      creator_id: rumour.creator_id,
                      creator: rumour.creator,
                    }}
                    currentUserId={userVotes.userId}
                  />
                ))}
              </div>
            </RumourVotesProvider>
            <PageNav
              currentPage={page}
              totalPages={totalPages}
              pageUrl={(p) => geruchtenUrl(filters, { page: p })}
            />
          </>
        ) : (
          <EmptyState
            icon={Flame}
            title={
              status
                ? emptyTitles[status]
                : division
                  ? "Geen geruchten in deze reeks"
                  : "Nog geen geruchten"
            }
            description={
              division
                ? `Er zijn nog geen ${status ? "zulke " : ""}geruchten in ${RUMOUR_DIVISIONS[division]}. Kom later terug!`
                : status
                  ? "Er zijn nog geen geruchten in deze categorie. Kom later terug!"
                  : "Wees de eerste om een gerucht te delen! Heb je gehoord over een mogelijke transfer?"
            }
          >
            <Button asChild>
              <Link href="/geruchten/nieuw">
                <Plus className="size-5" />
                {status || division
                  ? "Gerucht Delen"
                  : "Deel je eerste gerucht"}
              </Link>
            </Button>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
