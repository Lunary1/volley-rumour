"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { sendMessage, getMessages } from "@/app/actions/messages";
import { createClient } from "@/lib/supabase/client";
import { Paperclip, Send, Check, CheckCheck } from "lucide-react";

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  is_from_me: boolean;
  is_read?: boolean;
  sender_username?: string;
}

interface ChatInterfaceProps {
  conversationId: string;
  currentUserId: string;
  otherUserName: string;
  currentUserName?: string;
  otherUserAvatar?: string | null;
  currentUserAvatar?: string | null;
}

export function ChatInterface({
  conversationId,
  currentUserId,
  otherUserName,
  currentUserName,
  otherUserAvatar,
  currentUserAvatar,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial messages
  useEffect(() => {
    async function loadMessages() {
      try {
        setLoading(true);
        const result = await getMessages(conversationId);
        if (result.success && result.data) {
          setMessages(result.data);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, [conversationId]);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Subscribe to new messages via Realtime
  useEffect(() => {
    const supabase = createClient();

    console.log(
      "[ChatInterface] Setting up Realtime subscription for conversation:",
      conversationId,
    );

    const channel = supabase
      .channel("messages-unread")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("[ChatInterface] Received Realtime payload:", payload);

          // Only process INSERT events
          if (payload.eventType !== "INSERT") {
            return;
          }

          const newMsg = payload.new as any;

          // Only add if it's for this conversation
          if (newMsg.conversation_id !== conversationId) {
            console.log(
              "[ChatInterface] Message is for different conversation, ignoring",
              {
                msgConversationId: newMsg.conversation_id,
                currentConversationId: conversationId,
              },
            );
            return;
          }

          console.log("[ChatInterface] Adding message to chat:", newMsg);
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) {
              console.log("[ChatInterface] Message already exists, skipping");
              return prev;
            }
            return [
              ...prev,
              {
                id: newMsg.id,
                content: newMsg.content,
                created_at: newMsg.created_at,
                sender_id: newMsg.sender_id,
                is_from_me: newMsg.sender_id === currentUserId,
                is_read: newMsg.is_read ?? false,
              },
            ];
          });
        },
      )
      .subscribe((status, err) => {
        console.log("[ChatInterface] Subscription status:", status, err);
        if (err) {
          console.error("[ChatInterface] Subscription error:", err);
        }
      });

    return () => {
      console.log("[ChatInterface] Cleaning up Realtime subscription");
      channel.unsubscribe();
    };
  }, [conversationId, currentUserId]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageContent = newMessage;

    try {
      setSending(true);

      // Optimistic update - add message to UI immediately
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        content: messageContent,
        created_at: new Date().toISOString(),
        sender_id: currentUserId,
        is_from_me: true,
        is_read: false,
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setNewMessage("");

      // Then send to server
      const result = await sendMessage(conversationId, messageContent);
      if (!result.success) {
        // Remove optimistic message if send failed
        setMessages((prev) =>
          prev.filter((m) => m.id !== optimisticMessage.id),
        );
        alert(result.error || "Failed to send message");
      }
      // If successful, Realtime will update or we keep the optimistic one
    } catch (err) {
      console.error("Error sending message:", err);
      alert("An error occurred while sending your message");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background min-h-0">
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`flex gap-2 ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`h-14 w-48 sm:w-56 max-w-[85%] rounded-2xl animate-pulse ${
                  i % 2 === 0
                    ? "bg-muted rounded-bl-md"
                    : "bg-primary/20 rounded-br-md"
                }`}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-2 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-48 text-center text-muted-foreground px-4">
            <p className="text-sm">Je hebt nog geen berichten uitgewisseld met {otherUserName}.</p>
            <p className="text-xs mt-1">Stuur een bericht om het gesprek te starten.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isFromMe = msg.is_from_me;
              const senderName = isFromMe ? currentUserName : otherUserName;
              const senderAvatar = isFromMe ? currentUserAvatar : otherUserAvatar;
              const initials = (senderName || "U")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              const exactTime = format(new Date(msg.created_at), "d MMM yyyy, HH:mm", { locale: nl });
              const relativeTime = formatDistanceToNow(new Date(msg.created_at), {
                addSuffix: true,
                locale: nl,
              });

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isFromMe ? "justify-end" : "justify-start"}`}
                >
                  {!isFromMe && (
                    <Avatar className="h-8 w-8 shrink-0 mt-1 ring-2 ring-background">
                      {senderAvatar ? (
                        <img
                          src={senderAvatar}
                          alt={senderName || ""}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                          {initials}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  )}
                  <div className="flex flex-col items-end max-w-[85%] sm:max-w-[75%] lg:max-w-md">
                    <div
                      className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                        isFromMe
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-card border border-border text-foreground rounded-bl-md"
                      }`}
                    >
                      <p className="text-[15px] leading-snug wrap-break-word whitespace-pre-wrap">
                        {msg.content}
                      </p>
                      <div
                        className={`flex items-center gap-1.5 mt-1.5 justify-end ${
                          isFromMe ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        <time
                          dateTime={msg.created_at}
                          title={exactTime}
                          className="text-[11px] tabular-nums"
                        >
                          {relativeTime}
                        </time>
                        {isFromMe && (
                          <span
                            className="shrink-0"
                            title={msg.is_read ? "Gelezen" : "Verzonden"}
                            aria-label={msg.is_read ? "Gelezen" : "Verzonden"}
                          >
                            {msg.is_read ? (
                              <CheckCheck className="size-3.5 text-primary-foreground/90" />
                            ) : (
                              <Check className="size-3.5 text-primary-foreground/70" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isFromMe && (
                    <Avatar className="h-8 w-8 shrink-0 mt-1 ring-2 ring-background order-last">
                      {currentUserAvatar ? (
                        <img
                          src={currentUserAvatar}
                          alt={currentUserName || ""}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                          {initials}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area: attachment placeholder + field + send */}
      <div className="border-t border-border bg-card p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 size-10 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label="Bijlage toevoegen (binnenkort)"
            title="Bijlage toevoegen (binnenkort)"
          >
            <Paperclip className="size-5" />
          </Button>
          <Input
            type="text"
            placeholder="Type je bericht..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={sending}
            className="flex-1 min-h-10 rounded-xl bg-background border-border"
          />
          <Button
            type="submit"
            disabled={sending || !newMessage.trim()}
            size="icon"
            className="shrink-0 size-10 rounded-xl"
            aria-label={sending ? "Versturen..." : "Verstuur"}
          >
            <Send className="size-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
