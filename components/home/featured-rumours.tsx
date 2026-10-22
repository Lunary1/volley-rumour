import Link from "next/link";
import { Flame } from "lucide-react";
import { RumourCard } from "@/components/rumour-card";
import { RumourVotesProvider } from "@/components/rumour-votes";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { getFeaturedRumours } from "@/lib/public-data";
import { voteCounts } from "@/lib/rumours";
import { getUserVotes } from "@/lib/votes";

// Hot topics: the heading is sent at once, the cards stream in (#211). They
// wait for the user's votes, so they come last.

export function FeaturedRumoursSection({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title="Hot topics — nu besproken"
          description="Meest besproken transfers van dit moment"
          href="/geruchten"
        />
        {children}
      </div>
    </section>
  );
}

export async function FeaturedRumours() {
  const rumours = await getFeaturedRumours();
  if (rumours.length === 0) {
    return (
      <EmptyState
        icon={Flame}
        title="Nog geen geruchten?"
        description="Jij kan het eerste gerucht delen."
      >
        <Button asChild>
          <Link href="/geruchten/nieuw">Gerucht delen</Link>
        </Button>
      </EmptyState>
    );
  }

  const userVotes = await getUserVotes(rumours.map((r) => r.id));
  return (
    <RumourVotesProvider
      rumours={voteCounts(rumours)}
      userVotes={userVotes.votes}
      currentUserId={userVotes.userId}
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rumours.map((rumour) => (
          <RumourCard
            key={rumour.id}
            rumour={rumour}
            currentUserId={userVotes.userId}
          />
        ))}
      </div>
    </RumourVotesProvider>
  );
}

export function FeaturedRumoursSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-80 animate-pulse rounded-xl border border-border bg-card"
        />
      ))}
    </div>
  );
}
