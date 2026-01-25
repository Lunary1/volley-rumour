import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatInterface } from "@/components/chat-interface";
import { getMessages } from "@/app/actions/messages";
import { getCurrentUser } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

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
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/messages">
            <Button variant="ghost" className="mb-4">
              ← Terug naar berichten
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/messages">
            <Button variant="ghost" className="mb-4">
              ← Terug naar berichten
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

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card flex-shrink-0">
        <div className="px-4 py-4">
          <Link href="/messages" className="inline-block mb-4">
            <Button variant="ghost" size="sm">
              ← Terug naar berichten
            </Button>
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground mb-1">
                {adData?.title || "Gesprek"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Met {otherUserData?.username}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat container */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isBlocked ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <Card className="p-6 border-destructive/50 bg-destructive/5 text-center">
              <p className="text-destructive mb-4">
                Deze conversatie is geblokkeerd.
              </p>
              <Link href="/messages">
                <Button variant="outline">Terug naar berichten</Button>
              </Link>
            </Card>
          </div>
        ) : (
          <ChatInterface
            conversationId={conversationId}
            currentUserId={user.id}
            otherUserName={otherUserData?.username || "Gebruiker"}
            currentUserName={user.username}
            otherUserAvatar={otherUserData?.avatar_url}
            currentUserAvatar={user.avatar_url}
          />
        )}
      </div>
    </div>
  );
}
