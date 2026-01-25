"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getConversations } from "@/app/actions/messages";

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
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-foreground">Berichten</h1>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-4 h-20 bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-foreground">Berichten</h1>
          <Card className="p-6 border-destructive/50 bg-destructive/5">
            <p className="text-destructive">{error}</p>
          </Card>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-foreground">Berichten</h1>
          <Card className="p-12 text-center bg-card">
            <p className="text-muted-foreground mb-4">
              Je hebt nog geen berichten.
            </p>
            <Link
              href="/transfers"
              className="text-primary hover:text-primary/90 font-medium"
            >
              Naar Transfer Talk →
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Berichten</h1>
          <p className="text-muted-foreground">Je actieve gesprekken</p>
        </div>

        <div className="space-y-3">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/messages/${conv.id}`}
              className="block group"
            >
              <Card className="p-4 hover:border-primary/50 transition-all cursor-pointer hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Ad Title */}
                    <h2 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {conv.ad_title}
                    </h2>
                    {/* Initiator info */}
                    <p className="text-xs text-muted-foreground mb-2 mt-1">
                      Gestart door {conv.initiator_name}
                    </p>

                    {/* Last message */}
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.last_message_is_from_me ? "Jij: " : ""}
                      {conv.last_message || "Geen berichten nog"}
                    </p>

                    {/* Timestamp */}
                    {conv.last_message_at && (
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        {formatDistanceToNow(new Date(conv.last_message_at), {
                          addSuffix: true,
                          locale: nl,
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
