"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  Calendar,
  MessageSquare,
  Star,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { ContactModal } from "@/components/contact-modal";
import { getExistingConversation } from "@/app/actions/messages";
import { useRouter } from "next/navigation";
import { getDivisionLabel, getProvinceLabel } from "@/lib/classifieds-utils";

interface Classified {
  id: string;
  title: string;
  type: string;
  description: string;
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
  } | null;
}

interface ClassifiedsListProps {
  classifieds: Classified[];
  currentUserId?: string;
}

const classifiedTypeLabels: Record<string, string> = {
  player_seeks_team: "Speler zoekt club",
  team_seeks_player: "Club zoekt speler",
  trainer_seeks_team: "Trainer zoekt club",
  team_seeks_trainer: "Club zoekt trainer",
};

const classifiedTypeColors: Record<string, string> = {
  player_seeks_team: "bg-primary/20 text-primary border-primary/30",
  team_seeks_player: "bg-accent/20 text-accent border-accent/30",
  trainer_seeks_team: "bg-chart-3/20 text-chart-3 border-chart-3/30",
  team_seeks_trainer: "bg-chart-4/20 text-chart-4 border-chart-4/30",
};

const provinces = [
  "Antwerpen",
  "Brussel",
  "Henegouwen",
  "Limburg",
  "Luik",
  "Luxemburg",
  "Namen",
  "Oost-Vlaanderen",
  "Waals-Brabant",
  "West-Vlaanderen",
];

const ITEMS_PER_PAGE = 12;

