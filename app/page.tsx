import { createClient } from "@/lib/supabase/server";
import { RumourCard } from "@/components/rumour-card";
import { TransferCard } from "@/components/transfer-card";
import { LeaderboardCard } from "@/components/leaderboard-card";
import { ClassifiedCard } from "@/components/classified-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Flame,
  TrendingUp,
  Users,
  Trophy,
  ArrowRight,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { SpeedInsights } from "@vercel/speed-insights/next";

async function getFeaturedRumours() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rumours")
    .select(
      `
      *,
      creator:creator_id(username, trust_score)
    `,
    )
    .order("votes_true", { ascending: false })
    .limit(3);

  return data || [];
}

async function getLatestTransfers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transfers")
    .select("*")
    .order("confirmed_at", { ascending: false })
    .limit(6);

  return data || [];
}

async function getTopContributors() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, trust_score, avatar_url")
    .order("trust_score", { ascending: false })
    .limit(5);

  return data || [];
}

async function getLatestClassifieds() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classifieds")
    .select(
      `
      *,
      author:profiles(username)
    `,
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(3);

  return data || [];
}

export default async function HomePage() {
  const [featuredRumours, latestTransfers, topContributors, latestClassifieds] =
    await Promise.all([
      getFeaturedRumours(),
      getLatestTransfers(),
      getTopContributors(),
      getLatestClassifieds(),
    ]);

  return (
    <div className="min-h-screen">
      <SpeedInsights />
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <Flame className="h-7 w-7 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium text-primary">
                Community Driven
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-balance">
              De Belgische Volleybal{" "}
              <span className="text-primary">Transfer Hub</span>
            </h1>

            <p className="text-lg text-muted-foreground mb-8 max-w-2xl leading-relaxed">
              Ontdek, deel en stem op volleybal transfers. Word onderdeel van de
              community en verdien punten door betrouwbare informatie te delen.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/geruchten/nieuw">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Gerucht Delen
                </Button>
              </Link>
              <Link href="/geruchten">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-border hover:bg-muted"
                >
                  Bekijk Transfer Talk
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                icon: Flame,
                label: "Active Transfer Talk",
                value: featuredRumours.length.toString(),
              },
              {
                icon: TrendingUp,
                label: "Transfers",
                value: latestTransfers.length.toString(),
              },
              {
                icon: Users,
                label: "Zoekertjes",
                value: latestClassifieds.length.toString(),
              },
              {
                icon: Trophy,
                label: "Contributors",
                value: topContributors.length.toString(),
              },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Rumours Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">
                Trending Transfer Talk
              </h2>
              <p className="text-muted-foreground">
                De meest besproken transfers van dit moment
              </p>
            </div>
            <Link href="/geruchten">
              <Button
                variant="ghost"
                className="text-primary hover:text-primary/80"
              >
                Bekijk alle
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {featuredRumours.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredRumours.map((rumour) => (
                <RumourCard key={rumour.id} rumour={rumour as any} />
              ))}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <Flame className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  Nog geen Transfer Talk
                </h3>
                <p className="text-muted-foreground mb-4">
                  Wees de eerste om een gerucht te delen!
                </p>
                <Link href="/geruchten/nieuw">
                  <Button className="bg-primary text-primary-foreground">
                    Gerucht Delen
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Latest Transfers & Leaderboard Section */}
      <section className="py-16 bg-card/30 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Laatste Transfers</h2>
                  <p className="text-muted-foreground">
                    Recent bevestigde transfers
                  </p>
                </div>
                <Link href="/transfers">
                  <Button
                    variant="ghost"
                    className="text-primary hover:text-primary/80"
                  >
                    Bekijk alle
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {latestTransfers.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
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
                    <p className="text-muted-foreground">
                      Transfers worden hier getoond zodra ze bevestigd zijn.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div>
              {topContributors.length > 0 ? (
                <LeaderboardCard
                  users={topContributors}
                  title="Top Contributors"
                />
              ) : (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">Leaderboard</h3>
                    <p className="text-muted-foreground text-sm">
                      Registreer en verdien punten!
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Classifieds Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">Zoekertjes</h2>
              <p className="text-muted-foreground">
                Spelers en teams op zoek naar elkaar
              </p>
            </div>
            <Link href="/zoekertjes">
              <Button
                variant="ghost"
                className="text-primary hover:text-primary/80"
              >
                Bekijk alle
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {latestClassifieds.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {latestClassifieds.map((classified) => (
                <ClassifiedCard
                  key={classified.id}
                  classified={classified as any}
                />
              ))}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  Nog geen zoekertjes
                </h3>
                <p className="text-muted-foreground mb-4">
                  Plaats een zoekertje om je aan te bieden of een team te
                  vinden.
                </p>
                <Link href="/zoekertjes/nieuw">
                  <Button className="bg-primary text-primary-foreground">
                    Zoekertje Plaatsen
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4 text-balance">
            Word onderdeel van de Belgische volleybal community
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Registreer gratis en krijg toegang tot alle features. Deel Transfer
            Talk, stem op transfers en bouw je reputatie op als betrouwbare
            bron.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/auth/register">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Gratis Registreren
              </Button>
            </Link>
            <Link href="/over-ons">
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent border-border hover:bg-muted"
              >
                Meer Info
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
