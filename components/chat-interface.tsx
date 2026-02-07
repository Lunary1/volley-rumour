"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { sendMessage, getMessages, markAsRead } from "@/app/actions/messages";
import { createClient } from "@/lib/supabase/client";
import { SendHorizontal, Check, CheckCheck, MessageCircle } from "lucide-react";

interface Message {
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Auto-scroll to newest message (container-scoped, not page-level)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Mark messages as read when conversation is opened / new messages arrive
  const markConversationAsRead = useCallback(async () => {
    const hasUnread = messages.some((m) => !m.is_from_me && !m.is_read);
    if (hasUnread) {
      await markAsRead(conversationId);
      setMessages((prev) =>
        prev.map((m) =>
          !m.is_from_me && !m.is_read
            ? { ...m, is_read: true, read_at: new Date().toISOString() }
            : m,
        ),
      );
    }
  }, [conversationId, messages]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      markConversationAsRead();
    }
  }, [loading, messages.length, markConversationAsRead]);

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
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as Record<string, unknown>;

            // Only add if it's for this conversation
            if (newMsg.conversation_id !== conversationId) return;

            setMessages((prev) => {
              // Skip if we already have this exact message
              if (prev.some((m) => m.id === newMsg.id)) return prev;

              const realMessage = {
                id: newMsg.id as string,
                content: newMsg.content as string,
                created_at: newMsg.created_at as string,
                sender_id: newMsg.sender_id as string,
                is_from_me: newMsg.sender_id === currentUserId,
                is_read: (newMsg.is_read as boolean) ?? false,
                read_at: (newMsg.read_at as string | null) ?? null,
              };

              // If this is our own message arriving via Realtime,
              // replace the optimistic temp message instead of appending
              if (newMsg.sender_id === currentUserId) {
                const tempIndex = prev.findIndex(
                  (m) =>
                    m.id.startsWith("temp-") && m.content === newMsg.content,
                );
                if (tempIndex !== -1) {
                  const updated = [...prev];
                  updated[tempIndex] = realMessage;
                  return updated;
                }
              }

              return [...prev, realMessage];
            });
          }

          // Handle UPDATE events for read receipts
          if (payload.eventType === "UPDATE") {
            const updatedMsg = payload.new as Record<string, unknown>;
            if (updatedMsg.conversation_id !== conversationId) return;

            setMessages((prev) =>
              prev.map((m) =>
                m.id === updatedMsg.id
                  ? {
                      ...m,
                      is_read: (updatedMsg.is_read as boolean) ?? m.is_read,
                      read_at:
                        (updatedMsg.read_at as string | null) ?? m.read_at,
                    }
                  : m,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
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
        alert(result.error || "Failed to send message");
      }
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Er is een fout opgetreden bij het verzenden");
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
    const current = new Date(messages[index].created_at);
    const previous = new Date(messages[index - 1].created_at);
    return current.toDateString() !== previous.toDateString();
  }

  function formatDateSeparator(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Vandaag";
    if (date.toDateString() === yesterday.toDateString()) return "Gisteren";
    return format(date, "d MMMM yyyy", { locale: nl });
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`flex items-end gap-2 ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
            >
              {i % 2 === 0 && (
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
              )}
              <div
                className={`h-12 rounded-2xl animate-pulse ${
                  i % 2 === 0
                    ? "bg-muted/60 w-2/3 rounded-bl-sm"
                    : "bg-primary/15 w-2/3 rounded-br-sm"
                }`}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages container */}
      <div
        ref={messagesContainerRef}
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
                    <div className="px-3 py-1 rounded-full bg-muted/80 text-xs text-muted-foreground font-medium">
                      {formatDateSeparator(msg.created_at)}
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
                        className={`text-[10px] text-muted-foreground ${
                          showAvatar ? "opacity-100" : "opacity-0"
                        }`}
                        title={format(
                          new Date(msg.created_at),
                          "d MMM yyyy HH:mm",
                          { locale: nl },
                        )}
                      >
                        {formatDistanceToNow(new Date(msg.created_at), {
                          addSuffix: false,
                          locale: nl,
                        })}
                      </span>

                      {/* Read receipt for own messages */}
                      {isFromMe && (
                        <span className="flex items-center">
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
        <form
          onSubmit={handleSendMessage}
          className="flex items-center gap-2 max-w-2xl mx-auto"
        >
          <Input
            ref={inputRef}
            type="text"
            placeholder="Type je bericht..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={sending}
            className="flex-1 bg-background min-h-[44px] rounded-full px-4 text-sm"
            enterKeyHint="send"
            autoComplete="off"
          />
          <Button
            type="submit"
            disabled={sending || !newMessage.trim()}
            size="icon"
            className="h-[44px] w-[44px] rounded-full shrink-0"
            aria-label="Verstuur bericht"
          >
            <SendHorizontal className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
