"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  User,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { getUserVoteOnRumour } from "@/app/actions/vote";
import { createClient } from "@/lib/supabase/client";

interface RumourCardProps {
  rumour: {
    id: string;
    player_name: string;
    from_club_name: string | null;
    to_club_name: string;
    category: string;
    description: string | null;
    votes_true: number;
    votes_false: number;
    created_at: string;
    status: string;
    creator: {
      username: string;
      trust_score: number;
    };
  };
  onVote?: (rumourId: string, voteType: "up" | "down") => Promise<any>;
  userVote?: "up" | "down" | null;
}

const categoryLabels: Record<string, string> = {
  transfer: "Transfer",
  trainer_transfer: "Trainer Transfer",
  player_retirement: "Speler Stopt",
  trainer_retirement: "Trainer Stopt",
};

const categoryColors: Record<string, string> = {
  transfer: "bg-primary/20 text-primary border-primary/30",
  trainer_transfer: "bg-accent/20 text-accent border-accent/30",
  player_retirement: "bg-muted text-muted-foreground border-muted",
  trainer_retirement: "bg-muted text-muted-foreground border-muted",
};

const statusLabels: Record<string, string> = {
  rumour: "Gerucht",
  confirmed: "Bevestigd ✓",
  denied: "Ontkracht ✗",
};

const statusColors: Record<string, string> = {
  rumour: "bg-yellow-500/20 text-yellow-700 border-yellow-200",
  confirmed: "bg-green-500/20 text-green-700 border-green-200",
  denied: "bg-red-500/20 text-red-700 border-red-200",
};

