import { TrendingUp } from "lucide-react";
import { TransferCard } from "@/components/transfer-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { getHomepageDataOrEmpty } from "@/lib/public-data";

// The six latest confirmed transfers; the heading is sent at once (#211).

export function LatestTransfersSection({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="border-y border-border bg-muted/20 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title="Laatste transfers"
          description="Dit seizoen bevestigd"
          href="/transfers"
        />
        {children}
      </div>
    </section>
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {latestTransfers.map((transfer) => (
        <TransferCard key={transfer.id} transfer={transfer} />
      ))}
    </div>
  );
}

export function LatestTransfersSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-xl border border-border bg-card"
        />
      ))}
    </div>
  );
}
