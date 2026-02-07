"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendMessageSchema } from "@/lib/schemas";
import {
  successResponse,
  errorResponse,
  extractErrorMessage,
} from "@/lib/response";

export interface Conversation {
  id: string;
  ad_id: string;
  ad_type: string;
  initiator_id: string;
  recipient_id: string;
  initiator: {
    username: string;
    avatar_url: string | null;
    trust_score: number;
  };
  recipient: {
    username: string;
    avatar_url: string | null;
    trust_score: number;
  };
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  unread_count?: number;
  last_message?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  contact_shared: { email?: string; phone?: string } | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Check if a conversation already exists between current user and another user for an ad
 * Used to redirect to existing conversation instead of opening modal
 */
export async function getExistingConversation(
  adId: string,
  recipientId: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn");
  }

  if (user.id === recipientId) {
    return errorResponse("Je kan jezelf geen bericht sturen");
  }

  // Check if conversation exists - bidirectional
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("ad_id", adId)
    .or(
      `and(initiator_id.eq.${user.id},recipient_id.eq.${recipientId}),and(initiator_id.eq.${recipientId},recipient_id.eq.${user.id})`,
    )
    .single();

  if (existing) {
    return successResponse({ conversationId: existing.id });
  }

  return errorResponse("Geen conversatie gevonden");
}

/**
 * Create or get a conversation between user and ad creator
 */
export async function createConversation(
  adId: string,
  adType: "transfer_talk" | "classified",
  recipientId: string,
  initialMessage?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn");
  }

  if (user.id === recipientId) {
    return errorResponse("Je kan jezelf geen bericht sturen");
  }

  // Check if user is blocked
  const { data: isBlocked } = await supabase
    .from("blocked_users")
    .select("id")
    .eq("blocker_id", recipientId)
    .eq("blocked_id", user.id)
    .single();

  if (isBlocked) {
    return errorResponse("Deze gebruiker heeft je geblokkeerd");
  }

  // Try to get existing conversation - check both directions
  // (user could be initiator OR recipient from a previous conversation)
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("ad_id", adId)
    .or(
      `and(initiator_id.eq.${user.id},recipient_id.eq.${recipientId}),and(initiator_id.eq.${recipientId},recipient_id.eq.${user.id})`,
    )
    .single();

  let conversationId = existing?.id;

  // Create if doesn't exist
  if (!conversationId) {
    const { data: newConversation, error } = await supabase
      .from("conversations")
      .insert({
        ad_id: adId,
        ad_type: adType,
        initiator_id: user.id,
        recipient_id: recipientId,
      })
      .select("id")
      .single();

    if (error) {
      const message = extractErrorMessage(
        error,
        "Fout bij aanmaken van conversatie",
      );
      return errorResponse(message);
    }

    conversationId = newConversation.id;
  }

  // Send initial message if provided
  if (initialMessage && initialMessage.trim()) {
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: initialMessage.trim(),
    });

    if (error) {
      const message = extractErrorMessage(error, "Fout bij sturen van bericht");
      return errorResponse(message);
    }
  }

  revalidatePath("/messages");
  return successResponse({ conversationId });
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(
  conversationId: string,
  content: string,
  contactShared?: { email?: string; phone?: string },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn");
  }

  // Validate input
  const validationResult = sendMessageSchema.safeParse({
    conversationId,
    content,
  });

  if (!validationResult.success) {
    const errors = validationResult.error.errors
      .map((e) => e.message)
      .join("; ");
    return errorResponse(errors);
  }

  // Verify user is part of this conversation
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .single();

  if (!conversation) {
    return errorResponse("Je hebt geen toegang tot deze conversatie");
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: validationResult.data.content,
      contact_shared: contactShared || null,
    })
    .select()
    .single();

  if (error) {
    const msg = extractErrorMessage(error, "Fout bij sturen van bericht");
    return errorResponse(msg);
  }

  // Update conversation updated_at
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return successResponse(message);
}

/**
 * Get all conversations for current user
 */
