"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DIVISION_LABELS,
  POSITION_LABELS,
  PROVINCE_LABELS,
} from "@/lib/classifieds-utils";
import {
  CLASSIFIED_SORTS,
  classifiedsUrl,
  cleanClassifiedSearch,
  type ClassifiedFilters,
  type ClassifiedSort,
} from "@/lib/classifieds-filters";
import { cn } from "@/lib/utils";

// The interactive parts of the zoekertjes list: the search box and the
// dropdowns. The cards render on the server (#200); these share one
// navigation, so the results dim while the next filter loads.

type Navigation = {
  filters: ClassifiedFilters;
  isNavigating: boolean;
  navigate: (changes: Partial<ClassifiedFilters>, replace?: boolean) => void;
};

const NavigationContext = createContext<Navigation | null>(null);

function useNavigation() {
  const navigation = useContext(NavigationContext);
  if (!navigation) {
    throw new Error("Needs a ClassifiedsNavigationProvider");
  }
  return navigation;
}

export function ClassifiedsNavigationProvider({
  filters,
  children,
}: {
  filters: ClassifiedFilters;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();

  function navigate(changes: Partial<ClassifiedFilters>, replace = false) {
    const url = classifiedsUrl(filters, changes);
    startNavigation(() => {
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    });
  }

  return (
    <NavigationContext.Provider value={{ filters, isNavigating, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
}

/** The results, dimmed while the next filter loads. */
export function ClassifiedsResults({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isNavigating } = useNavigation();
  return (
    <div
      aria-busy={isNavigating}
      className={cn("transition-opacity", isNavigating && "opacity-60")}
    >
      {children}
    </div>
  );
}

export function ClassifiedsSearch() {
  const { filters, navigate } = useNavigation();
  const [searchQuery, setSearchQuery] = useState(filters.q);
  const [shownQuery, setShownQuery] = useState(filters.q);
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

  // Debounce search input (300ms); typing replaces the history entry.
  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = cleanClassifiedSearch(value);
      if (q !== filters.q) navigate({ q }, true);
    }, 300);
  }

  return (
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
  );
}

const SELECT_CLASS =
  "flex-1 sm:flex-none px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm";

/** Province, division, position and sort. */
export function ClassifiedsSelects() {
  const { filters, navigate } = useNavigation();

  return (
    <>
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
        onChange={(e) => navigate({ sort: e.target.value as ClassifiedSort })}
        className={cn(SELECT_CLASS, "sm:min-w-40")}
      >
        {Object.entries(CLASSIFIED_SORTS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </>
  );
}
