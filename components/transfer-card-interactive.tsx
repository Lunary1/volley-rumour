"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, UserCircle, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { ContactModal } from "@/components/contact-modal";
import { getExistingConversation } from "@/app/actions/messages";

interface TransferCardInteractiveProps {
  transfer: {
    id: string;
    player_name: string;
    from_club: string | null;
    to_club: string;
    transfer_type: string;
    transfer_date: string;
    is_official: boolean;
    creator_id: string;
    creator_name?: string;
  };
  currentUserId?: string;
}

const transferTypeLabels: Record<string, string> = {
  player_male: "Speler",
  player_female: "Speelster",
  coach_male: "Trainer",
  coach_female: "Trainster",
  player_retirement: "Speler Stopt",
  coach_retirement: "Trainer Stopt",
};

const transferTypeColors: Record<string, string> = {
  player_male: "bg-primary/20 text-primary border-primary/30",
  player_female: "bg-primary/20 text-primary border-primary/30",
  coach_male: "bg-accent/20 text-accent border-accent/30",
  coach_female: "bg-accent/20 text-accent border-accent/30",
  player_retirement: "bg-muted text-muted-foreground border-muted",
  coach_retirement: "bg-muted text-muted-foreground border-muted",
};

export function TransferCardInteractive({
  transfer,
  currentUserId,
}: TransferCardInteractiveProps) {
  const router = useRouter();
  const [showContactModal, setShowContactModal] = useState(false);
  const [checkingConversation, setCheckingConversation] = useState(false);
  const isRetirement = transfer.transfer_type?.includes("retirement") ?? false;
  const isOwnTransfer = currentUserId === transfer.creator_id;
  const typeColor =
    transferTypeColors[transfer.transfer_type] ||
    "bg-muted text-muted-foreground border-muted";
  const typeLabel = transferTypeLabels[transfer.transfer_type] || "Onbekend";

  async function handleContactClick() {
    setCheckingConversation(true);
    try {
      // Check if conversation already exists
      const result = await getExistingConversation(
        transfer.id,
        transfer.creator_id,
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
      setShowContactModal(true);
    } finally {
      setCheckingConversation(false);
    }
  }

  return (
    <>
      <Card className="bg-card border-border hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <Badge variant="outline" className={typeColor}>
              {typeLabel}
            </Badge>
            {transfer.is_official && (
              <Badge className="bg-primary text-primary-foreground">
                Officieel
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-balance">
              {transfer.player_name}
            </h3>
          </div>

          <div className="flex items-center gap-2 text-sm mb-3">
            {isRetirement ? (
              <span className="text-muted-foreground">
                {transfer.from_club && `Verlaat ${transfer.from_club}`}
              </span>
            ) : (
              <>
                {transfer.from_club ? (
                  <>
                    <span className="text-muted-foreground">
                      {transfer.from_club}
                    </span>
                    <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
                  </>
                ) : (
                  <span className="text-muted-foreground italic">Nieuw</span>
                )}
                <span className="text-foreground font-medium">
                  {transfer.to_club}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {format(new Date(transfer.transfer_date), "d MMMM yyyy", {
                locale: nl,
              })}
            </span>
          </div>

          {!isOwnTransfer && (
            <Button
              onClick={handleContactClick}
              disabled={checkingConversation}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              {checkingConversation
                ? "Laden..."
                : `Contact ${transfer.creator_name || "gebruiker"}`}
            </Button>
          )}
        </CardContent>
      </Card>

      {showContactModal && (
        <ContactModal
          userId={transfer.creator_id}
          userName={transfer.creator_name || "deze gebruiker"}
          adId={transfer.id}
          adType="transfer_talk"
          onClose={() => setShowContactModal(false)}
        />
      )}
    </>
  );
}
