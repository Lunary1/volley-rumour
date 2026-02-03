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
          <Card className="p-6 border-destructive/50 bg-destructive/5">
            <p className="text-destructive">Gebruiker niet gevonden</p>
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

  const adListHref =
    conversation.ad_type === "transfer" ? "/transfers" : "/zoekertjes";
  const adTypeLabel =
    conversation.ad_type === "transfer" ? "Transfer" : "Zoekertje";

  return (
    <div className="h-dvh sm:h-screen bg-background flex flex-col overflow-hidden">
      {/* Context header: linked ad + conversation partner */}
      <header className="border-b border-border bg-card shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="px-3 py-2 sm:px-4 sm:py-3 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Link href="/messages" className="shrink-0 -ml-1">
              <Button variant="ghost" size="sm" className="gap-1.5">
                ← Terug
              </Button>
            </Link>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Berichten
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <Link
              href={adListHref}
              className="text-base sm:text-lg font-semibold text-foreground hover:text-primary hover:underline underline-offset-2 truncate max-w-[min(100%,20rem)]"
              title={adData?.title || "Gesprek"}
            >
              {adData?.title || "Gesprek"}
            </Link>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground shrink-0">
              {adTypeLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Met <span className="font-medium text-foreground">{otherUserData?.username}</span>
          </p>
        </div>
      </header>

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
