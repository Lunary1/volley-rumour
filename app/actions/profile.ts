"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { SUSPENDED_ERROR_CODE, SUSPENDED_MESSAGE } from "@/lib/sanctions";
import { PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE } from "@/lib/schemas";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je moet ingelogd zijn" };
  }

  const username = formData.get("username") as string;
  const avatarUrl = formData.get("avatar_url") as string;

  if (!username || username.length < 2) {
    return { error: "Gebruikersnaam moet minimaal 2 tekens zijn" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username: username.trim(),
      avatar_url: avatarUrl || null,
    })
    .eq("id", user.id);

  if (error) {
    // Suspended users can't edit their profile (#80).
    if (error.code === SUSPENDED_ERROR_CODE)
      return { error: SUSPENDED_MESSAGE };
    return { error: "Kon profiel niet bijwerken" };
  }

  revalidatePath("/profile");
  return { success: true };
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
