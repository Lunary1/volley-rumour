"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  User,
  ArrowRight,
} from "lucide-react";
import { VerifiedBadge } from "@/components/verified-badge";
import { ShareButton } from "@/components/share-button";
import { ReportDialog } from "@/components/report-dialog";
import Link from "next/link";
import {
  RUMOUR_CATEGORY_BADGE_CLASSES,
  RUMOUR_CATEGORY_LABELS,
  RUMOUR_SOURCE_TYPES,
  belief,
  formatBelief,
  formatTrackRecord,
  labelFor,
  type TrackRecord,
} from "@/lib/rumours";
import { RelativeTime } from "@/components/relative-time";

export type RumourForModal = {
  id: string;
  player_name: string;
  from_club_name: string | null;
  to_club_name: string;
  category: string;
  description: string | null;
  source_type: string | null;
  source_url: string | null;
  created_at: string;
  status: string;
  // null once the creator's account is deleted (deleteAccount keeps the rumour)
  // The author's track record (#88, D-005)
  creator:
    | ({
        username: string;
        is_verified_source?: boolean;
      } & TrackRecord)
    | null;
};

/** Author label for a rumour whose creator deleted their account. */
export const DELETED_CREATOR_LABEL = "Verwijderd account";

const statusLabels: Record<string, string> = {
  rumour: "Gerucht",
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

interface RumourDetailModalProps {
  rumour: RumourForModal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  votes: { up: number; down: number };
  userVote: "up" | "down" | null;
  onVote: (rumourId: string, voteType: "up" | "down") => Promise<unknown>;
  isVoting?: boolean;
  // Set when the user can't vote on this rumour (#78); shown under the buttons
  votingClosedReason?: string | null;
}

export function RumourDetailModal({
  rumour,
  open,
  onOpenChange,
  votes,
  userVote,
  onVote,
  isVoting = false,
  votingClosedReason = null,
}: RumourDetailModalProps) {
  const total = votes.up + votes.down;
  // A neutral belief signal (D-005): no good/evil wording, no colours.
  const beliefShare = belief(votes.up, votes.down);
  const trackRecord = rumour.creator ? formatTrackRecord(rumour.creator) : null;
  const sourceLabel = labelFor(RUMOUR_SOURCE_TYPES, rumour.source_type);

  const handleVote = (voteType: "up" | "down") => {
    if (userVote === voteType || isVoting) return;
    onVote(rumour.id, voteType);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden max-w-lg w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
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
          <DialogTitle className="text-xl pt-2">
            {rumour.player_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 min-w-0">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            {rumour.category.includes("retirement") ? (
              <>
                {rumour.from_club_name && (
                  <>
                    <span className="text-muted-foreground">
                      {rumour.from_club_name}
                    </span>
                    <ArrowRight className="h-4 w-4 text-red-500 shrink-0" />
                  </>
                )}
                <span className="text-red-600 dark:text-red-400 font-bold uppercase">
                  Stopt
                </span>
              </>
            ) : (
              <>
                {rumour.from_club_name && (
                  <>
                    <span className="text-muted-foreground">
                      {rumour.from_club_name}
                    </span>
                    <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                  </>
                )}
                <span className="font-medium">{rumour.to_club_name}</span>
              </>
            )}
          </div>

          {(sourceLabel || rumour.source_url) && (
            <p className="text-sm text-muted-foreground min-w-0">
              Bron: {sourceLabel ?? "Onbekend"}
              {rumour.source_url && (
                <>
                  {" · "}
                  <a
                    href={rumour.source_url}
                    target="_blank"
                    rel="nofollow ugc noopener noreferrer"
                    className="text-primary underline underline-offset-2 break-all"
                  >
                    Bekijk bron
                  </a>
                </>
              )}
            </p>
          )}

          {rumour.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-all border rounded-lg p-4 bg-muted/30">
              {rumour.description}
            </p>
          )}

          <div className="flex flex-col items-center gap-2 py-4 border-y border-border">
            <p className="text-sm text-muted-foreground text-center">
              {formatBelief(votes.up, votes.down)}
            </p>
            <div
              className="w-full max-w-[200px] h-2 bg-muted rounded-full overflow-hidden"
              aria-hidden
            >
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${beliefShare ?? 0}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 py-4 border-y border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote("up")}
              disabled={isVoting || !!votingClosedReason}
              aria-pressed={userVote === "up"}
              className={`gap-2 ${
                userVote === "up"
                  ? "text-blue-600 bg-blue-600/10 hover:bg-blue-600/20 dark:text-blue-400"
                  : "text-muted-foreground hover:text-blue-600"
              }`}
            >
              <ThumbsUp className="h-5 w-5" />
              <span className="sr-only">Waar</span>
              <span className="font-semibold">{votes.up}</span>
            </Button>
            <span className="text-sm text-muted-foreground">
              {total > 0 ? `${total} stemmen` : "Wees eerst"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote("down")}
              disabled={isVoting || !!votingClosedReason}
              aria-pressed={userVote === "down"}
              className={`gap-2 ${
                userVote === "down"
                  ? "text-red-600 bg-red-600/10 hover:bg-red-600/20 dark:text-red-400"
                  : "text-muted-foreground hover:text-red-600"
              }`}
            >
              <ThumbsDown className="h-5 w-5" />
              <span className="sr-only">Niet waar</span>
              <span className="font-semibold">{votes.down}</span>
            </Button>
          </div>
          {votingClosedReason && (
            <p className="-mt-2 text-center text-xs text-muted-foreground">
              {votingClosedReason}
            </p>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              <span className="font-medium">
                {rumour.creator?.username ?? DELETED_CREATOR_LABEL}
              </span>
              {rumour.creator?.is_verified_source && (
                <VerifiedBadge size="sm" />
              )}
            </div>
            {trackRecord && (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>{trackRecord}</span>
              </div>
            )}
          </div>

          <ShareButton
            title={`${rumour.player_name} — ${rumour.from_club_name ? `${rumour.from_club_name} ➜ ` : ""}${rumour.to_club_name}`}
            shareText={`🏐 ${rumour.player_name} ${rumour.from_club_name ? `van ${rumour.from_club_name} naar ${rumour.to_club_name}` : `naar ${rumour.to_club_name}`}? Bekijk dit gerucht op VolleyRumours!`}
            url={`/geruchten/${rumour.id}`}
            variant="outline"
            size="sm"
          />

          {/* Takedown requests (#68): no account needed. Reports (#79) need
              a login. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Gaat dit gerucht over jou?{" "}
              <Link
                href={`/verwijderverzoek?gerucht=${rumour.id}`}
                className="text-primary underline underline-offset-2"
              >
                Vraag de verwijdering aan
              </Link>
            </p>
            <ReportDialog
              targetType="rumour"
              targetId={rumour.id}
              takedownHref={`/verwijderverzoek?gerucht=${rumour.id}`}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
