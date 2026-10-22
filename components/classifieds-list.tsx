import Link from "next/link";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import { PageLink, PageNav } from "@/components/page-nav";
import {
  ClassifiedCard,
  type ClassifiedCardData,
} from "@/components/classified-card";
import {
  ClassifiedsNavigationProvider,
  ClassifiedsResults,
  ClassifiedsSearch,
  ClassifiedsSelects,
} from "@/components/classifieds-controls";
import { CLASSIFIED_TYPE_LABELS } from "@/lib/classifieds-utils";
import {
  CLASSIFIEDS_PER_PAGE,
  classifiedsUrl,
  hasClassifiedFilters,
  type ClassifiedFilters,
} from "@/lib/classifieds-filters";

// The zoekertjes list, rendered on the server (#200). The search box, the
// dropdowns and the contact buttons are the only parts that run in the
// browser. Calm colours (#207): green only on actions, "Aanbevolen", the
// verified check and the title on hover.

interface ClassifiedsListProps {
  /** Ads featured right now, on page 1 only. */
  featured: ClassifiedCardData[];
  /** This page of the other ads. */
  classifieds: ClassifiedCardData[];
  total: number;
  totalPages: number;
  filters: ClassifiedFilters;
  currentUserId?: string;
}

const CATEGORY_OPTIONS = [
  { value: null, label: "Alle" },
  ...Object.entries(CLASSIFIED_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

export function ClassifiedsList({
  featured,
  classifieds,
  total,
  totalPages,
  filters,
  currentUserId,
}: ClassifiedsListProps) {
  const hasActiveFilters = hasClassifiedFilters(filters);
  const currentPage = filters.page;
  // Featured ads only head page 1, so page 1 shows that many more.
  const pageStartNum = (currentPage - 1) * CLASSIFIEDS_PER_PAGE + 1;
  const pageEndNum = pageStartNum + featured.length + classifieds.length - 1;
  const pageUrl = (page: number) => classifiedsUrl(filters, { page });

  return (
    <ClassifiedsNavigationProvider filters={filters}>
      <div className="space-y-7">
        <section
          aria-label="Filters"
          className="space-y-3.5 rounded-xl border border-border bg-card p-4"
        >
          <ClassifiedsSearch />

          {/* Category pills: one scrollable row on a phone. Links, so they
            work before hydration. */}
          <nav
            aria-label="Soort zoekertje"
            className="flex gap-2 overflow-x-auto scrollbar-none sm:flex-wrap"
          >
            {CATEGORY_OPTIONS.map(({ value, label }) => {
              const active = filters.type === value;
              return (
                <Link
                  key={value ?? "all"}
                  href={classifiedsUrl(filters, { type: value })}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={chipVariants({ active })}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Province, division, position, sort + Reset */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <ClassifiedsSelects />

            {hasActiveFilters && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="shrink-0 self-start text-xs text-muted-foreground hover:text-foreground sm:self-auto"
              >
                <Link href="/zoekertjes" scroll={false}>
                  <X className="mr-1 h-3 w-3" />
                  Reset
                </Link>
              </Button>
            )}
          </div>
        </section>

        {/* Results */}
        <ClassifiedsResults>
          {total === 0 ? (
            <Card className="overflow-hidden border-border">
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Search className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {!hasActiveFilters
                    ? "Nog geen zoekertjes"
                    : "Geen zoekertjes gevonden"}
                </h3>
                <p className="text-muted-foreground max-w-sm mb-6">
                  {!hasActiveFilters
                    ? "Wees de eerste om een zoekertje te plaatsen en vind spelers, trainers of teams."
                    : "Probeer andere filters of zoektermen."}
                </p>
                {!hasActiveFilters ? (
                  <Button asChild>
                    <Link href="/zoekertjes/nieuw">Plaats zoekertje</Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline">
                    <Link href="/zoekertjes" scroll={false}>
                      Filters wissen
                    </Link>
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="space-y-7">
              {/* Results info and pagination controls */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  <strong className="font-semibold text-foreground">
                    {total} zoekertje{total !== 1 ? "s" : ""}
                  </strong>{" "}
                  • Toon {pageStartNum}-{pageEndNum}
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <PageLink
                      href={pageUrl(currentPage - 1)}
                      disabled={currentPage === 1}
                      label="Vorige pagina"
                      className="h-9 w-9 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </PageLink>
                    <span className="text-meta text-muted-foreground min-w-fit">
                      Blz {currentPage} van {totalPages}
                    </span>
                    <PageLink
                      href={pageUrl(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      label="Volgende pagina"
                      className="h-9 w-9 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </PageLink>
                  </div>
                )}
              </div>

              {/* Featured cards: the body links to the ad, the button opens contact. */}
              {featured.length > 0 && (
                <section className="space-y-4">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    Aanbevolen
                  </h2>
                  <div className="grid grid-cards-featured gap-5">
                    {featured.map((classified) => (
                      <ClassifiedCard
                        featured
                        key={classified.id}
                        classified={classified}
                        isOwn={currentUserId === classified.user_id}
                      />
                    ))}
                  </div>
                </section>
              )}

              {classifieds.length > 0 && (
                <section className="space-y-4 pt-2">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    Alle zoekertjes
                  </h2>
                  <div className="grid grid-cards gap-4">
                    {classifieds.map((classified) => (
                      <ClassifiedCard
                        key={classified.id}
                        classified={classified}
                        isOwn={currentUserId === classified.user_id}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Bottom pagination */}
              <PageNav
                currentPage={currentPage}
                totalPages={totalPages}
                pageUrl={pageUrl}
              />
            </div>
          )}
        </ClassifiedsResults>
      </div>
    </ClassifiedsNavigationProvider>
  );
}
