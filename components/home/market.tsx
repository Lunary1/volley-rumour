import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Ledger,
  LedgerList,
  LedgerRow,
  LedgerRowSkeleton,
} from "@/components/ui/ledger";
import { ClassifiedTypeLabel } from "@/components/classified-type-label";
import { RelativeTime } from "@/components/relative-time";
import {
  getHomeClassifiedsOrEmpty,
  getLopendeRumoursPerDivision,
} from "@/lib/public-data";
import { RUMOUR_DIVISIONS } from "@/lib/rumours";
import {
  DEFAULT_CLASSIFIED_FILTERS,
  classifiedsUrl,
} from "@/lib/classifieds-filters";
import { getDivisionLabel, getProvinceLabel } from "@/lib/classifieds-utils";
import { cn } from "@/lib/utils";

// The zoekertjes on the homepage (#240): the newest online ads, and every
// division with how many ads and lopende rumours it has, each a link to the
// list filtered on it (#242). Only titles, types, divisions and provinces: no
// names.

const NEWEST = 4;

function NewestFrame({ children }: { children: React.ReactNode }) {
  return (
    <Ledger
      title="Nu op de markt"
      description="De nieuwste zoekertjes van spelers, trainers en teams"
      href="/zoekertjes"
      linkLabel="Alle zoekertjes"
      headingLevel="h3"
    >
      {children}
    </Ledger>
  );
}

export async function NewestClassifieds() {
  const { latest } = await getHomeClassifiedsOrEmpty();
  if (latest.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="Nog geen zoekertjes"
        description="Zoekt jouw club een speler of trainer? Plaats het eerste zoekertje."
      >
        <Button asChild>
          <Link href="/zoekertjes/nieuw">Zoekertje plaatsen</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <NewestFrame>
      <LedgerList>
        {latest.map((ad) => (
          <LedgerRow key={ad.id} href={`/zoekertjes/${ad.id}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{ad.title}</p>
              <p className="truncate text-meta text-muted-foreground">
                {[getDivisionLabel(ad.division), getProvinceLabel(ad.province)]
                  .filter(Boolean)
                  .join(" · ")}
                {" · "}
                <RelativeTime date={ad.created_at} strict />
              </p>
            </div>
            <span className="hidden shrink-0 sm:block">
              <ClassifiedTypeLabel type={ad.type} />
            </span>
          </LedgerRow>
        ))}
      </LedgerList>
    </NewestFrame>
  );
}

export function NewestClassifiedsSkeleton() {
  return (
    <NewestFrame>
      <LedgerList>
        {Array.from({ length: NEWEST }, (_, i) => (
          <LedgerRowSkeleton key={i} />
        ))}
      </LedgerList>
    </NewestFrame>
  );
}

const DIVISION_GROUPS = [
  { title: "Heren", suffix: "_heren" },
  { title: "Dames", suffix: "_dames" },
] as const;

/** The divisions, top to bottom, of one gender. */
function divisionsOf(suffix: string) {
  return Object.keys(RUMOUR_DIVISIONS).filter((key) => key.endsWith(suffix));
}

export async function DivisionIndex() {
  const [{ perDivision }, rumours] = await Promise.all([
    getHomeClassifiedsOrEmpty(),
    getLopendeRumoursPerDivision().catch((error) => {
      console.error("Error counting rumours per division:", error);
      return {} as Record<string, number>;
    }),
  ]);
  return (
    <DivisionGrid
      counts={(key) => ({
        ads: perDivision[key] ?? 0,
        rumours: rumours[key] ?? 0,
      })}
    />
  );
}

export function DivisionIndexSkeleton() {
  return <DivisionGrid counts={() => null} />;
}

/**
 * "3 zoekertjes", a link to that list. A screen reader hears the division
 * first: "Nationale 1 Heren: 3 zoekertjes". Before the count arrives it keeps
 * its place, so nothing moves.
 */
function CountLink({
  href,
  label,
  n,
  one,
  many,
}: {
  href: string;
  label: string;
  n: number | null;
  one: string;
  many: string;
}) {
  if (n === null) {
    return (
      <span className="animate-pulse rounded bg-muted text-transparent">
        0 {many}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "rounded tabular-nums underline-offset-4 outline-none hover:text-primary-text hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
        n ? "font-semibold text-foreground" : "text-muted-foreground",
      )}
    >
      <span className="sr-only">{label}: </span>
      {n} {n === 1 ? one : many}
    </Link>
  );
}

function DivisionGrid({
  counts,
}: {
  counts: (division: string) => { ads: number; rumours: number } | null;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
      {DIVISION_GROUPS.map((group) => (
        <div key={group.title}>
          <h4 className="mb-2 text-label font-semibold tracking-wide text-muted-foreground uppercase">
            {group.title}
          </h4>
          <ul className="grid grid-cols-2 gap-2">
            {divisionsOf(group.suffix).map((division) => {
              const n = counts(division);
              const label = getDivisionLabel(division);
              return (
                <li
                  key={division}
                  className="rounded-md border border-border bg-card px-3 py-2"
                >
                  {/* "Nationale 1" under the heading Heren. */}
                  <p className="truncate text-sm font-medium" aria-hidden>
                    {label.replace(/ (heren|dames)$/i, "")}
                  </p>
                  <p className="mt-0.5 flex flex-col items-start text-meta lg:flex-row lg:gap-x-3">
                    <CountLink
                      href={classifiedsUrl(DEFAULT_CLASSIFIED_FILTERS, {
                        division,
                      })}
                      label={label}
                      n={n && n.ads}
                      one="zoekertje"
                      many="zoekertjes"
                    />
                    <CountLink
                      href={`/geruchten?status=rumour&reeks=${division}`}
                      label={label}
                      n={n && n.rumours}
                      one="gerucht"
                      many="geruchten"
                    />
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