export function ClassifiedsList({
  classifieds,
  currentUserId,
}: ClassifiedsListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [contactModal, setContactModal] = useState<string | null>(null);
  const [checkingConversation, setCheckingConversation] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { filteredAndSorted, totalPages, totalResults } = useMemo(() => {
    let filtered = classifieds.filter((ad) => {
      const matchesSearch =
        ad.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ad.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ad.profiles?.username.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = !selectedType || ad.type === selectedType;
      const matchesProvince =
        !selectedProvince || ad.province === selectedProvince;

      return matchesSearch && matchesType && matchesProvince;
    });

    // Separate featured and regular
    const featured = filtered.filter((ad) => ad.is_featured);
    const regular = filtered.filter((ad) => !ad.is_featured);

    // Sort each group
    const sortFunc = (a: Classified, b: Classified) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "oldest":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    };

    featured.sort(sortFunc);
    regular.sort(sortFunc);

    const allSorted = [...featured, ...regular];
    const total = allSorted.length;
    const pages = Math.ceil(total / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedResults = allSorted.slice(
      startIdx,
      startIdx + ITEMS_PER_PAGE,
    );

    return {
      filteredAndSorted: paginatedResults,
      totalPages: pages,
      totalResults: total,
    };
  }, [
    classifieds,
    searchQuery,
    selectedType,
    selectedProvince,
    sortBy,
    currentPage,
  ]);

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

  const hasActiveFilters = searchQuery || selectedType || selectedProvince;
  const pageStartNum = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const pageEndNum = Math.min(currentPage * ITEMS_PER_PAGE, totalResults);

  const selectedClassified = classifieds.find((c) => c.id === contactModal);

  // Reset to page 1 when filters change
  const handleFilterChange = (callback: () => void) => {
    setCurrentPage(1);
    callback();
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op titel, beschrijving of auteur..."
            value={searchQuery}
            onChange={(e) =>
              handleFilterChange(() => setSearchQuery(e.target.value))
            }
            className="pl-10 bg-background"
          />
        </div>
        <Button
          variant={hasActiveFilters ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          className="px-4"
        >
          Filters {hasActiveFilters && "✓"}
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-card p-4 rounded-lg border border-border space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Type Filter */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Type
              </label>
              <select
                value={selectedType || ""}
                onChange={(e) =>
                  handleFilterChange(() =>
                    setSelectedType(e.target.value || null),
                  )
                }
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">Alle typen</option>
                <option value="player_seeks_team">Speler zoekt club</option>
                <option value="team_seeks_player">Club zoekt speler</option>
                <option value="trainer_seeks_team">Trainer zoekt club</option>
                <option value="team_seeks_trainer">Club zoekt trainer</option>
              </select>
            </div>

            {/* Province Filter */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Provincie
              </label>
              <select
                value={selectedProvince || ""}
                onChange={(e) =>
                  handleFilterChange(() =>
                    setSelectedProvince(e.target.value || null),
                  )
                }
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">Alle provincies</option>
                {provinces.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Sorteren
              </label>
              <select
                value={sortBy}
                onChange={(e) =>
                  handleFilterChange(() => setSortBy(e.target.value))
                }
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="newest">Nieuwste eerst</option>
                <option value="oldest">Oudste eerst</option>
                <option value="title">Titel (A-Z)</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentPage(1);
                setSearchQuery("");
                setSelectedType(null);
                setSelectedProvince(null);
                setSortBy("newest");
              }}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Filters wissen
            </Button>
          )}
        </div>
      )}

      {/* Results */}
      {totalResults === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            {classifieds.length === 0
              ? "Nog geen zoekertjes geplaatst"
              : "Geen zoekertjes gevonden met deze filters"}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Results info and pagination controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-2">
            <p className="text-sm text-muted-foreground">
              {totalResults} zoekertje{totalResults !== 1 ? "s" : ""} • Toon{" "}
              {pageStartNum}-{pageEndNum}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-fit">
                  Blz {currentPage} van {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Featured/Promoted Section */}
          {filteredAndSorted.filter((c) => c.is_featured).length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl font-bold text-foreground mb-6 tracking-tight">
                Aanbevolen
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredAndSorted
                  .filter((c) => c.is_featured)
                  .slice(0, 2)
                  .map((classified) => {
                    const isOwnClassified =
                      currentUserId === classified.user_id;
                    return (
                      <div
                        key={classified.id}
                        className="lg:col-span-2 lg:row-span-2"
                      >
                        <div
                          className="group h-full rounded-2xl p-6 md:p-8 bg-card shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden relative border border-border flex flex-col"
                          onClick={() => {
                            if (!isOwnClassified) {
                              handleContactClick(classified);
                            }
                          }}
                        >
                          {/* Subtle background accent using primary color */}
                          <div className="absolute top-0 right-0 w-40 h-40 bg-primary rounded-full blur-3xl opacity-15 -z-10" />

                          {/* Featured badge */}
                          <div className="mb-6 flex items-center gap-2">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary tracking-tight">
                              ⭐ AANBEVOLEN
                            </span>
                          </div>

                          {/* Main content */}
                          <div className="space-y-4 flex-1">
                            {/* Contact name + Position */}
                            <div>
                              <h3 className="text-2xl font-bold text-foreground tracking-tight leading-tight">
                                {classified.contact_name || "Onbekend"}
                              </h3>
                              {classified.position && (
                                <p className="text-base font-semibold text-primary mt-2">
                                  {classified.position}
                                </p>
                              )}
                            </div>

                            {/* Team name */}
                            {classified.team_name && (
                              <p className="text-base font-medium text-foreground/80">
                                {classified.team_name}
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
                                {formatDistanceToNow(
                                  new Date(classified.created_at),
                                  {
                                    addSuffix: true,
                                    locale: nl,
                                  },
                                )}
                              </p>
                            </div>
                            <p className="text-xs text-foreground/60">
                              Geplaatst door{" "}
                              <span className="font-medium text-foreground/80">
                                {classified.profiles?.username || "Onbekend"}
                              </span>
                            </p>
                          </div>

                          {/* CTA Button */}
                          {!isOwnClassified && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleContactClick(classified);
                              }}
                              disabled={checkingConversation}
                              className="w-full mt-6 px-4 py-3 rounded-xl font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-all duration-150 text-sm flex items-center justify-center gap-2 group-hover:shadow-md"
                            >
                              <MessageSquare className="h-4 w-4" />
                              Contact opnemen
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Standard Grid Section */}
          <div>
            <h2 className="text-xl font-bold text-foreground mb-6 tracking-tight">
              Alle zoekertjes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredAndSorted
                .filter((c) => !c.is_featured)
                .map((classified) => {
                  const isOwnClassified = currentUserId === classified.user_id;

                  return (
                    <div
                      key={classified.id}
                      className="group rounded-xl p-5 bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer flex flex-col h-full"
                      onClick={() => {
                        if (!isOwnClassified) {
                          handleContactClick(classified);
                        }
                      }}
                    >
                      {/* Type badge */}
                      <div className="mb-4">
                        <Badge
                          variant="outline"
                          className={`${classifiedTypeColors[classified.type]} text-xs font-semibold`}
                        >
                          {classifiedTypeLabels[classified.type]}
                        </Badge>
                      </div>

                      {/* Contact name + Position */}
                      <div className="mb-3 flex-1">
                        <h3 className="font-semibold text-foreground text-base leading-snug group-hover:text-primary transition-colors">
                          {classified.contact_name || "Onbekend"}
                        </h3>
                        {classified.position && (
                          <p className="text-sm text-primary font-medium mt-1">
                            {classified.position}
                          </p>
                        )}
                      </div>

                      {/* Team name */}
                      {classified.team_name && (
                        <p className="text-sm font-medium text-foreground/80 mb-2 line-clamp-1">
                          {classified.team_name}
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

                      {/* Date */}
                      <div className="text-xs text-muted-foreground mb-3 border-t border-border pt-3 space-y-2">
                        <p>
                          {formatDistanceToNow(
                            new Date(classified.created_at),
                            {
                              addSuffix: true,
                              locale: nl,
                            },
                          )}
                        </p>
                        <p className="text-foreground/60">
                          Door{" "}
                          <span className="font-medium text-foreground/80">
                            {classified.profiles?.username || "Onbekend"}
                          </span>
                        </p>
                      </div>

                      {/* CTA Button */}
                      {!isOwnClassified && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContactClick(classified);
                          }}
                          disabled={checkingConversation}
                          className="w-full px-3 py-2 rounded-lg font-semibold text-primary-foreground text-sm bg-primary hover:bg-primary/90 transition-all duration-150 flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Contact
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Bottom pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Vorige
              </Button>
              <div className="px-4 py-2 text-sm text-muted-foreground">
                Pagina {currentPage} van {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
              >
                Volgende
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Contact Modal */}
      {contactModal && selectedClassified && (
        <ContactModal
          userId={selectedClassified.user_id}
          userName={selectedClassified.profiles?.username || "deze gebruiker"}
          adId={selectedClassified.id}
          adType="classified"
          onClose={() => setContactModal(null)}
        />
      )}
    </div>
  );
}
