import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { VerifiedBadge } from "@/components/verified-badge";
import { TRUSTED_SOURCE_MIN_RESOLVED, formatTrackRecord } from "@/lib/rumours";
import { getTrustedSources } from "@/lib/trusted-sources";

// The top three Betrouwbare bronnen on the homepage (#88, D-005). The list
// area is always three rows high, so the card doesn't change size when it
// replaces its skeleton (#211).

export async function TrustedSources() {
  const sources = await getTrustedSources(3).catch((error) => {
    console.error("Error loading trusted sources:", error);
    return [];
  });

  return (
    <TrustedSourcesCard>
      {sources.length === 0 ? (
        <p className="my-auto text-sm text-muted-foreground">
          Bijdragers met minstens {TRUSTED_SOURCE_MIN_RESOLVED} afgeronde
          geruchten verschijnen hier, de meest accurate eerst.
        </p>
      ) : (
        <ol className="space-y-2">
          {sources.map((source, i) => (
            <li
              key={source.id}
              className="flex h-10 items-center justify-between gap-2 rounded-lg px-2 transition-colors hover:bg-muted/50"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 text-center text-sm font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate font-medium">{source.username}</span>
                {source.is_verified_source && <VerifiedBadge size="sm" />}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">
                {formatTrackRecord(source)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {/* Fills the space of the missing rows (at most two lines). */}
      {sources.length > 0 && sources.length < 3 && (
        <p className="my-auto px-2 text-sm text-muted-foreground">
          Met minstens {TRUSTED_SOURCE_MIN_RESOLVED} afgeronde geruchten kom jij
          hier ook bij.
        </p>
      )}
    </TrustedSourcesCard>
  );
}

export function TrustedSourcesSkeleton() {
  return (
    <TrustedSourcesCard>
      <div className="space-y-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </TrustedSourcesCard>
  );
}

function TrustedSourcesCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <CheckCircle className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Betrouwbare bronnen</h2>
        </div>
        {/* Three rows of h-10 with space-y-2 between them */}
        <div className="flex min-h-34 flex-col">{children}</div>
        <Link
          href="/betrouwbare-bronnen"
          className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Bekijk alle betrouwbare bronnen
          <ArrowRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
