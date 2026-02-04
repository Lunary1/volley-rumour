"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createConversation } from "@/app/actions/messages";

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md bg-card">
        <div className="p-6">
          <h2 className="text-xl font-bold text-foreground mb-2">
            Contact {userName}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Stuur je eerste bericht om een conversatie te starten.
          </p>

          <form onSubmit={handleStartConversation} className="space-y-4">
            <div>
              <Textarea
                placeholder="Typ je bericht..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={sending}
                rows={4}
                className="w-full"
              />
            </div>

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
                {sending ? "Verzenden..." : "Verstuur bericht"}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
