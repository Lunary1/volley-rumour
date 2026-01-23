import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, TrendingUp, Medal } from "lucide-react"

interface LeaderboardUser {
  id: string
  username: string
  trust_score: number
  avatar_url: string | null
}

interface LeaderboardCardProps {
  users: LeaderboardUser[]
  title?: string
}

export function LeaderboardCard({ users, title = "Top Contributors" }: LeaderboardCardProps) {
  const getMedalColor = (index: number) => {
    switch (index) {
      case 0:
        return "text-yellow-500"
      case 1:
        return "text-gray-400"
      case 2:
        return "text-amber-600"
      default:
        return "text-muted-foreground"
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-accent" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {users.map((user, index) => (
            <div
              key={user.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-center w-8 h-8">
                {index < 3 ? (
                  <Medal className={`h-6 w-6 ${getMedalColor(index)}`} />
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{user.username}</div>
              </div>
              
              <div className="flex items-center gap-1 text-primary">
                <TrendingUp className="h-4 w-4" />
                <span className="font-semibold">{user.trust_score}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
