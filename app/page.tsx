import { Suspense } from "react";
import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ComingSoonPage } from "@/components/coming-soon-page";
import {
  FeaturedRumours,
  FeaturedRumoursSection,
  FeaturedRumoursSkeleton,
} from "@/components/home/featured-rumours";
import { Hero } from "@/components/home/hero";
import { JoinCta } from "@/components/home/join-cta";
import {
  LatestTransfers,
  LatestTransfersSection,
  LatestTransfersSkeleton,
} from "@/components/home/latest-transfers";
import { Stats, StatsSkeleton } from "@/components/home/stats";
import {
  TrustedSources,
  TrustedSourcesSkeleton,
} from "@/components/home/trusted-sources";
import { isComingSoon } from "@/lib/coming-soon";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// Rendered per request: the hot topics show the user's own votes.
export const dynamic = "force-dynamic";

// The hero goes out at once; each section fetches its own data and streams
// in behind a skeleton of the same size (#211).
export default function HomePage() {
  if (isComingSoon()) {
    return <ComingSoonPage />;
  }

  return (
    <div className="min-h-screen">
      <SpeedInsights />
      <Hero
        aside={
          <Suspense fallback={<TrustedSourcesSkeleton />}>
            <TrustedSources />
          </Suspense>
        }
      />
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>
      <FeaturedRumoursSection>
        <Suspense fallback={<FeaturedRumoursSkeleton />}>
          <FeaturedRumours />
        </Suspense>
      </FeaturedRumoursSection>
      <LatestTransfersSection>
        <Suspense fallback={<LatestTransfersSkeleton />}>
          <LatestTransfers />
        </Suspense>
      </LatestTransfersSection>
      <JoinCta />
    </div>
  );
}
