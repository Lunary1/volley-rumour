import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/app/actions/auth";
import { RumourCard } from "@/components/rumour-card";
import { TransferCard } from "@/components/transfer-card";
import { LeaderboardCard } from "@/components/leaderboard-card";
import { ClassifiedsList } from "@/components/classifieds-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  Users,
  Trophy,
  ArrowRight,
  Plus,
  Flame,
} from "lucide-react";
import Image from "next/image";
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
      id,
      title,
      type,
      description,
      province,
      position,
      team_name,
      contact_name,
      division,
      created_at,
      user_id,
      is_featured,
      featured_until,
      profiles(username)
    `,
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(3);

  return data || [];
}

export default async function HomePage() {
  const [
    featuredRumours,
    latestTransfers,
    topContributors,
    latestClassifieds,
    user,
  ] = await Promise.all([
    getFeaturedRumours(),
    getLatestTransfers(),
    getTopContributors(),
    getLatestClassifieds(),
    getCurrentUser(),
  ]);

  return (
    <div className="min-h-screen">
      <SpeedInsights />
      {/* Hero Section with Cyberpunk Gradient */}
      <section className="relative overflow-hidden border-b border-neon-cyan/30 gradient-cyber-hero">
        <div className="absolute inset-0 dark:bg-[radial-gradient(ellipse_at_top,oklch(0.2_0.15_280)_0%,transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                Community Driven Volleybal Transfer Nieuws
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-balance">
              Het Centrum voor{" "}
              <span className="bg-linear-to-r from-green-400 via-green-500 to-green-600 dark:from-green-300 dark:via-green-400 dark:to-green-500 bg-clip-text text-transparent">
                Belgische Volleybal Transfers
              </span>
            </h1>

            <p className="text-lg text-muted-foreground mb-8 max-w-2xl leading-relaxed">
              Wees als eerste op de hoogte van transfers. Deel geruchten,
              bevestig deals en bouw je reputatie op als betrouwbare bron binnen
              de Belgische volleybalcommunity.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/geruchten/nieuw">
                <Button
                  size="lg"
                  className="gradient-text-neon bg-gradient-to-b from-neon-magenta/40 to-neon-coral/40 hover:from-neon-magenta/50 hover:to-neon-coral/50 border border-neon-magenta/50 dark:border-neon-magenta/70 dark:shadow-[0_0_20px_rgba(216,180,254,0.2)] dark:hover:shadow-[0_0_30px_rgba(216,180,254,0.4)] text-white dark:text-white"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Gerucht Delen
                </Button>
              </Link>
              <Link href="/geruchten">
                <Button
                  size="lg"
                  className="bg-transparent border border-neon-cyan/50 text-neon-cyan dark:border-neon-cyan/70 dark:text-neon-cyan !hover:bg-neon-cyan/30 !dark:hover:bg-neon-cyan/30 !hover:border-neon-cyan !dark:hover:border-neon-cyan !dark:hover:shadow-[0_0_20px_rgba(178,190,255,0.4)] transition-all duration-200"
                >
                  Laatste Transfer Talk
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
                label: "Actieve Geruchten",
                value: featuredRumours.length.toString(),
              },
              {
                icon: TrendingUp,
                label: "Bevestigde Deals",
                value: latestTransfers.length.toString(),
              },
              {
                icon: Users,
                label: "Speelersmarkt",
                value: latestClassifieds.length.toString(),
              },
              {
                icon: Trophy,
                label: "Vertrouwde Bronnen",
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
                Hot Topics - Nu Besproken
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
                  Nog geen geruchten?
                </h3>
                <p className="text-muted-foreground mb-4">
                  Jij kan het eerste gerucht delen
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
                  <p className="text-muted-foreground">Dit seizoen bevestigd</p>
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
            <ClassifiedsList
              classifieds={latestClassifieds as any}
              currentUserId={user?.id}
            />
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
            Doe mee. Verdien Vertrouwen. Groei je Reputatie.
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Sluit aan bij duizenden volleybal fans. Deel insider info, stem op
            transfers, en verdien punten voor betrouwbare tips. Hoe meer je
            deelt, hoe meer je reputatie groeit.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/auth/sign-up">
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
