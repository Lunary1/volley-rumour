"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getConversations } from "@/app/actions/messages";
import { Button } from "@/components/ui/button";
import { MessageCircle, Search } from "lucide-react";

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
  const pathname = usePathname();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
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
  }, []);

  // Initial load
  useEffect(() => {
    loadConversations(true);
  }, [loadConversations]);

  // Re-fetch on window focus (handles browser back, tab switching)
  useEffect(() => {
    const handleFocus = () => loadConversations();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadConversations]);

  // Re-fetch when navigating back to this page via client-side navigation
  useEffect(() => {
    if (pathname === "/messages") {
      loadConversations();
    }
  }, [pathname, loadConversations]);

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
                  of zoekertjes om een gesprek te starten!
                </p>
              </div>
              <Link href="/zoekertjes" className="mt-2">
                <Button size="sm" variant="outline">
                  Bekijk zoekertjes
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
        <h1 className="mb-6 text-3xl font-bold">Berichten</h1>
        <div className="space-y-2">
          {conversations.map((conversation) => {
            const adTypeBadge =
              conversation.ad_type === "transfer" ? "Transfer" : "Zoekertje";

            return (
              <Link
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                className="block"
              >
                <Card
                  className={`transition-colors duration-150 hover:bg-muted/40 ${
                    conversation.unread_count > 0
                      ? "border-l-4 border-l-primary"
                      : "border-l-4 border-l-transparent"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <Avatar className="h-11 w-11 shrink-0">
                        {conversation.other_user_avatar_url ? (
                          <AvatarImage
                            src={conversation.other_user_avatar_url}
                            alt={conversation.other_user_name}
                          />
                        ) : null}
                        <AvatarFallback className="bg-primary/15 text-primary font-semibold text-sm">
                          {getInitials(conversation.other_user_name)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3
                              className={`text-sm truncate ${
                                conversation.unread_count > 0
                                  ? "font-bold text-foreground"
                                  : "font-semibold text-foreground"
                              }`}
                            >
                              {conversation.other_user_name}
                            </h3>
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-4 font-medium shrink-0"
                            >
                              {adTypeBadge}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                            {conversation.last_message_at
                              ? formatDistanceToNow(
                                  new Date(conversation.last_message_at),
                                  { locale: nl, addSuffix: false },
                                )
                              : ""}
                          </span>
                        </div>

                        {/* Ad title */}
                        {conversation.ad_title && (
                          <p className="text-xs text-muted-foreground truncate mb-1">
                            {conversation.ad_title}
                          </p>
                        )}

                        {/* Message preview */}
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`truncate text-sm ${
                              conversation.unread_count > 0
                                ? "text-foreground font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            {conversation.last_message_is_from_me ? (
                              <span className="text-muted-foreground">
                                Jij:{" "}
                              </span>
                            ) : null}
                            {conversation.last_message || "Nog geen berichten"}
                          </p>

                          {/* Unread count badge */}
                          {conversation.unread_count > 0 && (
                            <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1.5 shrink-0">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
