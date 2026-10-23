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
import { getHomeClassifiedsOrEmpty } from "@/lib/public-data";
import { RUMOUR_DIVISIONS } from "@/lib/rumours";
import {
  DEFAULT_CLASSIFIED_FILTERS,
  classifiedsUrl,
} from "@/lib/classifieds-filters";
import { getDivisionLabel, getProvinceLabel } from "@/lib/classifieds-utils";
import { cn } from "@/lib/utils";

// The zoekertjes on the homepage (#240): the newest online ads, and every
// division with how many ads it has, each a link to /zoekertjes filtered on
// it. Only titles, types, divisions and provinces: no names.

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
  const { perDivision } = await getHomeClassifiedsOrEmpty();
  return <DivisionGrid count={(key) => perDivision[key] ?? 0} />;
}

export function DivisionIndexSkeleton() {
  return <DivisionGrid count={() => null} />;
}

function DivisionGrid({
  count,
}: {
  count: (division: string) => number | null;
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
              const n = count(division);
              const label = getDivisionLabel(division);
              return (
                <li key={division}>
                  {/* It shows "Nationale 1" under the heading Heren; a
                      screen reader hears "Nationale 1 Heren: 3 zoekertjes". */}
                  <Link
                    href={classifiedsUrl(DEFAULT_CLASSIFIED_FILTERS, {
                      division,
                    })}
                    aria-label={
                      n === null
                        ? label
                        : `${label}: ${n} ${n === 1 ? "zoekertje" : "zoekertjes"}`
                    }
                    className="flex h-12 items-center justify-between gap-2 rounded-md border border-border bg-card px-3 text-sm outline-none transition-colors hover:border-border-strong hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="truncate font-medium">
                      {label.replace(/ (heren|dames)$/i, "")}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-meta tabular-nums",
                        n ? "font-semibold" : "text-muted-foreground",
                      )}
                    >
                      {n === null ? (
                        <span className="block h-4 w-4 animate-pulse rounded bg-muted" />
                      ) : (
                        n
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