export async function getConversations() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Must be logged in" };
  }

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(
      `
      *,
      initiator:initiator_id(id, username, avatar_url, trust_score),
      recipient:recipient_id(id, username, avatar_url, trust_score)
    `,
    )
    .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  // Get unread counts
  const conversationIds = conversations?.map((c) => c.id) || [];
  const { data: unreadData } = await supabase
    .from("messages")
    .select("conversation_id, id")
    .in("conversation_id", conversationIds)
    .eq("is_read", false)
    .neq("sender_id", user.id);

  const unreadMap = new Map();
  unreadData?.forEach((msg) => {
    unreadMap.set(
      msg.conversation_id,
      (unreadMap.get(msg.conversation_id) || 0) + 1,
    );
  });

  // Get last message for each conversation
  const lastMessageMap = new Map();

  for (const conversationId of conversationIds) {
    const { data: lastMessage } = await supabase
      .from("messages")
      .select("conversation_id, content, sender_id")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lastMessage) {
      lastMessageMap.set(conversationId, {
        content: lastMessage.content,
        sender_id: lastMessage.sender_id,
      });
    }
  }

  const enriched = conversations?.map((c) => {
    // Determine which user is the "other" user
    const isInitiator = c.initiator_id === user.id;
    const otherUser = isInitiator ? c.recipient : c.initiator;
    const initiatorUser = c.initiator;

    return {
      id: c.id,
      ad_id: c.ad_id,
      ad_type: c.ad_type,
      ad_title: "", // Will be fetched separately
      initiator_id: c.initiator_id,
      initiator_name: initiatorUser.username || "Unknown User",
      initiator_avatar_url: initiatorUser.avatar_url,
      other_user_id:
        otherUser.id || (isInitiator ? c.recipient_id : c.initiator_id),
      other_user_name: otherUser.username || "Unknown User",
      other_user_avatar_url: otherUser.avatar_url,
      last_message: lastMessageMap.get(c.id)?.content,
      last_message_at: c.updated_at,
      unread_count: unreadMap.get(c.id) || 0,
      last_message_is_from_me: lastMessageMap.get(c.id)?.sender_id === user.id,
    };
  });

  // Fetch ad titles for all conversations
  const adsByType = new Map<string, string[]>();
  enriched?.forEach((conv) => {
    if (!adsByType.has(conv.ad_type)) {
      adsByType.set(conv.ad_type, []);
    }
    adsByType.get(conv.ad_type)?.push(conv.ad_id);
  });

  const adTitles = new Map<string, string>();

  for (const [adType, adIds] of adsByType) {
    const tableName = adType === "transfer" ? "transfers" : "classifieds";
    const { data: ads } = await supabase
      .from(tableName)
      .select("id, title")
      .in("id", adIds);

    ads?.forEach((ad) => {
      adTitles.set(`${adType}-${ad.id}`, ad.title);
    });
  }

  // Add ad titles to enriched conversations
  enriched?.forEach((conv) => {
    conv.ad_title = adTitles.get(`${conv.ad_type}-${conv.ad_id}`) || "Ad";
  });

  return { success: true, data: enriched || [] };
}

/**
 * Get messages for a specific conversation
 */
export async function getMessages(
  conversationId: string,
  limit = 50,
  offset = 0,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Must be logged in" };
  }

  // Verify user is part of conversation
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .single();

  if (!conversation) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { success: false, error: error.message };
  }

  // Mark messages as read (with read_at timestamp)
  await supabase
    .from("messages")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .eq("is_read", false);

  // Add is_from_me field to each message
  const enrichedMessages =
    messages?.map((msg) => ({
      ...msg,
      is_from_me: msg.sender_id === user.id,
    })) || [];

  revalidatePath(`/messages/${conversationId}`);
  return { success: true, data: enrichedMessages.reverse() };
}

/**
 * Block a user
 */
export async function blockUser(userId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be logged in" };
  }

  const { error } = await supabase.from("blocked_users").insert({
    blocker_id: user.id,
    blocked_id: userId,
  });

  if (error && !error.message?.includes("duplicate")) {
    return { error: error.message };
  }

  revalidatePath("/messages");
  return { success: true };
}

/**
 * Unblock a user
 */
export async function unblockUser(userId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be logged in" };
  }

  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/messages");
  return { success: true };
}

/**
 * Archive a conversation
 */
export async function archiveConversation(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be logged in" };
  }

  // Verify user is part of conversation
  const { data: conversation } = await supabase
    .from("conversations")
    .select("initiator_id, recipient_id")
    .eq("id", conversationId)
    .single();

  if (
    !conversation ||
    (conversation.initiator_id !== user.id &&
      conversation.recipient_id !== user.id)
  ) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("conversations")
    .update({ is_archived: true })
    .eq("id", conversationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/messages");
  return { success: true };
}

/**
 * Report a conversation
 */
export async function reportConversation(
  conversationId: string,
  reason: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be logged in" };
  }

  if (!reason.trim()) {
    return { error: "Reason is required" };
  }

  const { error } = await supabase.from("reported_conversations").insert({
    conversation_id: conversationId,
    reporter_id: user.id,
    reason: reason.trim(),
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

/**
 * Mark messages in a conversation as read (called from client when viewing)
 */
export async function markAsRead(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn");
  }

  // Verify user is part of conversation
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .single();

  if (!conversation) {
    return errorResponse("Je hebt geen toegang tot deze conversatie");
  }

  const { error } = await supabase
    .from("messages")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .eq("is_read", false);

  if (error) {
    return errorResponse(error.message);
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return successResponse(null);
}
