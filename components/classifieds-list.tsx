"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  MessageSquare,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ContactModal } from "@/components/contact-modal";
import { PageLink, PageNav } from "@/components/page-nav";
import { VerifiedBadge } from "@/components/verified-badge";
import { getExistingConversation } from "@/app/actions/messages";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getDivisionLabel,
  getProvinceLabel,
  getPositionLabel,
  DIVISION_LABELS,
  POSITION_LABELS,
  PROVINCE_LABELS,
  CLASSIFIED_TYPE_LABELS,
  CLASSIFIED_TYPE_COLORS,
} from "@/lib/classifieds-utils";
import {
  CLASSIFIEDS_PER_PAGE,
  CLASSIFIED_SORTS,
  classifiedsUrl,
  cleanClassifiedSearch,
  hasClassifiedFilters,
  type ClassifiedFilters,
  type ClassifiedSort,
} from "@/lib/classifieds-filters";
import { cn } from "@/lib/utils";
import { RelativeTime } from "@/components/relative-time";

interface Classified {
  id: string;
  title: string;
  type: string;
  description: string | null;
  province: string | null;
  position: string | null;
  team_name: string | null;
  contact_name: string | null;
  division: string | null;
  created_at: string;
  user_id: string;
  is_featured?: boolean;
  featured_until?: string | null;
  profiles?: {
    username: string;
    is_verified_source?: boolean;
  } | null;
}

interface ClassifiedsListProps {
  /** Ads featured right now, on page 1 only. */
  featured: Classified[];
  /** This page of the other ads. */
  classifieds: Classified[];
  total: number;
  totalPages: number;
  filters: ClassifiedFilters;
  currentUserId?: string;
}

/** Who posted the ad, as "contact · team", without repeating a name. */
function posterLine(classified: Classified): string {
  const names = [classified.contact_name, classified.team_name]
    .map((name) => name?.trim())
    .filter((name): name is string => !!name);
  return [...new Set(names)].join(" · ");
}

