import { Card, CardContent } from "@/components/ui/card";
import { Trophy, TrendingUp, ArrowRight, Medal } from "lucide-react";
import Link from "next/link";

interface LeaderboardPeekUser {
  id: string;
  username: string;
  trust_score: number;
  avatar_url: string | null;
}

interface LeaderboardPeekProps {
  users: LeaderboardPeekUser[];
}

const medalColors = [
  "text-yellow-500", // gold
  "text-gray-400",   // silver
  "text-amber-600",  // bronze
];

export function LeaderboardPeek({ users }: LeaderboardPeekProps) {
  const top3 = users.slice(0, 3);

  if (top3.length === 0) {
    return (
      <Card className="bg-card/80 border-border backdrop-blur">
        <CardContent className="py-8 text-center">
          <Trophy className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Verdien punten en sta hier.
          </p>
          <Link
            href="/leaderboard"
            className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Leaderboard bekijken
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 border-border backdrop-blur">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Top bijdragers</h2>
        </div>

        <ul className="space-y-2" role="list">
          {top3.map((user, i) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Medal
                  className={`h-5 w-5 shrink-0 ${medalColors[i] ?? "text-muted-foreground"}`}
                  aria-label={`Positie ${i + 1}`}
                />
                <span className="truncate font-medium">{user.username}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0 text-primary font-semibold text-sm">
                <TrendingUp className="h-3.5 w-3.5" />
                {user.trust_score}
              </span>
            </li>
          ))}
        </ul>

        <Link
          href="/leaderboard"
          className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Bekijk volledige ranglijst
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
