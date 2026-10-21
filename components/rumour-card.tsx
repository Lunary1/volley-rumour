"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  User,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { loadClient, whenIdle } from "@/lib/supabase/load-client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  RumourDetailModal,
  DELETED_CREATOR_LABEL,
} from "@/components/rumour-detail-modal";
import { VerifiedBadge } from "@/components/verified-badge";
import { ReportDialog } from "@/components/report-dialog";
import { usePathname, useRouter } from "next/navigation";
import { useIsClient } from "@/lib/use-is-client";
import {
  LOGIN_TO_VOTE_MESSAGE,
  OWN_RUMOUR_MESSAGE,
  RUMOUR_CATEGORY_BADGE_CLASSES,
  RUMOUR_CATEGORY_LABELS,
  RUMOUR_SOURCE_SHORT_LABELS,
  VOTING_CLOSED_MESSAGE,
  belief,
  formatBelief,
  formatTrackRecord,
  isVotingOpen,
  labelFor,
  type TrackRecord,
} from "@/lib/rumours";
import type { ActionResponse } from "@/lib/response";
import type { VoteCounts } from "@/app/actions/vote";
import { RelativeTime } from "@/components/relative-time";

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
    // The official source a moderator confirmed or denied it with (#70)
    resolution_source_url?: string | null;
    votes_true: number;
    votes_false: number;
    created_at: string;
    status: string;
    // null once the creator's account is deleted (deleteAccount keeps the rumour)
    creator_id: string | null;
    // The author's track record (#88, D-005)
    creator:
      | ({
          username: string;
          is_verified_source?: boolean;
        } & TrackRecord)
      | null;
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

const statusLabels: Record<string, string> = {
  rumour: "Lopend",
  confirmed: "Bevestigd ✓",
  denied: "Ontkracht ✗",
  expired: "Niet bevestigd",
};

const statusColors: Record<string, string> = {
  rumour:
    "bg-yellow-500/20 text-yellow-700 border-yellow-200 dark:text-yellow-300 dark:border-yellow-500/50",
  confirmed:
    "bg-green-500/20 text-green-700 border-green-200 dark:text-green-300 dark:border-green-500/50",
  denied:
    "bg-red-500/20 text-red-700 border-red-200 dark:text-red-300 dark:border-red-500/50",
  expired: "bg-muted text-muted-foreground border-border",
};

export function RumourCard({
  rumour,
  onVote,
  userVote,
  currentUserId = null,
}: RumourCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  // A vote clicked before hydration would be lost; keep the buttons off.
  const isClient = useIsClient();
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

  // Subscribe to real-time updates for this rumour's vote counts, once the
  // page is idle: the Supabase library stays out of the first load (#199).
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const subscribeToRumourUpdates = async () => {
      const supabase = await loadClient();
      if (cancelled) return;

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

    const cancelIdle = whenIdle(subscribeToRumourUpdates);

    return () => {
      cancelled = true;
      cancelIdle();
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

  // A neutral belief signal (D-005): no good/evil wording, no colours.
  const beliefShare = belief(localUpvotes, localDownvotes);
  const trackRecord = rumour.creator ? formatTrackRecord(rumour.creator) : null;

  return (
    <>
      <Card
        className={`bg-card border-border hover:border-primary/40 transition-all h-full flex flex-col hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(178,190,255,0.15)] group`}
      >
        <CardContent className="p-5 flex flex-col h-full">
          {/* Top Section: Category & Status Badges + Time */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge
              variant="outline"
              className={RUMOUR_CATEGORY_BADGE_CLASSES[rumour.category]}
            >
              {RUMOUR_CATEGORY_LABELS[rumour.category]}
            </Badge>
            <Badge variant="outline" className={statusColors[rumour.status]}>
              {statusLabels[rumour.status]}
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto">
              <RelativeTime date={rumour.created_at} />
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

            {/* The official source a moderator resolved it with (#70) */}
            {rumour.resolution_source_url && (
              <p className="text-xs text-muted-foreground mb-2">
                {rumour.status === "confirmed" ? "Bevestigd" : "Afgesloten"} op
                basis van{" "}
                <a
                  href={rumour.resolution_source_url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  een officiële bron
                </a>
              </p>
            )}

            {/* Description */}
            {rumour.description && (
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2 wrap-break-word overflow-hidden">
                {rumour.description}
              </p>
            )}
          </div>

          {/* What voters think (D-005) */}
          <div className="flex flex-col items-center gap-2 my-4 py-4 border-y border-border">
            <div
              className="w-24 h-2 bg-muted rounded-full overflow-hidden"
              aria-hidden
            >
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${beliefShare ?? 0}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {formatBelief(localUpvotes, localDownvotes)}
            </p>
          </div>

          {/* Voting Section */}
          <div className="flex items-center justify-center gap-4 mb-4 py-3 border-y border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote("up")}
              disabled={isVoting || !!votingClosedReason || !isClient}
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
              disabled={isVoting || !!votingClosedReason || !isClient}
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

          {/* Footer: author, their track record, actions */}
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
            {trackRecord && (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                <span>{trackRecord}</span>
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
