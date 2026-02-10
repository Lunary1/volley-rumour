import { createClient } from "@/lib/supabase/server";
import { RumourCard } from "@/components/rumour-card";
import { voteOnRumour } from "@/app/actions/vote";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Plus } from "lucide-react";
import Link from "next/link";

// Cache transfer talk for 60 seconds - frequent updates
export const revalidate = 60;

async function getRumours(status?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("rumours")
    .select(
      `
      *,
      creator:creator_id(username, trust_score, is_verified_source)
    `,
    )
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data } = await query;
  return data || [];
}

interface SearchParams {
  status?: string;
}

export default async function GeruchtenPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const status = searchParams?.status;

  // Fetch only the rumours we need based on status filter
  const allRumours = await getRumours(status);
  const pendingRumours = await getRumours("rumour");
  const confirmedRumours = await getRumours("confirmed");
  const deniedRumours = await getRumours("denied");

  const displayRumours = allRumours;
  const displayCount = displayRumours.length;

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Transfer Talk</h1>
            <p className="text-muted-foreground">
              Ontdek de nieuwste volleybal transfers in de maak en stem of ze
              waar zijn
            </p>
          </div>
          <Link href="/geruchten/nieuw">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-5 w-5" />
              Nieuw Gerucht
            </Button>
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Link href="/geruchten">
            <Button
              variant={!status ? "default" : "outline"}
              className={!status ? "bg-primary text-primary-foreground" : ""}
            >
              Alle ({allRumours.length})
            </Button>
          </Link>
          <Link href="/geruchten?status=rumour">
            <Button
              variant={status === "rumour" ? "default" : "outline"}
              className={
                status === "rumour" ? "bg-primary text-primary-foreground" : ""
              }
            >
              <Flame className="mr-2 h-4 w-4 text-accent" />
              Trending ({pendingRumours.length})
            </Button>
          </Link>
          <Link href="/geruchten?status=confirmed">
            <Button
              variant={status === "confirmed" ? "default" : "outline"}
              className={
                status === "confirmed"
                  ? "bg-primary text-primary-foreground"
                  : ""
              }
            >
              Bevestigd ({confirmedRumours.length})
            </Button>
          </Link>
          <Link href="/geruchten?status=denied">
            <Button
              variant={status === "denied" ? "default" : "outline"}
              className={
                status === "denied" ? "bg-primary text-primary-foreground" : ""
              }
            >
              Ontkracht ({deniedRumours.length})
            </Button>
          </Link>
        </div>

        {/* Rumours Grid - 1 col mobile, 2–3 desktop */}
        {displayRumours.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {displayRumours.map((rumour) => (
              <RumourCard
                key={rumour.id}
                rumour={{
                  id: rumour.id,
                  player_name: rumour.player_name,
                  from_club_name: rumour.from_club_name,
                  to_club_name: rumour.to_club_name,
                  category: rumour.category,
                  description: rumour.description,
                  votes_true: rumour.votes_true,
                  votes_false: rumour.votes_false,
                  created_at: rumour.created_at,
                  status: rumour.status,
                  creator: rumour.creator,
                }}
                onVote={voteOnRumour}
              />
            ))}
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <Flame className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">
                {status
                  ? `Geen ${status === "confirmed" ? "bevestigde" : status === "denied" ? "ontkrachte" : "lopende"} geruchten`
                  : "Nog geen geruchten"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {status
                  ? "Er zijn nog geen geruchten in deze categorie. Kom later terug!"
                  : "Wees de eerste om een gerucht te delen! Heb je gehoord over een mogelijke transfer?"}
              </p>
              <Link href="/geruchten/nieuw">
                <Button className="bg-primary text-primary-foreground">
                  <Plus className="mr-2 h-5 w-5" />
                  {status ? "Gerucht Delen" : "Deel je eerste gerucht"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
