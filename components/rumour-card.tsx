"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  User,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  RumourDetailModal,
  DELETED_CREATOR_LABEL,
} from "@/components/rumour-detail-modal";
import { VerifiedBadge } from "@/components/verified-badge";
import { ReportDialog } from "@/components/report-dialog";
import { usePathname, useRouter } from "next/navigation";
import {
  LOGIN_TO_VOTE_MESSAGE,
  OWN_RUMOUR_MESSAGE,
  RUMOUR_SOURCE_SHORT_LABELS,
  VOTING_CLOSED_MESSAGE,
  isVotingOpen,
  labelFor,
} from "@/lib/rumours";
import type { ActionResponse } from "@/lib/response";
import type { VoteCounts } from "@/app/actions/vote";

interface RumourCardProps {
  rumour: {
    id: string;
    player_name: string;
    from_club_name: string | null;
    to_club_name: string;
    category: string;
    description: string | null;
    // Where the rumour comes from (#67); null on rumours from before sources
    source_type?: string | null;
    source_url?: string | null;
    votes_true: number;
    votes_false: number;
    created_at: string;
    status: string;
    // null once the creator's account is deleted (deleteAccount keeps the rumour)
    creator_id: string | null;
    creator: {
      username: string;
      trust_score: number;
      is_verified_source?: boolean;
    } | null;
  };
  onVote?: (
    rumourId: string,
    voteType: "up" | "down",
  ) => Promise<ActionResponse<VoteCounts>>;
  // The logged-in user's vote, loaded by the page with getUserVotes() (#129)
  userVote?: "up" | "down" | null;
  // From getUserVotes() too; null for visitors (#78)
  currentUserId?: string | null;
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

// Status: pending (rumour), confirmed, debunked (denied)
const statusLabels: Record<string, string> = {
  rumour: "Lopend",
  confirmed: "Bevestigd ✓",
  denied: "Ontkracht ✗",
};

const statusColors: Record<string, string> = {
  rumour:
    "bg-yellow-500/20 text-yellow-700 border-yellow-200 dark:text-yellow-300 dark:border-yellow-500/50",
  confirmed:
    "bg-green-500/20 text-green-700 border-green-200 dark:text-green-300 dark:border-green-500/50",
  denied:
    "bg-red-500/20 text-red-700 border-red-200 dark:text-red-300 dark:border-red-500/50",
};

export function RumourCard({
  rumour,
  onVote,
  userVote,
  currentUserId = null,
}: RumourCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [localUpvotes, setLocalUpvotes] = useState(rumour.votes_true);
  const [localDownvotes, setLocalDownvotes] = useState(rumour.votes_false);
  const [localUserVote, setLocalUserVote] = useState<"up" | "down" | null>(
    userVote || null,
  );
  const [isVoting, setIsVoting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const votesRef = useRef({ up: rumour.votes_true, down: rumour.votes_false });

  // Keep the latest counts available to the realtime handler below
  useEffect(() => {
    votesRef.current = { up: localUpvotes, down: localDownvotes };
  }, [localUpvotes, localDownvotes]);

  // Subscribe to real-time updates for this rumour's vote counts
  useEffect(() => {
    let channel: RealtimeChannel | null = null;

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
              const up = payload.new.votes_true ?? votesRef.current.up;
              const down = payload.new.votes_false ?? votesRef.current.down;
              setLocalUpvotes(up);
              setLocalDownvotes(down);
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
  }, [rumour.id]);

  // Why the buttons are off, if they are; the database refuses these votes
  // too (#78).
  const votingClosedReason = !isVotingOpen(rumour.status)
    ? VOTING_CLOSED_MESSAGE
    : currentUserId && rumour.creator_id === currentUserId
      ? OWN_RUMOUR_MESSAGE
      : null;

  const handleVote = async (voteType: "up" | "down") => {
    if (localUserVote === voteType || isVoting || votingClosedReason) return;

    // Visitors get a way to log in instead of a vote that bounces (#78).
    if (!currentUserId) {
      toast(LOGIN_TO_VOTE_MESSAGE, {
        action: {
          label: "Inloggen",
          onClick: () =>
            router.push(`/auth/login?next=${encodeURIComponent(pathname)}`),
        },
      });
      return;
    }

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
      if (onVote) {
        const result = await onVote(rumour.id, voteType);

        if (!result.success) {
          setLocalUpvotes(previousUpvotes);
          setLocalDownvotes(previousDownvotes);
          setLocalUserVote(previousUserVote);
          toast.error(result.error);
        } else {
          // The database's counts, including votes others cast meanwhile
          setLocalUpvotes(result.data.votes_true);
          setLocalDownvotes(result.data.votes_false);
        }
      }
    } finally {
      setIsVoting(false);
    }
  };

  const sourceLabel = labelFor(RUMOUR_SOURCE_SHORT_LABELS, rumour.source_type);

  // Infamous Karma meter: 0% = evil (red), 50% = neutral, 100% = good (blue)
  const karma =
    localUpvotes + localDownvotes > 0
      ? Math.round((localUpvotes / (localUpvotes + localDownvotes)) * 100)
      : 50;

  const getKarmaColor = (karmaValue: number) => {
    if (karmaValue < 35) return "text-red-600"; // Evil
    if (karmaValue < 50) return "text-orange-500"; // Slightly evil
    if (karmaValue === 50) return "text-gray-500"; // Neutral
    if (karmaValue < 65) return "text-blue-500"; // Slightly good
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
    if (karmaValue < 65) return "bg-blue-500";
    return "bg-blue-600";
  };

  // Color-code card border by confidence (karma) and creator trust
  const getCardBorderClass = () => {
    if (karma < 35) return "border-l-4 border-l-red-500 dark:border-l-red-400";
    if (karma < 50)
      return "border-l-4 border-l-orange-500 dark:border-l-orange-400";
    if (karma === 50) return "border-l-4 border-l-muted-foreground/50";
    if (karma < 65)
      return "border-l-4 border-l-blue-400 dark:border-l-blue-300";
    return "border-l-4 border-l-blue-600 dark:border-l-blue-400";
  };

  return (
    <>
      <Card
        className={`bg-card border-border hover:border-primary/40 transition-all h-full flex flex-col hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(178,190,255,0.15)] group ${getCardBorderClass()}`}
      >
        <CardContent className="p-5 flex flex-col h-full">
          {/* Top Section: Category & Status Badges + Time */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge
              variant="outline"
              className={categoryColors[rumour.category]}
            >
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
          <div className="flex-1 min-w-0 overflow-hidden">
            {/* Player & Club Transfer */}
            <h3 className="text-lg font-semibold mb-2">{rumour.player_name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              {rumour.category.includes("retirement") ? (
                <>
                  {rumour.from_club_name && (
                    <>
                      <span className="text-xs">{rumour.from_club_name}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-red-500" />
                    </>
                  )}
                  <span className="text-red-600 dark:text-red-400 font-bold text-sm uppercase">
                    Stopt
                  </span>
                </>
              ) : (
                <>
                  {rumour.from_club_name && (
                    <>
                      <span className="text-xs">{rumour.from_club_name}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-primary" />
                    </>
                  )}
                  <span className="text-foreground font-medium text-sm">
                    {rumour.to_club_name}
                  </span>
                </>
              )}
            </div>

            {sourceLabel && (
              <p className="text-xs text-muted-foreground mb-2">
                Bron: {sourceLabel}
              </p>
            )}

            {/* Description */}
            {rumour.description && (
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2 wrap-break-word overflow-hidden">
                {rumour.description}
              </p>
            )}
          </div>

          {/* Karma Meter - Centered and Prominent */}
          <div className="flex flex-col items-center gap-3 my-4 py-4 border-y border-border">
            {/* Karma Bar */}
            <div className="w-24 h-4 bg-muted rounded-full overflow-hidden border border-border shadow-sm">
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
              disabled={isVoting || !!votingClosedReason}
              aria-pressed={localUserVote === "up"}
              className={`gap-2 ${
                localUserVote === "up"
                  ? "text-blue-600 bg-blue-600/10 hover:bg-blue-600/20"
                  : "text-muted-foreground hover:text-blue-600"
              }`}
            >
              <ThumbsUp className="h-5 w-5" />
              <span className="sr-only">Waar</span>
              <span className="font-semibold">{localUpvotes}</span>
            </Button>
            <div className="text-muted-foreground text-sm font-medium">
              {localUpvotes + localDownvotes > 0
                ? `${localUpvotes + localDownvotes} stemmen`
                : "Wees eerst"}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote("down")}
              disabled={isVoting || !!votingClosedReason}
              aria-pressed={localUserVote === "down"}
              className={`gap-2 ${
                localUserVote === "down"
                  ? "text-red-600 bg-red-600/10 hover:bg-red-600/20"
                  : "text-muted-foreground hover:text-red-600"
              }`}
            >
              <ThumbsDown className="h-5 w-5" />
              <span className="sr-only">Niet waar</span>
              <span className="font-semibold">{localDownvotes}</span>
            </Button>
          </div>
          {votingClosedReason && (
            <p className="-mt-2 mb-4 text-center text-xs text-muted-foreground">
              {votingClosedReason}
            </p>
          )}

          {/* Footer: Creator + Trust + Discussion */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              <span className="font-medium">
                {rumour.creator?.username ?? DELETED_CREATOR_LABEL}
              </span>
              {rumour.creator?.is_verified_source && (
                <VerifiedBadge size="sm" />
              )}
            </div>
            {rumour.creator && (
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold">
                  {rumour.creator.trust_score}
                </span>
              </div>
            )}
            <ReportDialog
              targetType="rumour"
              targetId={rumour.id}
              takedownHref={`/verwijderverzoek?gerucht=${rumour.id}`}
              className="ml-auto"
            />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-primary hover:text-primary/90"
              onClick={() => setDetailOpen(true)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Bekijk meer
            </Button>
          </div>
        </CardContent>
      </Card>

      <RumourDetailModal
        rumour={{
          id: rumour.id,
          player_name: rumour.player_name,
          from_club_name: rumour.from_club_name,
          to_club_name: rumour.to_club_name,
          category: rumour.category,
          description: rumour.description,
          source_type: rumour.source_type ?? null,
          source_url: rumour.source_url ?? null,
          created_at: rumour.created_at,
          status: rumour.status,
          creator: rumour.creator,
        }}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        votes={{ up: localUpvotes, down: localDownvotes }}
        userVote={localUserVote}
        onVote={(_id, voteType) => handleVote(voteType)}
        isVoting={isVoting}
        votingClosedReason={votingClosedReason}
      />
    </>
  );
}
