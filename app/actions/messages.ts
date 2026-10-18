"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendMessageSchema } from "@/lib/schemas";
import {
  successResponse,
  errorResponse,
  extractErrorMessage,
  type ActionResponse,
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
  };
  recipient: {
    username: string;
    avatar_url: string | null;
  };
  created_at: string;
  updated_at: string;
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

  // A block in either direction is refused by the database when the
  // conversation or the message is inserted (#73).

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
 * Get the current user's conversations: the inbox, or the ones they archived
 * for themselves (#91).
 */
export async function getConversations({ archived = false } = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Je moet ingelogd zijn" };
  }

  // RLS only shows the user's own archive rows.
  const { data: archives, error: archivesError } = await supabase
    .from("conversation_archives")
    .select("conversation_id");
  if (archivesError) {
    return { success: false, error: extractErrorMessage(archivesError) };
  }
  const archivedIds = archives.map((a) => a.conversation_id);
  if (archived && archivedIds.length === 0) {
    return { success: true, data: [] };
  }

  let query = supabase
    .from("conversations")
    .select(
      `
      *,
      initiator:initiator_id(id, username, avatar_url),
      recipient:recipient_id(id, username, avatar_url)
    `,
    )
    .or(`initiator_id.eq.${user.id},recipient_id.eq.${user.id}`);
  if (archived) {
    query = query.in("id", archivedIds);
  } else if (archivedIds.length > 0) {
    query = query.not("id", "in", `(${archivedIds.join(",")})`);
  }
  const { data: conversations, error } = await query.order("updated_at", {
    ascending: false,
  });

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
      initiator_name: initiatorUser.username || "Onbekende gebruiker",
      initiator_avatar_url: initiatorUser.avatar_url,
      other_user_id:
        otherUser.id || (isInitiator ? c.recipient_id : c.initiator_id),
      other_user_name: otherUser.username || "Onbekende gebruiker",
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
    // A zoekertje that went offline is hidden by RLS, but its conversations
    // still show its title (#84).
    const { data } =
      adType === "classified"
        ? await supabase.rpc("conversation_classified_titles", {
            p_ids: adIds,
          })
        : await supabase.from("transfers").select("id, title").in("id", adIds);
    const ads = data as { id: string; title: string }[] | null;

    ads?.forEach((ad) => {
      adTitles.set(`${adType}-${ad.id}`, ad.title);
    });
  }

  // Add ad titles to enriched conversations
  enriched?.forEach((conv) => {
    // A deleted zoekertje keeps its conversations (#72).
    conv.ad_title =
      adTitles.get(`${conv.ad_type}-${conv.ad_id}`) ||
      (conv.ad_type === "transfer" ? "Gesprek" : "Verwijderd zoekertje");
  });

  return { success: true, data: enriched || [] };
}

const userIdSchema = z.string().uuid("Ongeldige gebruiker");

/**
 * Block a user (#73): from then on neither of you can send the other a
 * message or start a conversation. Blocking someone already blocked is fine.
 */
export async function blockUser(userId: string): Promise<ActionResponse> {
  const parsed = userIdSchema.safeParse(userId);
  if (!parsed.success) return errorResponse("Ongeldige gebruiker");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn");
  }

  if (user.id === parsed.data) {
    return errorResponse("Je kan jezelf niet blokkeren");
  }

  const { error } = await supabase.from("blocked_users").insert({
    blocker_id: user.id,
    blocked_id: parsed.data,
  });

  // 23505: already blocked.
  if (error && error.code !== "23505") {
    return errorResponse(
      extractErrorMessage(error, "Blokkeren is niet gelukt"),
    );
  }

  revalidatePath("/messages", "layout");
  revalidatePath("/profile");
  return successResponse(undefined);
}

/**
 * Lift a block (#73), from the conversation or the profile page.
 */
export async function unblockUser(userId: string): Promise<ActionResponse> {
  const parsed = userIdSchema.safeParse(userId);
  if (!parsed.success) return errorResponse("Ongeldige gebruiker");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je moet ingelogd zijn");
  }

  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", parsed.data);

  if (error) {
    return errorResponse(
      extractErrorMessage(error, "Deblokkeren is niet gelukt"),
    );
  }

  revalidatePath("/messages", "layout");
  revalidatePath("/profile");
  return successResponse(undefined);
}

const conversationIdSchema = z.string().uuid("Ongeldig gesprek");

/**
 * Archive or unarchive a conversation for the current user only (#91). The
 * other participant keeps it in their inbox. RLS refuses conversations the
 * user isn't part of; a new incoming message unarchives it (DB trigger).
 */
export async function setConversationArchived(
  conversationId: string,
  archived: boolean,
): Promise<ActionResponse<undefined>> {
  const parsed = conversationIdSchema.safeParse(conversationId);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("Je moet ingelogd zijn");

  const { error } = archived
    ? await supabase
        .from("conversation_archives")
        .upsert(
          { conversation_id: parsed.data, user_id: user.id },
          { ignoreDuplicates: true },
        )
    : await supabase
        .from("conversation_archives")
        .delete()
        .eq("conversation_id", parsed.data)
        .eq("user_id", user.id);
  if (error) return errorResponse(extractErrorMessage(error));

  revalidatePath("/messages");
  return successResponse(undefined);
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
