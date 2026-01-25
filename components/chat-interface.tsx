"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { sendMessage, getMessages } from "@/app/actions/messages";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  is_from_me: boolean;
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
            // Check if message already exists to avoid duplicates
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
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        content: messageContent,
        created_at: new Date().toISOString(),
        sender_id: currentUserId,
        is_from_me: true,
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
      <div className="flex flex-col h-full bg-background">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`h-12 rounded-lg animate-pulse ${
                  i % 2 === 0 ? "bg-muted w-2/3" : "bg-primary/20 w-2/3"
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
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">
            <p>Je hebt nog geen berichten uitgewisseld met {otherUserName}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isFromMe = msg.is_from_me;
            const senderName = isFromMe ? currentUserName : otherUserName;
            const senderAvatar = isFromMe ? currentUserAvatar : otherUserAvatar;
            const initials = (senderName || "U")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase();

            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isFromMe ? "justify-end" : "justify-start"}`}
              >
                {!isFromMe && (
                  <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-xl ${
                    isFromMe
                      ? "bg-primary text-primary-foreground rounded-br-none shadow-sm"
                      : "bg-card border border-border text-foreground rounded-bl-none shadow-sm"
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isFromMe
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {formatDistanceToNow(new Date(msg.created_at), {
                      addSuffix: true,
                      locale: nl,
                    })}
                  </p>
                </div>
                {isFromMe && (
                  <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card p-4">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            type="text"
            placeholder="Type je bericht..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={sending}
            className="flex-1 bg-background"
          />
          <Button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="whitespace-nowrap"
          >
            {sending ? "Versturen..." : "Verstuur"}
          </Button>
        </form>
      </div>
    </div>
  );
}
