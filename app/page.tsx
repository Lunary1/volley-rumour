import { createClient } from "@/lib/supabase/server";
import { RumourCard } from "@/components/rumour-card";
import { RumourVotesProvider } from "@/components/rumour-votes";
import { getUserVotes } from "@/lib/votes";
import { voteCounts } from "@/lib/rumours";
import { TransferCard } from "@/components/transfer-card";
import { getHomepageData } from "@/lib/public-data";
import { TrustedSourcesPeek } from "@/components/trusted-sources-peek";
import { getTrustedSources } from "@/lib/trusted-sources";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ComingSoonPage } from "@/components/coming-soon-page";
import { isComingSoon } from "@/lib/coming-soon";
import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// Force dynamic rendering — this route calls cookies() via createClient() and
// must not be statically pre-rendered at build time.
export const dynamic = "force-dynamic";

import { TrendingUp, Users, ArrowRight, Plus, Flame } from "lucide-react";
import Link from "next/link";
import { SpeedInsights } from "@vercel/speed-insights/next";

/* ------------------------------------------------------------------ */
/*  Data fetchers                                                      */
/* ------------------------------------------------------------------ */

async function getFeaturedRumours() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rumours")
    .select(
      `
      *,
      creator:creator_id(username, is_verified_source, rumours_confirmed, rumours_denied)
    `,
    )
    .eq("status", "rumour")
    .order("votes_true", { ascending: false })
    .limit(3);

  return data || [];
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function HomePage() {
  // Coming-soon mode: show landing page when env var is set to "true"
  if (isComingSoon()) {
    return <ComingSoonPage />;
  }

  const [featuredRumours, homepageData, trustedSources] = await Promise.all([
    getFeaturedRumours(),
    // Cached for every visitor (#96); empty when it fails to load.
    getHomepageData().catch((error) => {
      console.error("Error loading homepage data:", error);
      return {
        latestTransfers: [],
        counts: { rumours: 0, transfers: 0, users: 0 },
      };
    }),
    getTrustedSources(3),
  ]);
  const { latestTransfers, counts } = homepageData;
  const userVotes = await getUserVotes(featuredRumours.map((r) => r.id));

  return (
    <div className="min-h-screen">
      <SpeedInsights />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border hero-sport">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-8 items-start">
            {/* Left — value prop + single CTA */}
            <div className="lg:col-span-8">
              <p className="text-sm font-medium text-primary mb-3">
                Community-driven · Belgische volleybal
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance mb-4">
                Het centrum voor{" "}
                <span className="text-primary">transfer talk</span> en
                volleybalnieuws
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl mb-8 leading-relaxed">
                Wees als eerste op de hoogte. Deel geruchten, bevestig deals en
                bouw je reputatie op als betrouwbare bron.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/geruchten/nieuw">
                  <Button size="lg" className="gap-2">
                    <Plus className="h-5 w-5" />
                    Gerucht delen
                  </Button>
                </Link>
                <Link href="/transfers">
                  <Button size="lg" variant="outline" className="gap-2">
                    Bekijk Transfers
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right — Betrouwbare bronnen (above the fold) */}
            <div className="lg:col-span-4">
              <TrustedSourcesPeek sources={trustedSources} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip — real counts ────────────────────────────── */}
      <section className="border-b border-border py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                icon: Flame,
                label: "Actieve geruchten",
                value: counts.rumours,
              },
              {
                icon: TrendingUp,
                label: "Bevestigde transfers",
                value: counts.transfers,
              },
              {
                icon: Users,
                label: "Leden",
                value: counts.users,
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold tabular-nums">
                    {value}
                  </div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured rumours ─────────────────────────────────────── */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Hot topics — nu besproken
              </h2>
              <p className="text-muted-foreground mt-1">
                Meest besproken transfers van dit moment
              </p>
            </div>
            <Link href="/geruchten" className="shrink-0">
              <Button
                variant="ghost"
                className="gap-2 text-primary hover:text-primary/90"
              >
                Bekijk alle
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {featuredRumours.length > 0 ? (
            <RumourVotesProvider
              rumours={voteCounts(featuredRumours)}
              userVotes={userVotes.votes}
              currentUserId={userVotes.userId}
            >
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featuredRumours.map((rumour) => (
                  <RumourCard
                    key={rumour.id}
                    rumour={rumour}
                    currentUserId={userVotes.userId}
                  />
                ))}
              </div>
            </RumourVotesProvider>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <Flame className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  Nog geen geruchten?
                </h3>
                <p className="text-muted-foreground mb-4">
                  Jij kan het eerste gerucht delen.
                </p>
                <Link href="/geruchten/nieuw">
                  <Button>Gerucht delen</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* ── Latest transfers (full-width, no sidebar) ────────────── */}
      <section className="py-12 sm:py-16 bg-muted/20 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Laatste transfers
              </h2>
              <p className="text-muted-foreground mt-1">
                Dit seizoen bevestigd
              </p>
            </div>
            <Link href="/transfers" className="shrink-0">
              <Button
                variant="ghost"
                className="gap-2 text-primary hover:text-primary/90"
              >
                Bekijk alle
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {latestTransfers.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {latestTransfers.map((transfer) => (
                <TransferCard key={transfer.id} transfer={transfer} />
              ))}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  Nog geen transfers
                </h3>
                <p className="text-muted-foreground text-sm">
                  Transfers verschijnen hier zodra ze bevestigd zijn.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 border-t border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-balance mb-4">
            Doe mee. Verdien vertrouwen. Groei je reputatie.
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Sluit aan bij de volleybalcommunity. Deel insider info, stem op
            geruchten en bouw een track record op met tips die kloppen.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/auth/sign-up">
              <Button size="lg">Gratis registreren</Button>
            </Link>
            <Link href="/over-ons">
              <Button size="lg" variant="outline">
                Meer info
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
