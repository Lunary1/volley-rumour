import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/app/actions/auth";
import { ClassifiedsList } from "@/components/classifieds-list";
import { isFeaturedNow } from "@/lib/classifieds-utils";
import {
  CLASSIFIEDS_PER_PAGE,
  classifiedsUrl,
  parseClassifiedFilters,
  type ClassifiedFilters,
} from "@/lib/classifieds-filters";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Zoekertjes",
  description:
    "Spelers, teams en trainers die elkaar zoeken in het Belgische volleybal. Filter op reeks, provincie en positie.",
  path: "/zoekertjes",
});

/** At most this many featured ads head page 1. */
const FEATURED_LIMIT = 4;

const CLASSIFIED_COLUMNS = `
  id,
  title,
  type,
  description,
  province,
  position,
  team_name,
  contact_name,
  division,
  created_at,
  user_id,
  is_featured,
  featured_until,
  profiles(username, is_verified_source)
`;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Online ads matching the filters (#85); the database filters and sorts. */
function onlineClassifieds(
  supabase: Supabase,
  filters: ClassifiedFilters,
  authorIds: string[],
) {
  let query = supabase
    .from("classifieds")
    .select(CLASSIFIED_COLUMNS, { count: "exact" })
    .eq("is_active", true)
    // RLS still shows removed and expired ads to their author and staff
    // (#69, #84).
    .is("removed_at", null)
    .gt("expires_at", new Date().toISOString());

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.province) query = query.eq("province", filters.province);
  if (filters.division) query = query.eq("division", filters.division);
  if (filters.position) query = query.eq("position", filters.position);
  if (filters.q) {
    // cleanClassifiedSearch leaves nothing that means something here.
    const pattern = `"%${filters.q}%"`;
    const matches = [`title.ilike.${pattern}`, `description.ilike.${pattern}`];
    if (authorIds.length) matches.push(`user_id.in.(${authorIds.join(",")})`);
    query = query.or(matches.join(","));
  }

  switch (filters.sort) {
    case "oldest":
      return query.order("created_at", { ascending: true });
    case "title":
      return query.order("title", { ascending: true });
    default:
      return query.order("created_at", { ascending: false });
  }
}

type ClassifiedRows = Awaited<ReturnType<typeof onlineClassifieds>>["data"];

function normalised(rows: ClassifiedRows) {
  return (rows ?? []).map((row) => ({
    ...row,
    is_featured: isFeaturedNow(row),
    profiles: Array.isArray(row.profiles)
      ? (row.profiles[0] ?? null)
      : row.profiles,
  }));
}

/** Authors whose username matches the search, so it also finds their ads. */
async function matchingAuthorIds(supabase: Supabase, q: string) {
  if (!q) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", `%${q}%`)
    .limit(50);
  return (data ?? []).map((profile) => profile.id as string);
}

async function getClassifieds(filters: ClassifiedFilters) {
  const supabase = await createClient();
  const authorIds = await matchingAuthorIds(supabase, filters.q);

  // Ads featured right now head page 1 and stay out of the paged list, so
  // none is shown twice.
  let featured: ReturnType<typeof normalised> = [];
  if (filters.page === 1) {
    const { data, error } = await onlineClassifieds(
      supabase,
      filters,
      authorIds,
    )
      .eq("is_featured", true)
      .limit(20);
    if (error) console.error("Error fetching featured classifieds:", error);
    featured = normalised(data)
      .filter((ad) => ad.is_featured)
      .slice(0, FEATURED_LIMIT);
  }

  let query = onlineClassifieds(supabase, filters, authorIds);
  if (featured.length) {
    query = query.not("id", "in", `(${featured.map((ad) => ad.id).join(",")})`);
  }
  const from = (filters.page - 1) * CLASSIFIEDS_PER_PAGE;
  const { data, error, count } = await query.range(
    from,
    from + CLASSIFIEDS_PER_PAGE - 1,
  );

  // Past the last page, PostgREST refuses the range.
  if (error?.code === "PGRST103") return { outOfRange: true as const };
  if (error) console.error("Error fetching classifieds:", error);

  return {
    outOfRange: false as const,
    featured,
    classifieds: normalised(data),
    regularCount: count ?? 0,
  };
}

export default async function ZoekertjesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseClassifiedFilters(await props.searchParams);
  const [user, result] = await Promise.all([
    getCurrentUser(),
    getClassifieds(filters),
  ]);

  if (result.outOfRange) redirect(classifiedsUrl(filters));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Zoekertjes
          </h1>
          <p className="text-muted-foreground">
            Spelers, trainers en clubs op zoek naar nieuwe uitdagingen
          </p>
        </div>
        <Button
          asChild
          className="mt-4 md:mt-0 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Link href="/zoekertjes/nieuw">
            <Plus className="mr-2 h-4 w-4" />
            Plaats zoekertje
          </Link>
        </Button>
      </div>

      <ClassifiedsList
        featured={result.featured}
        classifieds={result.classifieds}
        total={result.regularCount + result.featured.length}
        totalPages={Math.max(
          1,
          Math.ceil(result.regularCount / CLASSIFIEDS_PER_PAGE),
        )}
        filters={filters}
        currentUserId={user?.id}
      />
    </div>
  );
}
