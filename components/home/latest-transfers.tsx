import { ArrowRight, ExternalLink, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Ledger,
  LedgerList,
  LedgerRow,
  LedgerRowSkeleton,
} from "@/components/ui/ledger";
import { getHomepageDataOrEmpty } from "@/lib/public-data";
import { formatDate } from "@/lib/dates";
import { isRetirement } from "@/lib/transfers";

// The six latest confirmed transfers, as rows like the transfer board (#240).
// A transfer has no page of its own, so a row isn't a link; the official
// source is.

const ROWS = 6;

function TransfersFrame({ children }: { children: React.ReactNode }) {
  return (
    <Ledger
      title="Bevestigd"
      description="Transfers met een officiële bron"
      href="/transfers"
      linkLabel="Alle transfers"
    >
      {children}
    </Ledger>
  );
}

export async function LatestTransfers() {
  const { latestTransfers } = await getHomepageDataOrEmpty();
  if (latestTransfers.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Nog geen transfers"
        description="Transfers verschijnen hier zodra ze bevestigd zijn."
      />
    );
  }

  return (
    <TransfersFrame>
      <LedgerList>
        {latestTransfers.map((transfer) => {
          const retirement = isRetirement(transfer.category);
          return (
            <LedgerRow key={transfer.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{transfer.player_name}</p>
                <p className="flex min-w-0 items-center gap-1.5 text-meta text-muted-foreground">
                  {transfer.from_club && (
                    <>
                      <span className="truncate">{transfer.from_club}</span>
                      <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                      <span className="sr-only">naar</span>
                    </>
                  )}
                  <span className="truncate font-medium text-foreground">
                    {retirement ? "Stopt" : transfer.to_club}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-meta text-muted-foreground">
                {transfer.confirmed_at && (
                  <span>{formatDate(transfer.confirmed_at, "d MMM")}</span>
                )}
                {transfer.source_url && (
                  <a
                    href={transfer.source_url}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="flex items-center gap-1 text-primary-text underline underline-offset-2"
                  >
                    Bron
                    <span className="sr-only"> (officieel)</span>
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </div>
            </LedgerRow>
          );
        })}
      </LedgerList>
    </TransfersFrame>
  );
}

export function LatestTransfersSkeleton() {
  return (
    <TransfersFrame>
      <LedgerList>
        {Array.from({ length: ROWS }, (_, i) => (
          <LedgerRowSkeleton key={i} />
        ))}
      </LedgerList>
    </TransfersFrame>
  );
}
