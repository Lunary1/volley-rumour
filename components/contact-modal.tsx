"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  const [error, setError] = useState<string | null>(null);

  async function handleStartConversation(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      setSending(true);
      setError(null);

      const result = await createConversation(adId, adType, userId, message);

      if (result.success && result.data) {
        // Navigate to the new conversation
        router.push(`/messages/${result.data.conversationId}`);
        onClose();
      } else {
        setError(result.error || "Kon conversatie niet starten");
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Er is een fout opgetreden");
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

          {error && (
            <div className="mb-4 p-3 bg-destructive/5 border border-destructive/50 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

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