const CATEGORY_OPTIONS = [
  { value: null, label: "Alle" },
  ...Object.entries(CLASSIFIED_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const SELECT_CLASS =
  "flex-1 sm:flex-none px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm";

export function ClassifiedsList({
  featured,
  classifieds,
  total,
  totalPages,
  filters,
  currentUserId,
}: ClassifiedsListProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [searchQuery, setSearchQuery] = useState(filters.q);
  const [shownQuery, setShownQuery] = useState(filters.q);
  const [contactModal, setContactModal] = useState<string | null>(null);
  const [checkingConversation, setCheckingConversation] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The URL's search changed (back button, "Reset"): show it, unless it is
  // what's being typed.
  if (filters.q !== shownQuery) {
    setShownQuery(filters.q);
    if (cleanClassifiedSearch(searchQuery) !== filters.q) {
      setSearchQuery(filters.q);
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function navigate(changes: Partial<ClassifiedFilters>, replace = false) {
    const url = classifiedsUrl(filters, changes);
    startNavigation(() => {
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    });
  }

  // Debounce search input (300ms); typing replaces the history entry.
  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = cleanClassifiedSearch(value);
      if (q !== filters.q) navigate({ q }, true);
    }, 300);
  }

  async function handleContactClick(classified: Classified) {
    setCheckingConversation(true);
    try {
      const result = await getExistingConversation(
        classified.id,
        classified.user_id,
      );

      if (result.success && result.data?.conversationId) {
        router.push(`/messages/${result.data.conversationId}`);
      } else {
        setContactModal(classified.id);
      }
    } catch (err) {
      console.error("Error checking conversation:", err);
      setContactModal(classified.id);
    } finally {
      setCheckingConversation(false);
    }
  }

  const hasActiveFilters = hasClassifiedFilters(filters);
  const currentPage = filters.page;
  // Featured ads only head page 1, so page 1 shows that many more.
  const pageStartNum = (currentPage - 1) * CLASSIFIEDS_PER_PAGE + 1;
  const pageEndNum = pageStartNum + featured.length + classifieds.length - 1;
  const pageUrl = (page: number) => classifiedsUrl(filters, { page });

  const selectedClassified = [...featured, ...classifieds].find(
    (c) => c.id === contactModal,
  );

  return (
    <div className="space-y-6">
      {/* Consolidated filter bar */}
      <div className="space-y-3">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Zoeken"
            placeholder="Zoek op titel, beschrijving of auteur..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            maxLength={100}
            className="pl-10 bg-background"
          />
        </div>

        {/* Category pills — single row, horizontally scrollable on mobile.
            Links, so they work before hydration. */}
        <nav
          aria-label="Soort zoekertje"
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
        >
          {CATEGORY_OPTIONS.map(({ value, label }) => {
            const active = filters.type === value;
            return (
              <Link
                key={value ?? "all"}
                href={classifiedsUrl(filters, { type: value })}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0",
                  active
                    ? value
                      ? CLASSIFIED_TYPE_COLORS[value]
                      : "bg-primary text-primary-foreground"
                    : "bg-muted/80 text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Province, division, position, sort + Reset */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
          <select
            aria-label="Provincie"
            value={filters.province ?? ""}
            onChange={(e) => navigate({ province: e.target.value || null })}
            className={cn(SELECT_CLASS, "sm:min-w-45")}
          >
            <option value="">Alle provincies</option>
            {Object.entries(PROVINCE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            aria-label="Reeks"
            value={filters.division ?? ""}
            onChange={(e) => navigate({ division: e.target.value || null })}
            className={cn(SELECT_CLASS, "sm:min-w-45")}
          >
            <option value="">Alle reeksen</option>
            {Object.entries(DIVISION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            aria-label="Positie"
            value={filters.position ?? ""}
            onChange={(e) => navigate({ position: e.target.value || null })}
            className={cn(SELECT_CLASS, "sm:min-w-40")}
          >
            <option value="">Alle posities</option>
            {Object.entries(POSITION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            aria-label="Sorteren"
            value={filters.sort}
            onChange={(e) =>
              navigate({ sort: e.target.value as ClassifiedSort })
            }
            className={cn(SELECT_CLASS, "sm:min-w-40")}
          >
            {Object.entries(CLASSIFIED_SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground shrink-0 self-start sm:self-auto"
            >
              <Link href="/zoekertjes" scroll={false}>
                <X className="h-3 w-3 mr-1" />
                Reset
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      <div
        aria-busy={isNavigating}
        className={cn("transition-opacity", isNavigating && "opacity-60")}
      >
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
          <div className="space-y-3">
            {/* Results info and pagination controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-2">
              <p className="text-sm text-muted-foreground">
                {total} zoekertje{total !== 1 ? "s" : ""} • Toon {pageStartNum}-
                {pageEndNum}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <PageLink
                    href={pageUrl(currentPage - 1)}
                    disabled={currentPage === 1}
                    label="Vorige pagina"
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </PageLink>
                  <span className="text-xs text-muted-foreground min-w-fit">
                    Blz {currentPage} van {totalPages}
                  </span>
                  <PageLink
                    href={pageUrl(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    label="Volgende pagina"
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </PageLink>
                </div>
              )}
            </div>

            {/* Featured cards: the body links to the ad, the button opens contact. */}
            {featured.length > 0 && (
              <div className="mb-12">
                <h2 className="text-xl font-bold text-foreground mb-6 tracking-tight">
                  Aanbevolen
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {featured.map((classified) => {
                    const isOwnClassified =
                      currentUserId === classified.user_id;
                    return (
                      <div
                        key={classified.id}
                        className="lg:col-span-2 lg:row-span-2"
                      >
                        <article className="group h-full rounded-2xl p-6 md:p-8 bg-card shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden relative border border-border flex flex-col">
                          {/* Subtle background accent using primary color */}
                          <div className="absolute top-0 right-0 w-40 h-40 bg-primary rounded-full blur-3xl opacity-15 -z-10" />

                          <Link
                            href={`/zoekertjes/${classified.id}`}
                            className="flex flex-col flex-1 min-h-0"
                          >
                            {/* Featured badge */}
                            <div className="mb-6 flex items-center gap-2">
                              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary tracking-tight">
                                ⭐ AANBEVOLEN
                              </span>
                            </div>

                            {/* Main content */}
                            <div className="space-y-4 flex-1">
                              {/* Title + Position */}
                              <div>
                                <h3 className="text-2xl font-bold text-foreground tracking-tight leading-tight wrap-anywhere line-clamp-3 group-hover:text-primary transition-colors">
                                  {classified.title}
                                </h3>
                                {classified.position && (
                                  <p className="text-base font-semibold text-primary mt-2 capitalize">
                                    {getPositionLabel(classified.position)}
                                  </p>
                                )}
                              </div>

                              {/* Poster: contact name and team */}
                              {posterLine(classified) && (
                                <p className="text-base font-medium text-foreground/80 wrap-anywhere">
                                  {posterLine(classified)}
                                </p>
                              )}

                              {/* Division + Province */}
                              <div className="flex flex-wrap items-center gap-3 pt-2">
                                {classified.division && (
                                  <span className="text-sm font-medium text-foreground/70">
                                    {getDivisionLabel(classified.division)}
                                  </span>
                                )}
                                {classified.province && (
                                  <span className="text-sm font-medium text-foreground/60 flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {getProvinceLabel(classified.province)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Footer */}
                            <div className="flex flex-col gap-2 pt-6 border-t border-border">
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                  <RelativeTime date={classified.created_at} />
                                </p>
                              </div>
                              <p className="text-xs text-foreground/60 flex items-center gap-2 flex-wrap">
                                Geplaatst door{" "}
                                <span className="font-medium text-foreground/80">
                                  {classified.profiles?.username || "Onbekend"}
                                </span>
                                {classified.profiles?.is_verified_source && (
                                  <VerifiedBadge size="sm" />
                                )}
                              </p>
                            </div>
                          </Link>

                          {/* CTA Button */}
                          {!isOwnClassified && (
                            <button
                              type="button"
                              onClick={() => handleContactClick(classified)}
                              disabled={checkingConversation}
                              className="w-full mt-6 px-4 py-3 rounded-xl font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-all duration-150 text-sm flex items-center justify-center gap-2 group-hover:shadow-md"
                            >
                              <MessageSquare className="h-4 w-4" />
                              Contact opnemen
                            </button>
                          )}
                        </article>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Standard Grid Section */}
            {classifieds.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-foreground mb-6 tracking-tight">
                  Alle zoekertjes
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {classifieds.map((classified) => {
                    const isOwnClassified =
                      currentUserId === classified.user_id;

                    return (
                      <article
                        key={classified.id}
                        className="group rounded-xl p-5 bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 flex flex-col h-full"
                      >
                        <Link
                          href={`/zoekertjes/${classified.id}`}
                          className="flex flex-col flex-1 min-h-0"
                        >
                          {/* Type badge */}
                          <div className="mb-4">
                            <Badge
                              variant="outline"
                              className={`${
                                CLASSIFIED_TYPE_COLORS[classified.type]
                              } text-xs font-semibold`}
                            >
                              {CLASSIFIED_TYPE_LABELS[classified.type]}
                            </Badge>
                          </div>

                          {/* Title + Position */}
                          <div className="mb-3 flex-1">
                            <h3 className="font-semibold text-foreground text-base leading-snug wrap-anywhere line-clamp-3 group-hover:text-primary transition-colors">
                              {classified.title}
                            </h3>
                            {classified.position && (
                              <p className="text-sm text-primary font-medium mt-1 capitalize">
                                {getPositionLabel(classified.position)}
                              </p>
                            )}
                          </div>

                          {/* Poster: contact name and team */}
                          {posterLine(classified) && (
                            <p className="text-sm font-medium text-foreground/80 mb-2 line-clamp-1 wrap-anywhere">
                              {posterLine(classified)}
                            </p>
                          )}

                          {/* Division + Province */}
                          <div className="flex flex-col gap-1 mb-4 text-xs text-foreground/60">
                            {classified.division && (
                              <span className="font-medium">
                                {getDivisionLabel(classified.division)}
                              </span>
                            )}
                            {classified.province && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {getProvinceLabel(classified.province)}
                              </span>
                            )}
                          </div>

                          {/* Date + author + trust */}
                          <div className="text-xs text-muted-foreground mb-3 border-t border-border pt-3 space-y-2">
                            <p>
                              <RelativeTime date={classified.created_at} />
                            </p>
                            <p className="text-foreground/60 flex items-center gap-2 flex-wrap">
                              Door{" "}
                              <span className="font-medium text-foreground/80">
                                {classified.profiles?.username || "Onbekend"}
                              </span>
                              {classified.profiles?.is_verified_source && (
                                <VerifiedBadge size="sm" />
                              )}
                            </p>
                          </div>
                        </Link>

                        {/* CTA Button */}
                        {!isOwnClassified && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleContactClick(classified);
                            }}
                            disabled={checkingConversation}
                            className="w-full px-3 py-2 rounded-lg font-semibold text-primary-foreground text-sm bg-primary hover:bg-primary/90 transition-all duration-150 flex items-center justify-center gap-2 mt-auto"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Contact
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom pagination */}
            <PageNav
              currentPage={currentPage}
              totalPages={totalPages}
              pageUrl={pageUrl}
            />
          </div>
        )}
      </div>

      {/* Contact Modal */}
      {contactModal && selectedClassified && (
        <ContactModal
          userId={selectedClassified.user_id}
          userName={selectedClassified.profiles?.username || "deze gebruiker"}
          adId={selectedClassified.id}
          onClose={() => setContactModal(null)}
        />
      )}
    </div>
  );
}
