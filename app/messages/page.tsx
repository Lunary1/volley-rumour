import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getConversations } from "@/app/actions/messages";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { RefreshOnFocus } from "@/components/refresh-on-focus";
import { ArchiveConversationButton } from "@/components/archive-conversation-button";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Berichten", robots: NO_INDEX };

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

// Inbox and archive tabs (#91): archiving is per user.
function MessagesTabs({ archived }: { archived: boolean }) {
  const tabs = [
    { href: "/messages", label: "Inbox", active: !archived },
    { href: "/messages?map=archief", label: "Archief", active: archived },
  ];
  return (
    <nav aria-label="Mappen" className="mb-6 flex gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            tab.active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ map?: string }>;
}) {
  const archived = (await searchParams).map === "archief";
  const result = await getConversations({ archived });
  const conversations: ConversationPreview[] = result.data ?? [];
  const error = result.success
    ? null
    : result.error || "Je gesprekken konden niet geladen worden";

  if (error) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <RefreshOnFocus />
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-4 text-3xl font-bold">Berichten</h1>
          <MessagesTabs archived={archived} />
          <Card className="border-l-4 border-l-destructive/50 p-6">
            <p className="text-sm text-muted-foreground">{error}</p>
          </Card>
        </div>
      </main>
    );
  }

  if (conversations.length === 0 && archived) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <RefreshOnFocus />
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-4 text-3xl font-bold">Berichten</h1>
          <MessagesTabs archived={archived} />
          <Card className="border-l-4 border-l-border/30 p-12 text-center">
            <p className="font-medium text-foreground mb-2">
              Geen gearchiveerde gesprekken
            </p>
            <p className="text-sm text-muted-foreground">
              Archiveer een gesprek om het uit je inbox te halen. De andere
              persoon ziet het gewoon nog. Een nieuw bericht zet het terug in je
              inbox.
            </p>
          </Card>
        </div>
      </main>
    );
  }

  if (conversations.length === 0) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <RefreshOnFocus />
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-4 text-3xl font-bold">Berichten</h1>
          <MessagesTabs archived={archived} />
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
      <RefreshOnFocus />
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-3xl font-bold">Berichten</h1>
        <MessagesTabs archived={archived} />
        <div className="space-y-2">
          {conversations.map((conversation) => {
            return (
              <Card
                key={conversation.id}
                className={`transition-colors duration-150 hover:bg-muted/40 ${
                  conversation.unread_count > 0
                    ? "border-l-4 border-l-primary"
                    : "border-l-4 border-l-transparent"
                }`}
              >
                <div className="flex items-start gap-1 p-4">
                  <Link
                    href={`/messages/${conversation.id}`}
                    className="flex min-w-0 flex-1 items-start gap-3"
                  >
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
                            Zoekertje
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
                            <span className="text-muted-foreground">Jij: </span>
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
                  </Link>
                  <ArchiveConversationButton
                    conversationId={conversation.id}
                    otherUserName={conversation.other_user_name}
                    adTitle={conversation.ad_title}
                    archived={archived}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
