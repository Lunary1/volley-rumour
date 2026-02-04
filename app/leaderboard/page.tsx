import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, TrendingUp, Star } from "lucide-react";

// Cache leaderboard for 300 seconds (5 minutes) - changes less frequently than rumors/transfers
export const revalidate = 300;

async function getLeaderboard() {
  const supabase = await createClient();
  // Select only needed columns to reduce payload size
  const { data } = await supabase
    .from("profiles")
    .select("id, username, trust_score, avatar_url")
    .order("trust_score", { ascending: false })
    .limit(50);

  return data || [];
}

function getTrustBadge(score: number) {
  if (score >= 100)
    return { label: "Legend", color: "bg-yellow-500 text-yellow-950" };
  if (score >= 50)
    return { label: "Expert", color: "bg-primary text-primary-foreground" };
  if (score >= 20)
    return { label: "Betrouwbaar", color: "bg-blue-500 text-blue-950" };
  if (score >= 5)
    return { label: "Actief", color: "bg-secondary text-secondary-foreground" };
  return { label: "Nieuwkomer", color: "bg-muted text-muted-foreground" };
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
  if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
  if (rank === 3) return <Award className="w-6 h-6 text-amber-600" />;
  return (
    <span className="w-6 h-6 flex items-center justify-center text-muted-foreground font-bold">
      {rank}
    </span>
  );
}

export default async function LeaderboardPage() {
  const users = await getLeaderboard();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">
          De meest betrouwbare bronnen in onze community
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription>Hoe werkt het?</CardDescription>
            <CardTitle className="text-lg text-foreground">
              Trust Score Systeem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 mt-0.5 text-primary" />
              <span>Deel Transfer Talk die waar blijkt te zijn</span>
            </div>
            <div className="flex items-start gap-2">
              <Star className="w-4 h-4 mt-0.5 text-accent" />
              <span>Krijg upvotes van andere gebruikers</span>
            </div>
            <div className="flex items-start gap-2">
              <Trophy className="w-4 h-4 mt-0.5 text-yellow-500" />
              <span>Stijg in de ranking en word een legende</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription>Badges</CardDescription>
            <CardTitle className="text-lg text-foreground">
              Rang Niveaus
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge className="bg-yellow-500 text-yellow-950">Legende</Badge>
              <span className="text-sm text-muted-foreground">100+ punten</span>
            </div>
            <div className="flex items-center justify-between">
              <Badge className="bg-primary text-primary-foreground">
                Expert
              </Badge>
              <span className="text-sm text-muted-foreground">50+ punten</span>
            </div>
            <div className="flex items-center justify-between">
              <Badge className="bg-blue-500 text-blue-950">Betrouwbaar</Badge>
              <span className="text-sm text-muted-foreground">20+ punten</span>
            </div>
            <div className="flex items-center justify-between">
              <Badge className="bg-secondary text-secondary-foreground">
                Actief
              </Badge>
              <span className="text-sm text-muted-foreground">5+ punten</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription>Statistieken</CardDescription>
            <CardTitle className="text-lg text-foreground">Community</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Totaal gebruikers</span>
              <span className="font-bold text-foreground">{users.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Actieve bijdragers</span>
              <span className="font-bold text-foreground">
                {users.filter((u) => u.trust_score > 0).length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Top Bijdragers</CardTitle>
          <CardDescription>
            Gerangschikt op basis van trust score
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nog geen gebruikers in de ranking</p>
              <p className="text-sm mt-2">
                Word de eerste door een gerucht te delen!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user, index) => {
                const badge = getTrustBadge(user.trust_score || 0);
                return (
                  <div
                    key={user.id}
                    className={`flex items-center gap-4 p-4 rounded-lg ${
                      index < 3 ? "bg-secondary/50" : "bg-background"
                    }`}
                  >
                    <div className="shrink-0 w-8">{getRankIcon(index + 1)}</div>
                    <Avatar>
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {(user.username || "U")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {user.username || "Anoniem"}
                      </p>
                      {user.username && (
                        <p className="text-sm text-muted-foreground truncate">
                          @{user.username}
                        </p>
                      )}
                    </div>
                    <Badge className={badge.color}>{badge.label}</Badge>
                    <div className="text-right">
                      <p className="font-bold text-foreground">
                        {user.trust_score || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">punten</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
