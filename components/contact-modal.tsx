"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { createConversation } from "@/app/actions/messages";
import { SendHorizontal } from "lucide-react";

interface ContactModalProps {
  userId: string;
  userName: string;
  adId: string;
  adType: "transfer_talk" | "classified";
  onClose: () => void;
}

export function ContactModal({
  userId,
  userName,
  adId,
  adType,
  onClose,
}: ContactModalProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleStartConversation(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      setSending(true);

      const result = await createConversation(adId, adType, userId, message);

      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.data) {
        router.push(`/messages/${result.data.conversationId}`);
        onClose();
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Er is een fout opgetreden");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact {userName}</DialogTitle>
          <DialogDescription>
            Stuur je eerste bericht om een conversatie te starten.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleStartConversation} className="space-y-4">
          <Textarea
            placeholder="Typ je bericht..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={sending}
            rows={4}
            className="w-full resize-none"
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={sending}
              className="flex-1"
            >
              Annuleer
            </Button>
            <Button
              type="submit"
              disabled={sending || !message.trim()}
              className="flex-1"
            >
              {sending ? (
                "Verzenden..."
              ) : (
                <>
                  <SendHorizontal className="h-4 w-4 mr-2" />
                  Verstuur
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
