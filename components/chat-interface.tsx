"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dayLabel, isSameBelgianDay } from "@/lib/dates";
import { RelativeTime } from "@/components/relative-time";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { sendMessage, markAsRead } from "@/app/actions/messages";
import { createClient } from "@/lib/supabase/client";
import { BLOCKED_MESSAGE } from "@/lib/blocks";
import { SendHorizontal, Check, CheckCheck, MessageCircle } from "lucide-react";

export interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  is_from_me: boolean;
  is_read?: boolean;
  read_at?: string | null;
  sender_username?: string;
}

interface ChatInterfaceProps {
  conversationId: string;
  /** The latest messages, oldest first, fetched by the page. */
  initialMessages: Message[];
  currentUserId: string;
  otherUserName: string;
  currentUserName?: string;
  otherUserAvatar?: string | null;
  currentUserAvatar?: string | null;
  /** Shown instead of the message box when either user blocked the other (#73). */
  blockedNotice?: React.ReactNode;
}

export function ChatInterface({
  conversationId,
  initialMessages,
  currentUserId,
  otherUserName,
  currentUserName,
  otherUserAvatar,
  currentUserAvatar,
  blockedNotice,
}: ChatInterfaceProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  // True once Realtime delivers database changes; exposed for the E2E tests.
  const [realtimeReady, setRealtimeReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to newest message (container-scoped, not page-level)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Mark messages as read when the conversation is opened / new ones arrive
  const hasUnread = messages.some((m) => !m.is_from_me && !m.is_read);

  useEffect(() => {
    if (!hasUnread) return;
    markAsRead(conversationId).then(() => {
      setMessages((prev) =>
        prev.map((m) =>
          !m.is_from_me && !m.is_read
            ? { ...m, is_read: true, read_at: new Date().toISOString() }
            : m,
        ),
      );
    });
  }, [conversationId, hasUnread]);

  // Subscribe to new messages via Realtime
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // INSERT adds a message, UPDATE carries read receipts. Both carry
          // the full row, and they can arrive before sendMessage returns, so
          // either one may replace our optimistic temp message.
          if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE")
            return;
          const row = payload.new as Record<string, unknown>;

          // Only for this conversation
          if (row.conversation_id !== conversationId) return;

          const realMessage: Message = {
            id: row.id as string,
            content: row.content as string,
            created_at: row.created_at as string,
            sender_id: row.sender_id as string,
            is_from_me: row.sender_id === currentUserId,
            is_read: (row.is_read as boolean) ?? false,
            read_at: (row.read_at as string | null) ?? null,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === realMessage.id)) {
              // Already shown: an INSERT is a duplicate, an UPDATE refreshes
              // the read receipt
              if (payload.eventType === "INSERT") return prev;
              return prev.map((m) =>
                m.id === realMessage.id
                  ? {
                      ...m,
                      is_read: realMessage.is_read,
                      read_at: realMessage.read_at,
                    }
                  : m,
              );
            }

            // Our own message: replace the optimistic temp message
            if (realMessage.is_from_me) {
              const tempIndex = prev.findIndex(
                (m) =>
                  m.id.startsWith("temp-") && m.content === realMessage.content,
              );
              if (tempIndex !== -1) {
                const updated = [...prev];
                updated[tempIndex] = realMessage;
                return updated;
              }
            }

            return payload.eventType === "INSERT"
              ? [...prev, realMessage]
              : prev;
          });
        },
      )
      // Joining the channel isn't enough: changes only flow after the server
      // confirms the postgres_changes listener with this system message.
      .on("system", {}, (payload) => {
        if (payload?.extension === "postgres_changes") {
          setRealtimeReady(payload.status === "ok");
        }
      });

    // Hand the user's token to Realtime before joining. A channel that joins
    // before the session is loaded joins as anon, and RLS then hides every
    // message from it.
    let cancelled = false;
    supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel.subscribe((status) => {
        if (status !== "SUBSCRIBED") setRealtimeReady(false);
      });
    });

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [conversationId, currentUserId]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageContent = newMessage;

    try {
      setSending(true);

      // Optimistic update
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        content: messageContent,
        created_at: new Date().toISOString(),
        sender_id: currentUserId,
        is_from_me: true,
        is_read: false,
        read_at: null,
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setNewMessage("");
      inputRef.current?.focus();

      const result = await sendMessage(conversationId, messageContent);
      if (!result.success) {
        setMessages((prev) =>
          prev.filter((m) => m.id !== optimisticMessage.id),
        );
        setNewMessage(messageContent);
        toast.error(result.error || "Je bericht is niet verstuurd");
        // Blocked since the page loaded: show the notice instead of the box.
        if (result.error === BLOCKED_MESSAGE) router.refresh();
      } else if (result.data) {
        // Swap the temp message for the stored one. Don't rely on the
        // Realtime echo: it is missed when the channel hasn't joined yet.
        const sent = result.data;
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) {
            return prev.filter((m) => m.id !== optimisticMessage.id);
          }
          return prev.map((m) =>
            m.id === optimisticMessage.id
              ? {
                  id: sent.id,
                  content: sent.content,
                  created_at: sent.created_at,
                  sender_id: sent.sender_id,
                  is_from_me: true,
                  is_read: sent.is_read ?? false,
                  read_at: sent.read_at ?? null,
                }
              : m,
          );
        });
      }
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Er is een fout opgetreden bij het verzenden");
    } finally {
      setSending(false);
    }
  }

  function getInitials(name?: string) {
    return (name || "U")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  // Group consecutive messages from same sender
  function shouldShowAvatar(index: number): boolean {
    if (index === messages.length - 1) return true;
    return messages[index].sender_id !== messages[index + 1]?.sender_id;
  }

  // Check if we should show a date separator
  function shouldShowDateSeparator(index: number): boolean {
    if (index === 0) return true;
    return !isSameBelgianDay(
      messages[index].created_at,
      messages[index - 1].created_at,
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages container */}
      <div
        ref={messagesContainerRef}
        data-realtime={realtimeReady ? "ready" : "connecting"}
        className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-primary/60" />
            </div>
            <p className="font-medium text-foreground mb-1">
              Start het gesprek
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Stuur je eerste bericht naar {otherUserName} om het gesprek te
              beginnen.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isFromMe = msg.is_from_me;
            const senderName = isFromMe ? currentUserName : otherUserName;
            const senderAvatar = isFromMe ? currentUserAvatar : otherUserAvatar;
            const initials = getInitials(senderName);
            const showAvatar = shouldShowAvatar(index);
            const showDate = shouldShowDateSeparator(index);
            const isTemporary = msg.id.startsWith("temp-");

            return (
              <div key={msg.id}>
                {/* Date separator */}
                {showDate && (
                  <div className="flex items-center justify-center my-4">
                    {/* Server and browser can straddle midnight. */}
                    <div
                      className="px-3 py-1 rounded-full bg-muted/80 text-xs text-muted-foreground font-medium"
                      suppressHydrationWarning
                    >
                      {dayLabel(msg.created_at)}
                    </div>
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`flex items-end gap-2 ${isFromMe ? "justify-end" : "justify-start"} ${
                    showAvatar ? "mb-2" : "mb-0.5"
                  }`}
                >
                  {/* Other user avatar */}
                  {!isFromMe && (
                    <div className="w-8 shrink-0">
                      {showAvatar ? (
                        <Avatar className="h-8 w-8">
                          {senderAvatar && (
                            <AvatarImage
                              src={senderAvatar}
                              alt={senderName || "Gebruiker"}
                            />
                          )}
                          <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                    </div>
                  )}

                  <div
                    className={`max-w-xs lg:max-w-md ${isFromMe ? "order-1" : ""}`}
                  >
                    <div
                      className={`px-3.5 py-2 ${
                        isFromMe
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                          : "bg-card border border-border text-foreground rounded-2xl rounded-bl-sm"
                      }`}
                    >
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>

                    {/* Timestamp + read receipt row */}
                    <div
                      className={`flex items-center gap-1 mt-0.5 px-1 ${
                        isFromMe ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span
                        className={`text-tiny text-muted-foreground ${
                          showAvatar ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        <RelativeTime date={msg.created_at} addSuffix={false} />
                      </span>

                      {/* Read receipt for own messages */}
                      {isFromMe && (
                        <span
                          className="flex items-center"
                          role="img"
                          aria-label={
                            isTemporary
                              ? "Wordt verstuurd"
                              : msg.is_read
                                ? "Gelezen"
                                : "Verzonden"
                          }
                        >
                          {isTemporary ? (
                            <Check className="h-3 w-3 text-muted-foreground/50" />
                          ) : msg.is_read ? (
                            <CheckCheck className="h-3 w-3 text-primary" />
                          ) : (
                            <Check className="h-3 w-3 text-muted-foreground" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Current user avatar */}
                  {isFromMe && (
                    <div className="w-8 shrink-0 order-2">
                      {showAvatar ? (
                        <Avatar className="h-8 w-8">
                          {currentUserAvatar && (
                            <AvatarImage
                              src={currentUserAvatar}
                              alt={currentUserName || "Jij"}
                            />
                          )}
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                            {getInitials(currentUserName)}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        {blockedNotice ? (
          <div className="max-w-2xl mx-auto">{blockedNotice}</div>
        ) : (
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 max-w-2xl mx-auto"
          >
            <Input
              ref={inputRef}
              type="text"
              placeholder="Typ je bericht..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending}
              className="flex-1 bg-background min-h-11 rounded-full px-4 text-sm"
              enterKeyHint="send"
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={sending || !newMessage.trim()}
              size="icon-xl"
              className="rounded-full"
              aria-label="Verstuur bericht"
            >
              <SendHorizontal className="h-5 w-5" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
