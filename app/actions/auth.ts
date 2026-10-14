"use server";

import { cache } from "react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createHash } from "crypto";
import { z } from "zod";
import { isRecoverySession } from "@/lib/supabase/recovery";
import {
  errorResponse,
  successResponse,
  type ActionResponse,
} from "@/lib/response";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * KAN-53 – Auth model: login method mismatch
 *
 * Auth model (Pattern C — Linked Identity Model):
 * - Google-registered users can ONLY log in via OAuth by default.
 * - They can optionally add a password via the "Forgot password" flow.
 * - After setting a password the account works with both methods (Supabase auto-links).
 * - Email/password users who later sign in via Google are auto-linked (KAN-50).
 *
 * Security note: we intentionally do NOT detect whether a failed login is due to
 * a Google-only account. Doing so would allow account enumeration (anyone could
 * probe which emails are registered and via which provider — a GDPR violation).
 * Instead, the login page shows a static, unconditional hint to guide Google
 * users without leaking any per-email information.
 */
export async function login(email: string, password: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Always return the same generic message regardless of account type
    // to prevent leaking whether an email address is registered or which
    // provider it uses.
    return { error: "Ongeldig e-mailadres of wachtwoord." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

// Use React cache() for request-scoped deduplication — automatically
// scoped to a single server request, so no stale data persists across requests.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get user profile for additional info
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, trust_score, avatar_url")
    .eq("id", user.id)
    .single();

  const userData = {
    id: user.id,
    email: user.email,
    username: profile?.username,
    trust_score: profile?.trust_score || 0,
    avatar_url: profile?.avatar_url,
  };

  return userData;
});

/**
 * KAN-53 – Password reset request
 *
 * Works for both email/password accounts AND Google-only accounts:
 * - For email/password accounts: standard password reset.
 * - For Google-only accounts: Supabase sends a magic link; after following
 *   it and setting a password, both Google and email/password login work.
 *
 * Always returns a generic success message to prevent email enumeration.
 */
export async function requestPasswordReset(email: string) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") || "";

  // Fire the reset regardless of whether the account exists — Supabase only
  // sends an email when the address is registered (prevents enumeration).
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  });

  // Always return the same message to avoid leaking account existence.
  return { success: true };
}

const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens zijn"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Wachtwoorden komen niet overeen",
  });

/**
 * #58 – Sets a new password from the reset link (/auth/update-password).
 *
 * The link signs the user in with a recovery session, so no current password
 * is asked. That is also how a Google-only account adds a password. Only a
 * recovery session may use this; a normal session changes its password on
 * the profile page, which asks for the current one.
 */
export async function setNewPassword(
  password: string,
  confirmPassword: string,
): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isRecoverySession(supabase))) {
    return errorResponse(
      "Je herstellink is ongeldig of verlopen. Vraag een nieuwe aan.",
    );
  }

  const parsed = newPasswordSchema.safeParse({ password, confirmPassword });
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0].message);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") {
      return errorResponse("Kies een ander wachtwoord dan je huidige.");
    }
    return errorResponse("Kon wachtwoord niet instellen. Probeer het opnieuw.");
  }

  revalidatePath("/", "layout");
  return successResponse(undefined);
}

/**
 * #58 – Sends the logged-in user a link to set a password. For Google-only
 * accounts, which have no current password to fill in on the profile page.
 * Always goes to the session's own address.
 */
export async function sendPasswordSetupLink(): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return errorResponse("Je moet ingelogd zijn");

  const origin = (await headers()).get("origin") || "";
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  });
  if (error) {
    return errorResponse(
      "Kon de e-mail niet versturen. Probeer het later opnieuw.",
    );
  }
  return successResponse(undefined);
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") || "";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    // Map common Supabase errors to Dutch messages
    if (error.message.includes("provider")) {
      return { error: "Google login is momenteel niet beschikbaar." };
    }
    return {
      error: "Er ging iets mis met Google login. Probeer het later opnieuw.",
    };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { error: "Er ging iets mis met Google login. Probeer het opnieuw." };
}

/**
 * KAN-52 – GDPR Right to be Forgotten
 *
 * Permanently deletes the authenticated user's account and all personal data.
 * Anonymizes community content (rumours, classifieds) so public value is retained.
 * Writes a SHA-256-hashed audit entry — no raw personal data stored.
 *
 * Deletion order is FK-safe (children before parents).
 */
