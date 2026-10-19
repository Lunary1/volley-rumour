import { redirect } from "next/navigation";
import { avatarUrl } from "@/lib/avatar";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatInterface, type Message } from "@/components/chat-interface";
import { ReportDialog } from "@/components/report-dialog";
import { BlockUserDialog, UnblockButton } from "@/components/block-user-dialog";
import { BLOCKED_MESSAGE } from "@/lib/blocks";
import { getCurrentUser } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Gesprek", robots: NO_INDEX };

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
  // A zoekertje that went offline is hidden by RLS, but the conversation
  // still shows its title, without a link (#84).
  const { data: adData } = await supabase
    .rpc("conversation_classified_titles", { p_ids: [conversation.ad_id] })
    .maybeSingle<{ id: string; title: string; online: boolean }>();
  const adOnline = adData?.online !== false;

  // Fetch the other user's details
  const otherUserId =
    conversation.initiator_id === user.id
      ? conversation.recipient_id
      : conversation.initiator_id;

  const { data: otherUserData } = await supabase
    .from("profiles")
    .select("id, username, avatar_path")
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

  // A block in either direction (#73). RLS only shows our own blocks, so
  // is_blocked_with() answers for the other direction. The database refuses
  // messages across a block either way.
  const [{ data: ownBlock }, { data: blockedEitherWay }] = await Promise.all([
    supabase
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", otherUserId)
      .maybeSingle(),
    supabase.rpc("is_blocked_with", { p_user_id: otherUserId }),
  ]);
  const iBlocked = Boolean(ownBlock);
  const isBlocked = iBlocked || blockedEitherWay === true;

  // The latest 50 messages, oldest first. ChatInterface marks unread ones as
  // read and adds new ones through Realtime.
  const { data: latestMessages } = await supabase
    .from("messages")
    .select("id, content, created_at, sender_id, is_read, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(50);

  const initialMessages: Message[] = (latestMessages ?? [])
    .map((msg) => ({ ...msg, is_from_me: msg.sender_id === user.id }))
    .reverse();

  const adLink = `/zoekertjes/${conversation.ad_id}`;

  // Get initials for avatar fallback
  const otherUserInitials = (otherUserData?.username || "G")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    // The viewport minus the site header (h-16 + border), so the message box
    // or the block notice sits at the bottom of the screen.
    <div className="h-[calc(100dvh-4rem-1px)] bg-background flex flex-col overflow-hidden">
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
              {otherUserData?.avatar_path && (
                <AvatarImage
                  src={avatarUrl(otherUserData.avatar_path) ?? undefined}
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
                  Zoekertje
                </Badge>
                {adData && !adOnline ? (
                  <span className="text-xs text-muted-foreground truncate">
                    {adData.title} (niet meer online)
                  </span>
                ) : adData ? (
                  <Link
                    href={adLink}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate flex items-center gap-1"
                  >
                    <span className="truncate">
                      {adData.title || "Gesprek"}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </Link>
                ) : (
                  // Its author deleted the ad; the conversation stays (#72).
                  <span className="text-xs text-muted-foreground truncate">
                    Verwijderd zoekertje
                  </span>
                )}
              </div>
            </div>

            {/* A moderator may read the conversation through the report
                only (#87, #69). */}
            <ReportDialog
              targetType="conversation"
              targetId={conversationId}
              otherUserName={otherUserData.username}
              className="shrink-0"
            />
            {!iBlocked && (
              <BlockUserDialog
                userId={otherUserId}
                userName={otherUserData.username}
                className="shrink-0"
              />
            )}
          </div>
        </div>
      </div>

      {/* Chat container */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Earlier messages stay readable after a block (#73). */}
        <div className="flex-1 overflow-hidden flex flex-col max-w-2xl mx-auto w-full">
          <ChatInterface
            conversationId={conversationId}
            initialMessages={initialMessages}
            currentUserId={user.id}
            otherUserName={otherUserData?.username || "Gebruiker"}
            currentUserName={user.username}
            otherUserAvatar={avatarUrl(otherUserData?.avatar_path)}
            currentUserAvatar={user.avatar_url}
            blockedNotice={
              iBlocked ? (
                <div
                  role="status"
                  className="flex flex-wrap items-center justify-between gap-3 text-sm"
                >
                  <p className="text-muted-foreground">
                    Je hebt {otherUserData.username} geblokkeerd. Jullie kunnen
                    elkaar geen berichten meer sturen.
                  </p>
                  <UnblockButton
                    userId={otherUserId}
                    userName={otherUserData.username}
                  />
                </div>
              ) : isBlocked ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {BLOCKED_MESSAGE}
                </p>
              ) : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
