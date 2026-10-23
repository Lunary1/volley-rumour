import { Suspense } from "react";
import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/coming-soon-page";
import { SectionHeader } from "@/components/ui/section-header";
import {
  FeaturedRumours,
  FeaturedRumoursSection,
  FeaturedRumoursSkeleton,
} from "@/components/home/featured-rumours";
import { Hero } from "@/components/home/hero";
import { JoinCta } from "@/components/home/join-cta";
import {
  LatestTransfers,
  LatestTransfersSkeleton,
} from "@/components/home/latest-transfers";
import {
  DivisionIndex,
  DivisionIndexSkeleton,
  NewestClassifieds,
  NewestClassifiedsSkeleton,
} from "@/components/home/market";
import { Stats, StatsSkeleton } from "@/components/home/stats";
import {
  TransferBoard,
  TransferBoardSkeleton,
} from "@/components/home/transfer-board";
import {
  TrustedSources,
  TrustedSourcesSkeleton,
} from "@/components/home/trusted-sources";
import { isComingSoon } from "@/lib/coming-soon";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// Rendered per request: the hot topics show the user's own votes.
export const dynamic = "force-dynamic";

// The question first, the transfer board beside it (#240), then the hot
// topics to vote on, the zoekertjes and the confirmed transfers. The hero's
// text goes out at once; each section fetches its own data and streams in
// behind a skeleton of the same size (#211). Nothing moves by itself.
export default function HomePage() {
  if (isComingSoon()) {
    return <ComingSoonPage />;
  }

  return (
    <div className="min-h-screen">
      <Hero
        stats={
          <Suspense fallback={<StatsSkeleton />}>
            <Stats />
          </Suspense>
        }
        board={
          <Suspense fallback={<TransferBoardSkeleton />}>
            <TransferBoard />
          </Suspense>
        }
      />

      <FeaturedRumoursSection>
        <Suspense fallback={<FeaturedRumoursSkeleton />}>
          <FeaturedRumours />
        </Suspense>
      </FeaturedRumoursSection>

      <section className="border-y border-border bg-muted/40 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title="Zoekertjes"
            description="Spelers, trainers en teams die elkaar zoeken"
            href="/zoekertjes/nieuw"
            linkLabel="Zoekertje plaatsen"
          />
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-7">
              <Suspense fallback={<NewestClassifiedsSkeleton />}>
                <NewestClassifieds />
              </Suspense>
            </div>
            <div className="min-w-0 lg:col-span-5">
              <h3 className="mb-4 text-lg font-semibold tracking-tight">
                Per reeks
              </h3>
              <Suspense fallback={<DivisionIndexSkeleton />}>
                <DivisionIndex />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="min-w-0 lg:col-span-7">
            <Suspense fallback={<LatestTransfersSkeleton />}>
              <LatestTransfers />
            </Suspense>
          </div>
          <div className="min-w-0 lg:col-span-5">
            <Suspense fallback={<TrustedSourcesSkeleton />}>
              <TrustedSources />
            </Suspense>
          </div>
        </div>
      </section>

      <JoinCta />
    </div>
  );
}
