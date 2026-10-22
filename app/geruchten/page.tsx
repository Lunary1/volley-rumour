import { createClient } from "@/lib/supabase/server";
import { RumourCard } from "@/components/rumour-card";
import { RumourVotesProvider } from "@/components/rumour-votes";
import { getUserVotes } from "@/lib/votes";
import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PUBLIC_RUMOUR_STATUSES,
  isPublicRumourStatus,
  voteCounts,
} from "@/lib/rumours";
import {
  RUMOURS_PER_PAGE,
  getRumourStatusCounts,
  pageCount,
  parsePage,
} from "@/lib/public-data";
import { PageNav } from "@/components/page-nav";
import { pageMetadata } from "@/lib/seo";

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
// first (#96).
async function getRumoursPage(status: string | undefined, page: number) {
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

/** The /geruchten URL for a status tab and page, leaving out the defaults. */
function geruchtenUrl(status: string | undefined, page = 1): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
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
  pagina?: string;
}

export default async function GeruchtenPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const status =
    searchParams?.status && isPublicRumourStatus(searchParams.status)
      ? searchParams.status
      : undefined;
  const page = parsePage(searchParams?.pagina);

  const [result, counts] = await Promise.all([
    getRumoursPage(status, page),
    // The tabs leave out their counts when these fail to load.
    getRumourStatusCounts().catch((error) => {
      console.error("Error counting rumours:", error);
      return null;
    }),
  ]);
  if (!result) redirect(geruchtenUrl(status));

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
          <Link href="/geruchten/nieuw">
            <Button>
              <Plus className="mr-2 h-5 w-5" />
              Nieuw Gerucht
            </Button>
          </Link>
        </div>

        {/* Status filter, as chips like the zoekertjes types (#208) */}
        <nav aria-label="Status" className="mb-8 flex flex-wrap gap-2">
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
                href={geruchtenUrl(tab.value)}
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
              pageUrl={(p) => geruchtenUrl(status, p)}
            />
          </>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <Flame className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">
                {status ? emptyTitles[status] : "Nog geen geruchten"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {status
                  ? "Er zijn nog geen geruchten in deze categorie. Kom later terug!"
                  : "Wees de eerste om een gerucht te delen! Heb je gehoord over een mogelijke transfer?"}
              </p>
              <Link href="/geruchten/nieuw">
                <Button>
                  <Plus className="mr-2 h-5 w-5" />
                  {status ? "Gerucht Delen" : "Deel je eerste gerucht"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
