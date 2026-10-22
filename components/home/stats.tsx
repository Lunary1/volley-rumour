import { Flame, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { getHomepageDataOrEmpty } from "@/lib/public-data";

// Real counts under the hero. The skeleton has the same rows, with a
// placeholder of the number's line height, so nothing moves (#211).

const STATS: {
  key: "rumours" | "transfers" | "users";
  icon: LucideIcon;
  label: string;
}[] = [
  { key: "rumours", icon: Flame, label: "Actieve geruchten" },
  { key: "transfers", icon: TrendingUp, label: "Bevestigde transfers" },
  { key: "users", icon: Users, label: "Leden" },
];

export async function Stats() {
  const { counts } = await getHomepageDataOrEmpty();
  return (
    <StatsStrip
      value={(key) => (
        <div className="text-xl font-bold tabular-nums sm:text-2xl">
          {counts[key]}
        </div>
      )}
    />
  );
}

export function StatsSkeleton() {
  return (
    <StatsStrip
      value={() => (
        <div
          className="h-7 w-10 animate-pulse rounded bg-muted sm:h-8"
          aria-hidden
        />
      )}
    />
  );
}

function StatsStrip({
  value,
}: {
  value: (key: (typeof STATS)[number]["key"]) => React.ReactNode;
}) {
  return (
    <section className="border-b border-border py-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 gap-4 sm:gap-6">
          {STATS.map(({ key, icon: Icon, label }) => (
            <div key={key} className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-5 text-muted-foreground" />
              </div>
              <div>
                {value(key)}
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