export async function deleteAccount(): Promise<{ error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const userId = user.id;
  const authProvider =
    user.app_metadata?.provider ?? user.app_metadata?.providers?.[0] ?? null;

  // The data steps below write columns users can't change themselves
  // (authorship, contact details), so they run with the service role. Every
  // query is scoped to the verified session's userId.
  const admin = createAdminClient();

  // --- 1. Anonymize reported_conversations (retain moderation audit trail) ---
  const { error: rcErr } = await admin
    .from("reported_conversations")
    .update({ reporter_id: null })
    .eq("reporter_id", userId);
  if (rcErr) return { error: "Kon meldingen niet verwerken." };

  // --- 2. Anonymize rumours (detach authorship; content stays public) ---
  const { error: rumourErr } = await admin
    .from("rumours")
    .update({ creator_id: null })
    .eq("creator_id", userId);
  if (rumourErr) return { error: "Kon geruchten niet verwerken." };

  // --- 3. Anonymize classifieds (strip PII, keep listing) ---
  const { error: classifiedErr } = await admin
    .from("classifieds")
    .update({
      user_id: null,
      contact_name: "[verwijderd]",
      contact_email: null,
    })
    .eq("user_id", userId);
  if (classifiedErr) return { error: "Kon zoekertjes niet verwerken." };

  // --- 4. Hard-delete rumour votes ---
  const { error: votesErr } = await admin
    .from("rumour_votes")
    .delete()
    .eq("user_id", userId);
  if (votesErr) return { error: "Kon stemmen niet verwijderen." };

  // --- 5. Hard-delete blocked_users (both directions) ---
  const { error: blockErr } = await admin
    .from("blocked_users")
    .delete()
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  if (blockErr) return { error: "Kon geblokkeerde gebruikers niet verwerken." };

  // --- 6. Fetch conversation IDs the user was part of ---
  const { data: convRows, error: convFetchErr } = await admin
    .from("conversations")
    .select("id")
    .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`);
  if (convFetchErr) return { error: "Kon gesprekken niet ophalen." };

  const convIds = (convRows ?? []).map((r) => r.id);

  // --- 7. Hard-delete messages in those conversations ---
  if (convIds.length > 0) {
    const { error: msgErr } = await admin
      .from("messages")
      .delete()
      .in("conversation_id", convIds);
    if (msgErr) return { error: "Kon berichten niet verwijderen." };
  }

  // --- 8. Hard-delete conversations ---
  const { error: convErr } = await admin
    .from("conversations")
    .delete()
    .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`);
  if (convErr) return { error: "Kon gesprekken niet verwijderen." };

  // --- 9. Delete avatar from Supabase Storage (if hosted there) ---
  const { data: profileRow } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .single();

  const avatarUrl: string | null = profileRow?.avatar_url ?? null;
  const supabaseStoragePrefix =
    process.env.NEXT_PUBLIC_SUPABASE_URL + "/storage/v1/object/public/";
  if (avatarUrl && avatarUrl.startsWith(supabaseStoragePrefix)) {
    // Extract bucket + path from the URL
    const withoutPrefix = avatarUrl.replace(supabaseStoragePrefix, "");
    const slashIdx = withoutPrefix.indexOf("/");
    if (slashIdx !== -1) {
      const bucket = withoutPrefix.substring(0, slashIdx);
      const path = withoutPrefix.substring(slashIdx + 1);
      await admin.storage.from(bucket).remove([path]);
    }
  }

  // --- 10. Hard-delete profiles row ---
  const { error: profileErr } = await admin
    .from("profiles")
    .delete()
    .eq("id", userId);
  if (profileErr) return { error: "Kon profiel niet verwijderen." };

  // --- 11. Delete auth.users record (requires admin/service role) ---
  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) return { error: "Kon account niet verwijderen." };

  // --- 12. Write deletion audit log (SHA-256 hash only — no PII) ---
  const userIdHash = createHash("sha256").update(userId).digest("hex");
  await admin.from("deletion_audit_log").insert({
    user_id_hash: userIdHash,
    auth_provider: authProvider,
  });

  // --- 13. Sign out and redirect ---
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?deleted=1");
}
