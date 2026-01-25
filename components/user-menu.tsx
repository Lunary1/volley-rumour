"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, MessageSquare, Settings } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { CurrentUserAvatar } from "@/components/current-user-avatar";

interface UserMenuProps {
  user: {
    id: string;
    username: string;
    trust_score: number;
    avatar_url: string | null;
  } | null;
  isMobile?: boolean;
}

export function UserMenu({ user, isMobile = false }: UserMenuProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    const userId = user.id;

    // Initial count
    async function getUnreadCount() {
      const { data } = await supabase
        .from("conversations")
        .select("id")
        .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`);

      if (data) {
        // Get unread messages for these conversations
        const conversationIds = data.map((c) => c.id);
        const { data: unreadMessages } = await supabase
          .from("messages")
          .select("conversation_id")
          .in("conversation_id", conversationIds)
          .eq("is_read", false)
          .neq("sender_id", userId);

        const unreadMap = new Map();
        unreadMessages?.forEach((msg: any) => {
          unreadMap.set(
            msg.conversation_id,
            (unreadMap.get(msg.conversation_id) || 0) + 1,
          );
        });

        const total = Array.from(unreadMap.values()).reduce(
          (sum: number, count: number) => sum + count,
          0,
        );
        setUnreadCount(total);
      }
    }

    getUnreadCount();

    // Subscribe to changes on messages table
    const channel = supabase
      .channel("messages-unread")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          console.log("[UserMenu] Received Realtime payload:", payload);
          // Recalculate unread count when messages change
          await getUnreadCount();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const containerClass = isMobile
    ? "flex flex-col gap-2 mt-4 pt-4 border-t border-border px-4"
    : "flex items-center gap-3";

  if (!user) {
    return (
      <div className={containerClass}>
        <Link href="/auth/login" className={isMobile ? "w-full" : ""}>
          <Button
            variant="ghost"
            size="sm"
            className={isMobile ? "w-full justify-start" : ""}
          >
            <User className="mr-2 h-4 w-4" />
            Inloggen
          </Button>
        </Link>
        <Link href="/auth/sign-up" className={isMobile ? "w-full" : ""}>
          <Button
            size="sm"
            className={`bg-primary text-primary-foreground hover:bg-primary/90 ${isMobile ? "w-full" : ""}`}
          >
            Registreren
          </Button>
        </Link>
      </div>
    );
  }

  const userCardClass = isMobile
    ? ""
    : "flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50";

  return (
    <div className={containerClass}>
      {/* Messages link with badge */}
      <Link href="/messages" className={isMobile ? "w-full" : ""}>
        <Button
          variant="ghost"
          size="sm"
          className={`relative ${isMobile ? "w-full justify-start" : ""}`}
        >
          <MessageSquare className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </Link>

      {/* Profile settings link */}
      <Link href="/profile" className={isMobile ? "w-full" : ""}>
        <Button
          variant="ghost"
          size="sm"
          className={isMobile ? "w-full justify-start" : ""}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </Link>

      <div className={userCardClass}>
        <CurrentUserAvatar imageUrl={user.avatar_url} name={user.username} />
        <div className={isMobile ? "" : "hidden sm:block"}>
          <p className="text-sm font-medium text-foreground">{user.username}</p>
          <p className="text-xs text-muted-foreground">
            {user.trust_score} pts
          </p>
        </div>
      </div>
      <form action={logout} suppressHydrationWarning>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className={
            isMobile
              ? "w-full justify-start text-destructive hover:text-destructive"
              : ""
          }
        >
          <LogOut className="mr-2 h-4 w-4" />
          Uitloggen
        </Button>
      </form>
    </div>
  );
}
