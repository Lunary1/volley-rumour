"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getConversations } from "@/app/actions/messages";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

interface ConversationPreview {
  id: string;
  ad_id: string;
  ad_type: string;
  ad_title: string;
  initiator_id: string;
  initiator_name: string;
  initiator_avatar_url: string | null;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  last_message_is_from_me: boolean;
}

// Helper to generate initials from name
const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConversations() {
      try {
        setLoading(true);
        const result = await getConversations();
        if (result.success && result.data) {
          setConversations(result.data);
        } else {
          setError(result.error || "Failed to load conversations");
        }
      } catch (err) {
        setError("An unexpected error occurred");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadConversations();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-8 text-3xl font-bold">Berichten</h1>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card
                key={i}
                className="h-24 border-l-4 border-l-primary/20 bg-muted/50 animate-pulse"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-8 text-3xl font-bold">Berichten</h1>
          <Card className="border-l-4 border-l-destructive/50 p-6">
            <p className="text-sm text-muted-foreground">{error}</p>
          </Card>
        </div>
      </main>
    );
  }

  if (conversations.length === 0) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-8 text-3xl font-bold">Berichten</h1>
          <Card className="border-l-4 border-l-border/30 p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <MessageCircle className="h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="font-medium text-foreground mb-2">
                  Geen gesprekken
                </p>
                <p className="text-sm text-muted-foreground">
                  Je hebt nog geen actieve berichten. Zoek naar spelers, teams
                  of geruchten om een gesprek te starten!
                </p>
              </div>
              <Link href="/geruchten" className="mt-2">
                <Button size="sm" variant="outline">
                  Bekijk geruchten
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-3xl font-bold">Berichten</h1>
        <Card className="overflow-hidden">
          <div className="divide-y divide-border/50">
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                className="block transition-colors duration-150 hover:bg-muted/60"
              >
                <div className="border-l-4 border-l-primary/30 p-4 transition-all duration-200 hover:border-l-primary/70">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <Avatar className="h-12 w-12 shrink-0">
                      {conversation.other_user_avatar_url ? (
                        <img
                          src={conversation.other_user_avatar_url}
                          alt={conversation.other_user_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                          {getInitials(conversation.other_user_name)}
                        </AvatarFallback>
                      )}
                    </Avatar>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3
                          className={`font-semibold text-sm ${
                            conversation.unread_count > 0
                              ? "text-foreground font-bold"
                              : "text-foreground"
                          }`}
                        >
                          {conversation.other_user_name}
                        </h3>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(
                            new Date(
                              conversation.last_message_at || new Date(),
                            ),
                            { locale: nl, addSuffix: false },
                          )}
                        </span>
                      </div>

                      {/* Message preview */}
                      <p
                        className={`truncate text-sm mb-2 ${
                          conversation.unread_count > 0
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {conversation.last_message_is_from_me ? (
                          <span className="text-muted-foreground">Jij: </span>
                        ) : null}
                        {conversation.last_message || "Nog geen berichten"}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
