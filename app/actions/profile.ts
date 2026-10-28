"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { SUSPENDED_ERROR_CODE, SUSPENDED_MESSAGE } from "@/lib/sanctions";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_MESSAGE,
  signUpSchema,
} from "@/lib/schemas";
import sharp from "sharp";
import {
  AVATAR_ACCEPTED_TYPES,
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  AVATAR_SIZE_MESSAGE,
  AVATAR_TYPE_MESSAGE,
  avatarUrl,
} from "@/lib/avatar";
import {
  errorResponse,
  extractErrorMessage,
  successResponse,
  type ActionResponse,
} from "@/lib/response";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je moet ingelogd zijn" };
  }

  // The same rules as at sign-up; the database caps it at 30 (GHSA-fjw6).
  const parsed = signUpSchema.shape.username.safeParse(
    formData.get("username") ?? "",
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("profiles")
    .update({ username: parsed.data })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505")
      return { error: "Deze gebruikersnaam bestaat al. Kies een andere." };
    // Suspended users can't edit their profile (#80).
    if (error.code === SUSPENDED_ERROR_CODE)
      return { error: SUSPENDED_MESSAGE };
    return { error: "Kon profiel niet bijwerken" };
  }

  revalidatePath("/profile");
  return { success: true, username: parsed.data };
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je moet ingelogd zijn" };
  }

  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return { error: PASSWORD_MIN_MESSAGE };
  }

  // Try to sign in with current email and password to verify
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email || "",
    password: currentPassword,
  });

  if (signInError) {
    return { error: "Huidig wachtwoord is onjuist" };
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: "Kon wachtwoord niet bijwerken" };
  }

  return { success: true };
}

export type RecentRumour = {
  id: string;
  player_name: string;
  status: string;
  created_at: string;
  // Set when a moderator rejected the rumour (#66); only the author sees it.
  rejection_reason: string | null;
  rejection_note: string | null;
  // A moderator's note when they removed it after a report (#69).
  removal_note: string | null;
};

export type RecentClassified = {
  id: string;
  title: string;
  type: string;
  created_at: string;
  // Set when a moderator removed it after a report (#69); only the author
  // and staff can still read the row.
  removed_at: string | null;
  removal_note: string | null;
};

export async function getRecentActivity(): Promise<{
  rumours: RecentRumour[];
  classifieds: RecentClassified[];
} | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [rumoursRes, classifiedsRes] = await Promise.all([
    supabase
      .from("rumours")
      .select(
        "id, player_name, status, created_at, rejection_reason, rejection_note, removal_note",
      )
      .eq("creator_id", user.id)
      // All of them, with their status (J-10, #88)
      .order("created_at", { ascending: false }),
    supabase
      .from("classifieds")
      .select("id, title, type, created_at, removed_at, removal_note")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    rumours: rumoursRes.data || [],
    classifieds: classifiedsRes.data || [],
  };
}

/**
 * Uploads a new profile picture (#92). The picture is re-encoded to a
 * 400x400 WebP, which also drops its metadata (camera, location), and stored
 * in the user's own folder under a new name, so browsers never show a stale
 * cached one. The old file is removed afterwards.
 */
export async function uploadAvatar(
  formData: FormData,
): Promise<ActionResponse<{ avatarUrl: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("Je moet ingelogd zijn");

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return errorResponse(AVATAR_TYPE_MESSAGE);
  }
  if (file.size > AVATAR_MAX_BYTES) return errorResponse(AVATAR_SIZE_MESSAGE);
  if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
    return errorResponse(AVATAR_TYPE_MESSAGE);
  }

  // The browser's type is only a claim; sharp reads the actual file.
  let picture: Buffer;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()));
    const { format } = await image.metadata();
    if (!format || !["jpeg", "png", "webp"].includes(format)) {
      return errorResponse(AVATAR_TYPE_MESSAGE);
    }
    picture = await image
      .rotate() // apply the EXIF orientation before the metadata goes
      .resize(400, 400, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return errorResponse("Deze foto kon niet gelezen worden. Kies een andere.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();

  const path = `${user.id}/${crypto.randomUUID()}.webp`;
  const bucket = supabase.storage.from(AVATAR_BUCKET);
  const { error: uploadError } = await bucket.upload(path, picture, {
    contentType: "image/webp",
    cacheControl: "31536000",
  });
  if (uploadError) {
    return errorResponse(
      "Je foto kon niet opgeslagen worden. Probeer het opnieuw.",
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", user.id);
  if (error) {
    // Suspended users can't change their profile (#80); nothing links to
    // the new file, so it goes.
    await bucket.remove([path]);
    return errorResponse(
      extractErrorMessage(error, "Je profielfoto kon niet bijgewerkt worden."),
    );
  }

  if (profile?.avatar_path) await bucket.remove([profile.avatar_path]);

  revalidatePath("/", "layout");
  return successResponse({ avatarUrl: avatarUrl(path)! });
}

/** Removes the profile picture; the initials show again. */
export async function removeAvatar(): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("Je moet ingelogd zijn");

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();
  if (!profile?.avatar_path) return successResponse(undefined);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", user.id);
  if (error) {
    return errorResponse(
      extractErrorMessage(error, "Je profielfoto kon niet verwijderd worden."),
    );
  }

  await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_path]);

  revalidatePath("/", "layout");
  return successResponse(undefined);
}

/**
 * Turns email notifications on or off (#98, D-025). On is the default; off
 * is a row in email_opt_outs. Suspended users may change it too.
 */
export async function setEmailNotifications(
  enabled: boolean,
): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("Je moet ingelogd zijn");

  const { error } = enabled
    ? await supabase.from("email_opt_outs").delete().eq("user_id", user.id)
    : await supabase
        .from("email_opt_outs")
        .upsert({ user_id: user.id }, { ignoreDuplicates: true });
  if (error) {
    return errorResponse(
      extractErrorMessage(error, "Je instelling kon niet bewaard worden."),
    );
  }

  revalidatePath("/profile");
  return successResponse(undefined);
}
