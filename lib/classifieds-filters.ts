import { RUMOUR_DIVISIONS } from "@/lib/rumours";
import {
  CLASSIFIED_TYPE_LABELS,
  POSITION_LABELS,
  PROVINCE_LABELS,
} from "@/lib/classifieds-utils";

// The filters of /zoekertjes live in the URL (#85), so a search can be shared
// and the server filters and pages. Unknown values are ignored, never shown.

export const CLASSIFIEDS_PER_PAGE = 12;

export const CLASSIFIED_SORTS = {
  newest: "Nieuwste eerst",
  oldest: "Oudste eerst",
  title: "Titel (A-Z)",
} as const;

export type ClassifiedSort = keyof typeof CLASSIFIED_SORTS;

export type ClassifiedFilters = {
  type: string | null;
  province: string | null;
  division: string | null;
  position: string | null;
  q: string;
  sort: ClassifiedSort;
  page: number;
};

/** URL parameter for each filter. Dutch, because people share these links. */
const PARAMS = {
  type: "type",
  province: "provincie",
  division: "reeks",
  position: "positie",
  q: "q",
  sort: "sort",
  page: "pagina",
} as const satisfies Record<keyof ClassifiedFilters, string>;

export const DEFAULT_CLASSIFIED_FILTERS: ClassifiedFilters = {
  type: null,
  province: null,
  division: null,
  position: null,
  q: "",
  sort: "newest",
  page: 1,
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function oneOf(labels: Record<string, string>, value: string | undefined) {
  return value && Object.hasOwn(labels, value) ? value : null;
}

/**
 * Letters, digits and a few separators only. The search goes into a PostgREST
 * `or` filter and an `ilike` pattern, where commas, brackets, quotes, `%` and
 * `_` mean something.
 */
export function cleanClassifiedSearch(value: string | undefined): string {
  return (value ?? "")
    .replace(/[^\p{L}\p{N}\s'.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export function parseClassifiedFilters(
  params: SearchParams,
): ClassifiedFilters {
  const page = Number.parseInt(first(params, PARAMS.page) ?? "", 10);
  return {
    type: oneOf(CLASSIFIED_TYPE_LABELS, first(params, PARAMS.type)),
    province: oneOf(PROVINCE_LABELS, first(params, PARAMS.province)),
    division: oneOf(RUMOUR_DIVISIONS, first(params, PARAMS.division)),
    position: oneOf(POSITION_LABELS, first(params, PARAMS.position)),
    q: cleanClassifiedSearch(first(params, PARAMS.q)),
    sort:
      (oneOf(CLASSIFIED_SORTS, first(params, PARAMS.sort)) as ClassifiedSort) ??
      "newest",
    page: Number.isSafeInteger(page) && page > 1 ? page : 1,
  };
}

/**
 * The /zoekertjes URL for these filters, leaving out defaults. Changing a
 * filter goes back to page 1 unless `page` is given.
 */
export function classifiedsUrl(
  filters: ClassifiedFilters,
  changes: Partial<ClassifiedFilters> = {},
): string {
  const next = {
    ...filters,
    page: 1,
    ...changes,
  };
  const params = new URLSearchParams();
  for (const key of Object.keys(PARAMS) as (keyof ClassifiedFilters)[]) {
    const value = next[key];
    if (
      value === null ||
      value === "" ||
      value === DEFAULT_CLASSIFIED_FILTERS[key]
    )
      continue;
    params.set(PARAMS[key], String(value));
  }
  const query = params.toString();
  return query ? `/zoekertjes?${query}` : "/zoekertjes";
}

/** Whether anything differs from the unfiltered list (page aside). */
export function hasClassifiedFilters(filters: ClassifiedFilters): boolean {
  return (
    !!filters.type ||
    !!filters.province ||
    !!filters.division ||
    !!filters.position ||
    !!filters.q ||
    filters.sort !== "newest"
  );
}
