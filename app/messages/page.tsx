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
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="max-w-2xl mx-auto h-screen flex flex-col">
          <h1 className="text-2xl font-bold mb-6 text-foreground">Berichten</h1>
          <div className="space-y-2 flex-1">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-4 h-16 bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="max-w-2xl mx-auto h-screen flex flex-col">
          <h1 className="text-2xl font-bold mb-6 text-foreground">Berichten</h1>
          <Card className="p-6 border-destructive/50 bg-destructive/5">
            <p className="text-destructive">{error}</p>
          </Card>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="max-w-2xl mx-auto h-screen flex flex-col">
          <h1 className="text-2xl font-bold mb-6 text-foreground">Berichten</h1>
          <Card className="p-12 text-center bg-card flex-1 flex items-center justify-center">
            <div>
              <p className="text-muted-foreground mb-4">
                Je hebt nog geen berichten.
              </p>
              <Link
                href="/transfers"
                className="text-primary hover:text-primary/90 font-medium"
              >
                Naar Transfer Talk →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-2xl mx-auto h-screen flex flex-col">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Berichten</h1>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/messages/${conv.id}`}
              className="block group"
            >
              <Card className="p-3 hover:bg-muted/50 transition-all cursor-pointer border-0 shadow-none hover:shadow-sm rounded-lg">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Ad Title */}
                    <h2 className="font-medium text-foreground truncate text-sm group-hover:text-primary transition-colors">
                      {conv.ad_title}
                    </h2>

                    {/* Last message */}
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {conv.last_message_is_from_me ? "Jij: " : ""}
                      {conv.last_message || "Geen berichten nog"}
                    </p>
                  </div>

                  {/* Timestamp */}
                  {conv.last_message_at && (
                    <p className="text-xs text-muted-foreground/60 whitespace-nowrap">
                      {formatDistanceToNow(new Date(conv.last_message_at), {
                        addSuffix: false,
                        locale: nl,
                      })}
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
