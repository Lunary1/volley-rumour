"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LogOut,
  User,
  MessageSquare,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { CurrentUserAvatar } from "@/components/current-user-avatar";

interface UserMenuProps {
  user: {
    id: string;
    username: string;
    trust_score: number;
    avatar_url: string | null;
    is_staff?: boolean;
  } | null;
  isMobile?: boolean;
}

export function UserMenu({ user, isMobile = false }: UserMenuProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  // Depend on the id, not the object: every server refresh passes a new user
  // object, and resubscribing the channel below breaks other channels on the
  // same Realtime connection (the open chat stopped getting updates).
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Messages addressed to me that I haven't read. The database sets
    // `recipient_id` (#74), so no conversation lookup is needed.
    async function getUnreadCount() {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .eq("is_read", false);
      setUnreadCount(count ?? 0);
    }

    getUnreadCount();

    // Only my own incoming messages: a new one raises the count, marking one
    // read lowers it. Realtime applies the filter on the server, so other
    // messages never reach this browser (#74).
    const filter = `recipient_id=eq.${userId}`;
    const channel = supabase
      .channel(`unread-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter },
        () => getUnreadCount(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter },
        () => getUnreadCount(),
      );

    // Join with the user's token, not as anon (see ChatInterface)
    let cancelled = false;
    supabase.realtime.setAuth().then(() => {
      if (!cancelled) channel.subscribe();
    });

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [userId]);

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

      {user.is_staff && (
        <Link href="/admin" className={isMobile ? "w-full" : ""}>
          <Button
            variant="ghost"
            size="sm"
            className={isMobile ? "w-full justify-start" : ""}
          >
            <ShieldCheck className="h-4 w-4" />
            Beheer
          </Button>
        </Link>
      )}

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
