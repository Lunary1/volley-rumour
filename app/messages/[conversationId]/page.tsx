import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatInterface } from "@/components/chat-interface";
import { getMessages } from "@/app/actions/messages";
import { getCurrentUser } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, ExternalLink } from "lucide-react";

interface ConversationPageProps {
  params: {
    conversationId: string;
  };
}

export default async function ConversationPage({
  params,
}: ConversationPageProps) {
  const { conversationId } = await params;

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();

  // Fetch conversation details - try simpler query first to debug
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 flex items-start">
        <div className="w-full max-w-2xl mx-auto pt-4">
          <Link href="/messages">
            <Button variant="ghost" size="sm" className="mb-4">
              ← Terug
            </Button>
          </Link>
          <Card className="p-6 border-destructive/50 bg-destructive/5">
            <p className="text-destructive">Conversatie niet gevonden</p>
          </Card>
        </div>
      </div>
    );
  }

  // Verify user is part of this conversation
  if (
    conversation.initiator_id !== user.id &&
    conversation.recipient_id !== user.id
  ) {
    redirect("/messages");
  }

  // Fetch the ad details
  const adTableName =
    conversation.ad_type === "transfer" ? "transfers" : "classifieds";
  const { data: adData } = await supabase
    .from(adTableName)
    .select("id, title")
    .eq("id", conversation.ad_id)
    .single();

  // Fetch the other user's details
  const otherUserId =
    conversation.initiator_id === user.id
      ? conversation.recipient_id
      : conversation.initiator_id;

  const { data: otherUserData } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("id", otherUserId)
    .single();

  if (!otherUserData) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 flex items-start">
        <div className="w-full max-w-2xl mx-auto pt-4">
          <Link href="/messages">
            <Button variant="ghost" size="sm" className="mb-4">
              ← Terug
            </Button>
          </Link>
          <Card className="p-6 border-red-200 bg-red-50">
            <p className="text-red-800">Gebruiker niet gevonden</p>
          </Card>
        </div>
      </div>
    );
  }

  // Check if blocked
  const { data: blockData } = await supabase
    .from("blocked_users")
    .select("id")
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${user.id})`,
    )
    .limit(1);

  const isBlocked = blockData && blockData.length > 0;

  // Determine ad link
  const adLink =
    conversation.ad_type === "transfer"
      ? `/transfers`
      : `/zoekertjes/${conversation.ad_id}`;

  const adTypeBadge =
    conversation.ad_type === "transfer" ? "Transfer" : "Zoekertje";

  // Get initials for avatar fallback
  const otherUserInitials = (otherUserData?.username || "G")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="h-[calc(100dvh-4rem)] bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card shrink-0">
        <div className="px-4 py-3 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <Link href="/messages">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Terug naar berichten"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>

            {/* Other user avatar */}
            <Avatar className="h-10 w-10 shrink-0">
              {otherUserData?.avatar_url && (
                <AvatarImage
                  src={otherUserData.avatar_url}
                  alt={otherUserData.username}
                />
              )}
              <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
                {otherUserInitials}
              </AvatarFallback>
            </Avatar>

            {/* Title + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-foreground truncate">
                  {otherUserData?.username}
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 font-medium"
                >
                  {adTypeBadge}
                </Badge>
                <Link
                  href={adLink}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate flex items-center gap-1"
                >
                  <span className="truncate">{adData?.title || "Gesprek"}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat container */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isBlocked ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <Card className="p-6 border-destructive/50 bg-destructive/5 text-center max-w-2xl">
              <p className="text-destructive mb-4">
                Deze conversatie is geblokkeerd.
              </p>
              <Link href="/messages">
                <Button variant="outline" size="sm">
                  Terug naar berichten
                </Button>
              </Link>
            </Card>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col max-w-2xl mx-auto w-full">
            <ChatInterface
              conversationId={conversationId}
              currentUserId={user.id}
              otherUserName={otherUserData?.username || "Gebruiker"}
              currentUserName={user.username}
              otherUserAvatar={otherUserData?.avatar_url}
              currentUserAvatar={user.avatar_url}
            />
          </div>
        )}
      </div>
    </div>
  );
}
