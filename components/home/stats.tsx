import { getHomepageDataOrEmpty } from "@/lib/public-data";

// Real counts in the hero (#240). The skeleton has the same rows, with a
// placeholder of the number's line height, so nothing moves (#211).

const STATS: {
  key: "rumours" | "transfers" | "users";
  label: string;
}[] = [
  { key: "rumours", label: "lopende geruchten" },
  { key: "transfers", label: "bevestigde transfers" },
  { key: "users", label: "leden" },
];

export async function Stats() {
  const { counts } = await getHomepageDataOrEmpty();
  return (
    <StatsList
      value={(key) => (
        <span className="text-2xl font-bold tabular-nums">{counts[key]}</span>
      )}
    />
  );
}

export function StatsSkeleton() {
  return (
    <StatsList
      value={() => (
        <span
          className="block h-8 w-10 animate-pulse rounded bg-muted"
          aria-hidden
        />
      )}
    />
  );
}

function StatsList({
  value,
}: {
  value: (key: (typeof STATS)[number]["key"]) => React.ReactNode;
}) {
  return (
    <dl className="grid grid-cols-3 divide-x divide-border border-t border-border pt-5">
      {STATS.map(({ key, label }) => (
        <div
          key={key}
          className="flex flex-col-reverse justify-end px-3 first:pl-0"
        >
          <dt className="text-meta text-muted-foreground">{label}</dt>
          <dd>{value(key)}</dd>
        </div>
      ))}
    </dl>
  );
}
