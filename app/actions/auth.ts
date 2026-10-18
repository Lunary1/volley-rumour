"use server";

import { cache } from "react";
import { AVATAR_BUCKET, avatarUrl } from "@/lib/avatar";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { isRecoverySession } from "@/lib/supabase/recovery";
import { safeNextPath } from "@/lib/utils";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_MESSAGE,
  signUpSchema,
  type SignUpField,
} from "@/lib/schemas";
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

  const { error } = await supabase.auth.signInWithPassword({
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

export type SignUpResult =
  | { success: true; data: { confirmEmail: boolean } }
  | { success: false; error: string; field?: SignUpField };

const USERNAME_TAKEN = "Deze gebruikersnaam bestaat al. Kies een andere.";

async function usernameTaken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  username: string,
) {
  // Case-insensitive, like the sign-up trigger; `_` is a LIKE wildcard.
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username.replaceAll("_", "\\_"))
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * #89 – Email sign-up. Validates with Dutch messages, refuses a taken
 * username (the sign-up trigger refuses it too, VR012), and sends the
 * confirmation link through /auth/callback so it lands on `next`.
 *
 * An address that is already registered gets the same "check your email"
 * answer as a new one, so the form can't be used to find out who has an
 * account. With "Confirm email" on, Supabase sends no email in that case.
 */
export async function signUp(
  _previous: SignUpResult | null,
  formData: FormData,
): Promise<SignUpResult> {
  if (
    formData.get("ageConfirmed") !== "on" ||
    formData.get("termsAccepted") !== "on"
  ) {
    return {
      success: false,
      error:
        "Bevestig dat je 16 jaar of ouder bent en aanvaard de voorwaarden.",
    };
  }

  const parsed = signUpSchema.safeParse({
    username: formData.get("username") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      error: issue.message,
      field: issue.path[0] as SignUpField,
    };
  }
  const { username, email, password } = parsed.data;

  const supabase = await createClient();
  if (await usernameTaken(supabase, username)) {
    return { success: false, error: USERNAME_TAKEN, field: "username" };
  }

  const origin = (await headers()).get("origin") || "";
  const next = safeNextPath(formData.get("next")?.toString());
  const callback = new URLSearchParams({ flow: "signup" });
  if (next !== "/") callback.set("next", next);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?${callback}`,
      // The sign-up trigger records the acceptance with the current terms
      // version (#75).
      data: { username, age_confirmed: true, terms_accepted: true },
    },
  });

  if (error) {
    switch (error.code) {
      case "user_already_exists":
      case "email_exists":
        // Only without "Confirm email"; see above.
        return successResponse({ confirmEmail: true });
      case "weak_password":
        return {
          success: false,
          error: PASSWORD_MIN_MESSAGE,
          field: "password",
        };
      case "email_address_invalid":
        return {
          success: false,
          error: "Vul een geldig e-mailadres in",
          field: "email",
        };
      case "signup_disabled":
      case "email_provider_disabled":
        return {
          success: false,
          error: "Registreren is op dit moment niet mogelijk.",
        };
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return {
          success: false,
          error: "Te veel pogingen. Probeer het over een uur opnieuw.",
        };
    }
    // The trigger refusing a username taken in the meantime shows up as a
    // generic database error.
    if (await usernameTaken(supabase, username)) {
      return { success: false, error: USERNAME_TAKEN, field: "username" };
    }
    return {
      success: false,
      error: "Registreren is mislukt. Probeer het later opnieuw.",
    };
  }

  // Without "Confirm email" the user is logged in straight away.
  if (data.session) revalidatePath("/", "layout");
  return successResponse({ confirmEmail: !data.session });
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

  // Get user profile for additional info. Roles aren't readable through the
  // API (#111); is_staff() answers for the caller only. RLS shows a user only
  // their own suspension (#80).
  const [{ data: profile }, { data: isStaff }, { data: suspension }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("username, avatar_path")
        .eq("id", user.id)
        .single(),
      supabase.rpc("is_staff"),
      supabase
        .from("user_suspensions")
        .select("suspended_until, reason")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const suspended =
    suspension !== null &&
    (suspension.suspended_until === null ||
      new Date(suspension.suspended_until) > new Date());

  const userData = {
    id: user.id,
    email: user.email,
    username: profile?.username,
    avatar_url: avatarUrl(profile?.avatar_path),
    // Only shows the "Beheer" link; admin pages check is_staff() themselves.
    is_staff: isStaff === true,
    // Shown as a notice on every page; the database refuses their writes.
    suspension: suspended
      ? {
          until: suspension.suspended_until as string | null,
          reason: suspension.reason as string,
        }
      : null,
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
    password: z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE),
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

export async function signInWithGoogle(next?: string) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") || "";
  // /auth/callback sends the user on to `next` (#67).
  const target = safeNextPath(next);
  const callbackUrl =
    target === "/"
      ? `${origin}/auth/callback`
      : `${origin}/auth/callback?next=${encodeURIComponent(target)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
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
 * #75 (D-003) – Records that the logged-in user is 16 or older and accepts the
 * current terms, from /welkom, then sends them on to `next`. The database
 * stores the version and the time.
 */
export async function acceptTerms(
  _previous: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("Je moet ingelogd zijn");

  if (
    formData.get("ageConfirmed") !== "on" ||
    formData.get("termsAccepted") !== "on"
  ) {
    return errorResponse(
      "Bevestig dat je 16 jaar of ouder bent en aanvaard de voorwaarden.",
    );
  }

  const { error } = await supabase.rpc("accept_terms");
  if (error) {
    return errorResponse("Er ging iets mis. Probeer het opnieuw.");
  }

  revalidatePath("/", "layout");
  redirect(safeNextPath(formData.get("next")?.toString()));
}

/**
 * Permanently deletes the logged-in user's account (J-11, #76).
 *
 * `delete_own_account()` does it in one transaction, so it all happens or
 * nothing does: the account, profile, zoekertjes (D-021), votes, blocks,
 * conversations and unpublished rumours go; published rumours and reports stay
 * without the user; a hashed entry goes in the deletion log.
 */
export async function deleteAccount(): Promise<ActionResponse> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Je bent niet ingelogd.");
  }

  const { data: avatarPath, error } = await supabase.rpc("delete_own_account");
  if (error) {
    return errorResponse(
      "Je account kon niet verwijderd worden. Er is niets gewist; probeer het later opnieuw.",
    );
  }

  // A file in Storage isn't a row, so it goes after the account. If this
  // fails, nothing links to the file any more. The user is gone, so the
  // admin client removes it.
  if (typeof avatarPath === "string" && avatarPath) {
    await createAdminClient().storage.from(AVATAR_BUCKET).remove([avatarPath]);
  }

  // The user and their sessions are gone; only the cookies are left to clear.
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  return successResponse(undefined);
}