export function RumourCard({ rumour, onVote, userVote }: RumourCardProps) {
  const [localUpvotes, setLocalUpvotes] = useState(rumour.votes_true);
  const [localDownvotes, setLocalDownvotes] = useState(rumour.votes_false);
  const [localUserVote, setLocalUserVote] = useState<"up" | "down" | null>(
    userVote || null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);

  // Fetch persistent user vote on mount
  useEffect(() => {
    async function loadUserVote() {
      const vote = await getUserVoteOnRumour(rumour.id);
      setLocalUserVote(vote);
      setIsLoading(false);
    }
    loadUserVote();
  }, [rumour.id]);

  // Subscribe to real-time updates for this rumour's vote counts
  useEffect(() => {
    let channel: any = null;

    const subscribeToRumourUpdates = async () => {
      const supabase = await createClient();

      channel = supabase
        .channel(`rumour:${rumour.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rumours",
            filter: `id=eq.${rumour.id}`,
          },
          (payload) => {
            if (payload.new) {
              // Update local state with new vote counts from the database
              setLocalUpvotes(payload.new.votes_true ?? localUpvotes);
              setLocalDownvotes(payload.new.votes_false ?? localDownvotes);
            }
          },
        )
        .subscribe();
    };

    subscribeToRumourUpdates();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [rumour.id, localUpvotes, localDownvotes]);

  const handleVote = async (voteType: "up" | "down") => {
    if (localUserVote === voteType || isVoting) return;

    setIsVoting(true);
    const previousUpvotes = localUpvotes;
    const previousDownvotes = localDownvotes;
    const previousUserVote = localUserVote;

    // Optimistic update
    if (voteType === "up") {
      setLocalUpvotes((prev) => prev + 1);
      if (localUserVote === "down") {
        setLocalDownvotes((prev) => Math.max(0, prev - 1));
      }
    } else {
      setLocalDownvotes((prev) => prev + 1);
      if (localUserVote === "up") {
        setLocalUpvotes((prev) => Math.max(0, prev - 1));
      }
    }

    setLocalUserVote(voteType);

    try {
      // Call server action to vote
      if (onVote) {
        console.log(
          `[VOTE] Voting on rumour ${rumour.id} with type ${voteType}`,
        );
        const result = await onVote(rumour.id, voteType);
        console.log(`[VOTE] Server response:`, result);

        if (result?.error) {
          console.error(`[VOTE] Error from server:`, result.error);
          // Revert on error
          setLocalUpvotes(previousUpvotes);
          setLocalDownvotes(previousDownvotes);
          setLocalUserVote(previousUserVote);
        } else if (result?.success) {
          console.log(`[VOTE] Vote successful, refetching data...`);
          // Refetch the rumour data using client-side Supabase to bypass cache
          const supabase = await createClient();
          const { data, error } = await supabase
            .from("rumours")
            .select("votes_true, votes_false")
            .eq("id", rumour.id)
            .single();

          console.log(`[VOTE] Refetch result:`, { data, error });

          if (data) {
            console.log(
              `[VOTE] Updating local state with DB values: up=${data.votes_true}, down=${data.votes_false}`,
            );
            setLocalUpvotes(data.votes_true);
            setLocalDownvotes(data.votes_false);
          }
        }
      }
    } finally {
      setIsVoting(false);
    }
  };

  // Infamous Karma meter: 0% = evil (red), 50% = neutral, 100% = good (blue)
  const karma =
    localUpvotes + localDownvotes > 0
      ? Math.round((localUpvotes / (localUpvotes + localDownvotes)) * 100)
      : 50;

  const getKarmaColor = (karmaValue: number) => {
    if (karmaValue < 35) return "text-red-600"; // Evil
    if (karmaValue < 50) return "text-orange-500"; // Slightly evil
    if (karmaValue === 50) return "text-gray-500"; // Neutral
    if (karmaValue < 65) return "text-blue-400"; // Slightly good
    return "text-blue-600"; // Good
  };

  const getKarmaLabel = (karmaValue: number) => {
    if (karmaValue < 35) return "Evil";
    if (karmaValue < 50) return "Corrupt";
    if (karmaValue === 50) return "Neutral";
    if (karmaValue < 65) return "Heroic";
    return "Legendary";
  };

  const getKarmaBarColor = (karmaValue: number) => {
    if (karmaValue < 35) return "bg-red-600";
    if (karmaValue < 50) return "bg-orange-500";
    if (karmaValue === 50) return "bg-gray-500";
    if (karmaValue < 65) return "bg-blue-400";
    return "bg-blue-600";
  };

  return (
    <Card className="bg-card border-border dark:border-neon-cyan/30 hover:dark:border-neon-cyan/60 transition-all h-full flex flex-col dark:hover:shadow-[0_0_20px_rgba(178,190,255,0.15)] group">
      <CardContent className="p-5 flex flex-col h-full">
        {/* Top Section: Category & Status Badges + Time */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant="outline" className={categoryColors[rumour.category]}>
            {categoryLabels[rumour.category]}
          </Badge>
          <Badge variant="outline" className={statusColors[rumour.status]}>
            {statusLabels[rumour.status]}
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(rumour.created_at), {
              addSuffix: true,
              locale: nl,
            })}
          </span>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Player & Club Transfer */}
          <h3 className="text-lg font-semibold mb-2">{rumour.player_name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            {rumour.from_club_name && (
              <>
                <span className="text-xs">{rumour.from_club_name}</span>
                <ArrowRight className="h-3.5 w-3.5 text-primary" />
              </>
            )}
            <span className="text-foreground font-medium text-sm">
              {rumour.to_club_name}
            </span>
          </div>

          {/* Description */}
          {rumour.description && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {rumour.description}
            </p>
          )}
        </div>

        {/* Karma Meter - Centered and Prominent */}
        <div className="flex flex-col items-center gap-3 my-4 py-4 border-y border-border">
          {/* Karma Bar */}
          <div className="w-24 h-4 bg-gray-300 rounded-full overflow-hidden border border-gray-400 shadow-sm">
            <div
              className={`h-full transition-all duration-300 ${getKarmaBarColor(
                karma,
              )}`}
              style={{ width: `${karma}%` }}
            />
          </div>
          {/* Karma Percentage */}
          <div className="flex flex-col items-center">
            <div className={`text-3xl font-bold ${getKarmaColor(karma)}`}>
              {karma}%
            </div>
            <div className={`text-xs font-semibold ${getKarmaColor(karma)}`}>
              {getKarmaLabel(karma)}
            </div>
          </div>
        </div>

        {/* Voting Section */}
        <div className="flex items-center justify-center gap-4 mb-4 py-3 border-y border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleVote("up")}
            disabled={isLoading || isVoting}
            className={`gap-2 ${
              localUserVote === "up"
                ? "text-blue-600 bg-blue-600/10 hover:bg-blue-600/20"
                : "text-muted-foreground hover:text-blue-600"
            }`}
          >
            <ThumbsUp className="h-5 w-5" />
            <span className="font-semibold">{localUpvotes}</span>
          </Button>
          <div className="text-muted-foreground text-sm font-medium">
            {localUpvotes + localDownvotes > 0
              ? `${localUpvotes + localDownvotes} total votes`
              : "Wees eerst"}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleVote("down")}
            disabled={isLoading || isVoting}
            className={`gap-2 ${
              localUserVote === "down"
                ? "text-red-600 bg-red-600/10 hover:bg-red-600/20"
                : "text-muted-foreground hover:text-red-600"
            }`}
          >
            <ThumbsDown className="h-5 w-5" />
            <span className="font-semibold">{localDownvotes}</span>
          </Button>
        </div>

        {/* Footer: Creator Info */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span className="font-medium">{rumour.creator.username}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">{rumour.creator.trust_score}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
