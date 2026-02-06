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
  TrendingUp,
  User,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

export type RumourForModal = {
  id: string;
  player_name: string;
  from_club_name: string | null;
  to_club_name: string;
  category: string;
  description: string | null;
  created_at: string;
  status: string;
  creator: { username: string; trust_score: number };
};

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
  rumour:
    "bg-yellow-500/20 text-yellow-700 border-yellow-200 dark:text-yellow-300 dark:border-yellow-500/50",
  confirmed:
    "bg-green-500/20 text-green-700 border-green-200 dark:text-green-300 dark:border-green-500/50",
  denied:
    "bg-red-500/20 text-red-700 border-red-200 dark:text-red-300 dark:border-red-500/50",
};

interface RumourDetailModalProps {
  rumour: RumourForModal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  votes: { up: number; down: number };
  userVote: "up" | "down" | null;
  onVote: (rumourId: string, voteType: "up" | "down") => Promise<unknown>;
  isLoading?: boolean;
  isVoting?: boolean;
}

export function RumourDetailModal({
  rumour,
  open,
  onOpenChange,
  votes,
  userVote,
  onVote,
  isLoading = false,
  isVoting = false,
}: RumourDetailModalProps) {
  const total = votes.up + votes.down;
  const karma = total > 0 ? Math.round((votes.up / total) * 100) : 50;

  const getKarmaColor = (k: number) => {
    if (k < 35) return "text-red-600 dark:text-red-400";
    if (k < 50) return "text-orange-500 dark:text-orange-400";
    if (k === 50) return "text-gray-500 dark:text-gray-400";
    if (k < 65) return "text-blue-500 dark:text-blue-300";
    return "text-blue-600 dark:text-blue-400";
  };

  const getKarmaBarColor = (k: number) => {
    if (k < 35) return "bg-red-600";
    if (k < 50) return "bg-orange-500";
    if (k === 50) return "bg-gray-500";
    if (k < 65) return "bg-blue-500";
    return "bg-blue-600";
  };

  const handleVote = (voteType: "up" | "down") => {
    if (userVote === voteType || isVoting) return;
    onVote(rumour.id, voteType);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
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
          <DialogTitle className="text-xl pt-2">
            {rumour.player_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            {rumour.from_club_name && (
              <>
                <span className="text-muted-foreground">
                  {rumour.from_club_name}
                </span>
                <ArrowRight className="h-4 w-4 text-primary shrink-0" />
              </>
            )}
            <span className="font-medium">{rumour.to_club_name}</span>
          </div>

          {rumour.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap border rounded-lg p-4 bg-muted/30">
              {rumour.description}
            </p>
          )}

          <div className="flex flex-col items-center gap-2 py-4 border-y border-border">
            <div className="text-2xl font-bold">
              <span className={getKarmaColor(karma)}>{karma}%</span> vertrouwen
            </div>
            <div className="w-full max-w-[200px] h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getKarmaBarColor(karma)}`}
                style={{ width: `${karma}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 py-4 border-y border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote("up")}
              disabled={isLoading || isVoting}
              className={`gap-2 ${
                userVote === "up"
                  ? "text-blue-600 bg-blue-600/10 hover:bg-blue-600/20 dark:text-blue-400"
                  : "text-muted-foreground hover:text-blue-600"
              }`}
            >
              <ThumbsUp className="h-5 w-5" />
              <span className="font-semibold">{votes.up}</span>
            </Button>
            <span className="text-sm text-muted-foreground">
              {total > 0 ? `${total} stemmen` : "Wees eerst"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote("down")}
              disabled={isLoading || isVoting}
              className={`gap-2 ${
                userVote === "down"
                  ? "text-red-600 bg-red-600/10 hover:bg-red-600/20 dark:text-red-400"
                  : "text-muted-foreground hover:text-red-600"
              }`}
            >
              <ThumbsDown className="h-5 w-5" />
              <span className="font-semibold">{votes.down}</span>
            </Button>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              <span className="font-medium">{rumour.creator.username}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="font-semibold">
                Trust {rumour.creator.trust_score}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
