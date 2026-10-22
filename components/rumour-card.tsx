import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, User, ArrowRight } from "lucide-react";
import { VerifiedBadge } from "@/components/verified-badge";
import { ReportDialog } from "@/components/report-dialog";
import { RelativeTime } from "@/components/relative-time";
import { RumourVoteBar } from "@/components/rumour-votes";
import { RumourDetailButton } from "@/components/rumour-detail-button";
import {
  DELETED_CREATOR_LABEL,
  RUMOUR_CATEGORY_BADGE_VARIANTS,
  RUMOUR_CATEGORY_LABELS,
  RUMOUR_SOURCE_SHORT_LABELS,
  RUMOUR_STATUS_BADGE_VARIANTS,
  RUMOUR_STATUS_LABELS,
  type RumourStatus,
  formatTrackRecord,
  labelFor,
  votingClosedReason,
  type TrackRecord,
} from "@/lib/rumours";

// A rumour card, rendered on the server (#200). Only the vote buttons, "Melden"
// and "Bekijk meer" run in the browser; they share the page's
// RumourVotesProvider, which must wrap the cards.

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
  // From getUserVotes(); null for visitors (#78)
  currentUserId: string | null;
}

export function RumourCard({ rumour, currentUserId }: RumourCardProps) {
  const closedReason = votingClosedReason(rumour, currentUserId);
  const sourceLabel = labelFor(RUMOUR_SOURCE_SHORT_LABELS, rumour.source_type);
  const trackRecord = rumour.creator ? formatTrackRecord(rumour.creator) : null;

  return (
    <Card className="bg-card border-border hover:border-border-strong transition-colors h-full flex flex-col group">
      <CardContent className="p-5 flex flex-col h-full">
        {/* Top Section: Category & Status Badges + Time */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant={RUMOUR_CATEGORY_BADGE_VARIANTS[rumour.category]}>
            {RUMOUR_CATEGORY_LABELS[rumour.category]}
          </Badge>
          <Badge variant={RUMOUR_STATUS_BADGE_VARIANTS[rumour.status]}>
            {RUMOUR_STATUS_LABELS[rumour.status as RumourStatus]}
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
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </>
                )}
                <span className="text-foreground font-bold text-sm uppercase">
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

        {/* What voters think (D-005) and the vote buttons */}
        <RumourVoteBar rumourId={rumour.id} closedReason={closedReason} />

        {/* Footer: author, their track record, actions */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span className="font-medium">
              {rumour.creator?.username ?? DELETED_CREATOR_LABEL}
            </span>
            {rumour.creator?.is_verified_source && <VerifiedBadge size="sm" />}
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
          <RumourDetailButton
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
            closedReason={closedReason}
          />
        </div>
      </CardContent>
    </Card>
  );
}
