import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/app/actions/auth";
import { RumourCard } from "@/components/rumour-card";
import { TransferCard } from "@/components/transfer-card";
import { LeaderboardCard } from "@/components/leaderboard-card";
import { ClassifiedsList } from "@/components/classifieds-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Cache homepage for 60 seconds - revalidates frequently due to new content
export const revalidate = 60;
import {
  TrendingUp,
  Users,
  Trophy,
  ArrowRight,
  Plus,
  Flame,
  MessageCircle,
  Search,
  Medal,
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

  // Normalise transfer date for TransferCard (DB may use confirmed_at or transfer_date)
  const transfersForDisplay = latestTransfers.map((t: Record<string, unknown>) => ({
    ...t,
    transfer_date: t.transfer_date ?? t.confirmed_at ?? "",
  })) as Array<Record<string, unknown> & { id: string; transfer_date: string }>;

  return (
    <div className="min-h-screen">
      <SpeedInsights />

      {/* Hero — community activity + value prop + leaderboard peek */}
      <section className="relative overflow-hidden border-b border-border hero-sport">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
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
                <Link href="/geruchten">
                  <Button size="lg" variant="outline" className="gap-2">
                    Transfer Talk
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
            {/* Leaderboard peek + trust */}
            <div className="lg:col-span-4">
              {topContributors.length > 0 ? (
                <Card className="bg-card/80 border-border backdrop-blur">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Trophy className="h-5 w-5 text-primary" />
                      <h2 className="font-semibold text-lg">Top bijdragers</h2>
                    </div>
                    <ul className="space-y-2">
                      {topContributors.slice(0, 3).map((u, i) => (
                        <li
                          key={u.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-foreground tabular-nums w-5">
                              {i + 1}.
                            </span>
                            <span className="truncate font-medium">
                              {u.username}
                            </span>
                          </span>
                          <span className="flex items-center gap-1 shrink-0 text-primary font-semibold">
                            <TrendingUp className="h-3.5 w-3.5" />
                            {u.trust_score}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/leaderboard"
                      className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Volledig leaderboard
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-card/80 border-border">
                  <CardContent className="py-8 text-center">
                    <Trophy className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Verdien punten en sta hier.
                    </p>
                    <Link href="/leaderboard">
                      <Button variant="ghost" size="sm" className="mt-2">
                        Leaderboard
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Persona nav — clear paths for different user types */}
      <section className="border-b border-border bg-muted/30 py-6 sm:py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground mb-4 text-center sm:text-left">
            Wat wil jij doen?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Link
              href="/geruchten"
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 hover:border-primary/30"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold block group-hover:text-primary transition-colors">
                  Transfer Talk volgen
                </span>
                <span className="text-sm text-muted-foreground">
                  Geruchten lezen en stemmen
                </span>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
            <Link
              href="/zoekertjes"
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 hover:border-primary/30"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Search className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold block group-hover:text-primary transition-colors">
                  Team of speler zoeken
                </span>
                <span className="text-sm text-muted-foreground">
                  Zoekertjes bekijken of plaatsen
                </span>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
            <Link
              href="/transfers"
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 hover:border-primary/30"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold block group-hover:text-primary transition-colors">
                  Bevestigde transfers
                </span>
                <span className="text-sm text-muted-foreground">
                  Officiële deals dit seizoen
                </span>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats strip — community activity */}
      <section className="border-b border-border py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: Flame, label: "Actieve geruchten", value: featuredRumours.length },
              { icon: TrendingUp, label: "Bevestigde deals", value: latestTransfers.length },
              { icon: Users, label: "Zoekertjes", value: latestClassifieds.length },
              { icon: Medal, label: "Top contributors", value: topContributors.length },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured rumours — prominent */}
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
              <Button variant="ghost" className="gap-2 text-primary hover:text-primary/90">
                Bekijk alle
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {featuredRumours.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredRumours.map((rumour) => (
                <RumourCard key={rumour.id} rumour={rumour as any} />
              ))}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <Flame className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Nog geen geruchten?</h3>
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

      {/* Latest transfers + full leaderboard */}
      <section className="py-12 sm:py-16 bg-muted/20 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">
                    Laatste transfers
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    Dit seizoen bevestigd
                  </p>
                </div>
                <Link href="/transfers" className="shrink-0">
                  <Button variant="ghost" className="gap-2 text-primary hover:text-primary/90">
                    Bekijk alle
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {transfersForDisplay.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {transfersForDisplay.map((transfer) => (
                    <TransferCard key={transfer.id} transfer={transfer as any} />
                  ))}
                </div>
              ) : (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">Nog geen transfers</h3>
                    <p className="text-muted-foreground text-sm">
                      Transfers verschijnen hier zodra ze bevestigd zijn.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="lg:col-span-1">
              {topContributors.length > 0 ? (
                <LeaderboardCard users={topContributors} title="Leaderboard" />
              ) : (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">Leaderboard</h3>
                    <p className="text-muted-foreground text-sm">
                      Registreer en verdien punten.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Classifieds */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Zoekertjes</h2>
              <p className="text-muted-foreground mt-1">
                Spelers en teams op zoek naar elkaar
              </p>
            </div>
            <Link href="/zoekertjes" className="shrink-0">
              <Button variant="ghost" className="gap-2 text-primary hover:text-primary/90">
                Bekijk alle
                <ArrowRight className="h-4 w-4" />
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
                <h3 className="text-lg font-semibold mb-2">Nog geen zoekertjes</h3>
                <p className="text-muted-foreground mb-4">
                  Plaats een zoekertje om je aan te bieden of een team te vinden.
                </p>
                <Link href="/zoekertjes/nieuw">
                  <Button>Zoekertje plaatsen</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 border-t border-border">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-balance mb-4">
            Doe mee. Verdien vertrouwen. Groei je reputatie.
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Sluit aan bij de volleybalcommunity. Deel insider info, stem op
            transfers en verdien punten voor betrouwbare tips.
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
