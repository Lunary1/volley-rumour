"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";
import { ContactModal } from "@/components/contact-modal";
import { getExistingConversation } from "@/app/actions/messages";
import { handleServerActionResponse } from "@/lib/client-utils";

interface ClassifiedCardInteractiveProps {
  classified: {
    id: string;
    title: string;
    type: string;
    description: string;
    province: string | null;
    created_at: string;
    user_id: string;
    author: {
      username: string;
    };
  };
  currentUserId?: string;
}

const classifiedTypeLabels: Record<string, string> = {
  player_seeks_team: "Speler zoekt team",
  team_seeks_player: "Team zoekt speler",
  trainer_seeks_team: "Trainer zoekt team",
  team_seeks_trainer: "Team zoekt trainer",
};

const classifiedTypeColors: Record<string, string> = {
  player_seeks_team: "bg-primary/20 text-primary border-primary/30",
  team_seeks_player: "bg-accent/20 text-accent border-accent/30",
  trainer_seeks_team: "bg-chart-3/20 text-chart-3 border-chart-3/30",
  team_seeks_trainer: "bg-chart-4/20 text-chart-4 border-chart-4/30",
};

export function ClassifiedCardInteractive({
  classified,
  currentUserId,
}: ClassifiedCardInteractiveProps) {
  const router = useRouter();
  const [showContactModal, setShowContactModal] = useState(false);
  const [checkingConversation, setCheckingConversation] = useState(false);
  const isOwnClassified = currentUserId === classified.user_id;

  async function handleContactClick() {
    setCheckingConversation(true);
    try {
      // Check if conversation already exists
      const result = await getExistingConversation(
        classified.id,
        classified.user_id,
      );

      if (result.success && result.data?.conversationId) {
        // Conversation exists - navigate directly
        router.push(`/messages/${result.data.conversationId}`);
      } else {
        // No existing conversation - open modal to start one
        setShowContactModal(true);
      }
    } catch (err) {
      console.error("Error checking conversation:", err);
      toast.error("Fout bij laden van conversatie");
      setShowContactModal(true);
    } finally {
      setCheckingConversation(false);
    }
  }

  return (
    <>
      <Card className="bg-card border-border hover:border-primary/50 transition-colors">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <Badge
              variant="outline"
              className={classifiedTypeColors[classified.type]}
            >
              {classifiedTypeLabels[classified.type]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(classified.created_at), {
                addSuffix: true,
                locale: nl,
              })}
            </span>
          </div>

          <h3 className="text-lg font-semibold mb-2 text-balance">
            {classified.title}
          </h3>

          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {classified.description}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-4">
            {classified.province && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                <span>{classified.province}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>Door {classified.author.username}</span>
            </div>
          </div>

          {!isOwnClassified && (
            <Button
              onClick={handleContactClick}
              disabled={checkingConversation}
              size="sm"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {checkingConversation
                ? "Laden..."
                : `Contact ${classified.author.username}`}
            </Button>
          )}
        </CardContent>
      </Card>

      {showContactModal && (
        <ContactModal
          userId={classified.user_id}
          userName={classified.author.username}
          adId={classified.id}
          adType="classified"
          onClose={() => setShowContactModal(false)}
        />
      )}
    </>
  );
}
