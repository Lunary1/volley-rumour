"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThumbsUp, ThumbsDown, MessageCircle, TrendingUp, User, ArrowRight } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"

interface RumourCardProps {
  rumour: {
    id: string
    player_name: string
    from_club: string | null
    to_club: string
    category: string
    description: string | null
    upvotes: number
    downvotes: number
    created_at: string
    author: {
      username: string
      trust_score: number
    }
  }
  onVote?: (rumourId: string, voteType: "up" | "down") => void
  userVote?: "up" | "down" | null
}

const categoryLabels: Record<string, string> = {
  player_transfer: "Speler Transfer",
  coach_transfer: "Trainer Transfer",
  player_retirement: "Speler Stopt",
  coach_retirement: "Trainer Stopt",
}

const categoryColors: Record<string, string> = {
  player_transfer: "bg-primary/20 text-primary border-primary/30",
  coach_transfer: "bg-accent/20 text-accent border-accent/30",
  player_retirement: "bg-muted text-muted-foreground border-muted",
  coach_retirement: "bg-muted text-muted-foreground border-muted",
}

export function RumourCard({ rumour, onVote, userVote }: RumourCardProps) {
  const [localUpvotes, setLocalUpvotes] = useState(rumour.upvotes)
  const [localDownvotes, setLocalDownvotes] = useState(rumour.downvotes)
  const [localUserVote, setLocalUserVote] = useState(userVote)

  const handleVote = (voteType: "up" | "down") => {
    if (localUserVote === voteType) return
    
    if (voteType === "up") {
      setLocalUpvotes((prev) => prev + 1)
      if (localUserVote === "down") {
        setLocalDownvotes((prev) => prev - 1)
      }
    } else {
      setLocalDownvotes((prev) => prev + 1)
      if (localUserVote === "up") {
        setLocalUpvotes((prev) => prev - 1)
      }
    }
    
    setLocalUserVote(voteType)
    onVote?.(rumour.id, voteType)
  }

  const confidence = localUpvotes + localDownvotes > 0 
    ? Math.round((localUpvotes / (localUpvotes + localDownvotes)) * 100) 
    : 50

  return (
    <Card className="bg-card border-border hover:border-primary/50 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={categoryColors[rumour.category]}>
                {categoryLabels[rumour.category]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(rumour.created_at), { addSuffix: true, locale: nl })}
              </span>
            </div>
            
            <h3 className="text-lg font-semibold mb-1 text-balance">
              {rumour.player_name}
            </h3>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {rumour.from_club && (
                <>
                  <span>{rumour.from_club}</span>
                  <ArrowRight className="h-4 w-4 text-primary" />
                </>
              )}
              <span className="text-foreground font-medium">{rumour.to_club}</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="text-2xl font-bold text-primary">{confidence}%</div>
            <div className="text-xs text-muted-foreground">betrouwbaar</div>
          </div>
        </div>

        {rumour.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {rumour.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote("up")}
              className={`gap-1.5 ${localUserVote === "up" ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
            >
              <ThumbsUp className="h-4 w-4" />
              <span>{localUpvotes}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote("down")}
              className={`gap-1.5 ${localUserVote === "down" ? "text-destructive bg-destructive/10" : "text-muted-foreground"}`}
            >
              <ThumbsDown className="h-4 w-4" />
              <span>{localDownvotes}</span>
            </Button>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span>{rumour.author.username}</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span>{rumour.author.trust_score} pts</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
