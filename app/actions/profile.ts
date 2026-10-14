"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

  if (newPassword.length < 8) {
    return { error: "Wachtwoord moet minimaal 8 tekens zijn" };
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
};

export type RecentClassified = {
  id: string;
  title: string;
  type: string;
  created_at: string;
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
      .select("id, player_name, status, created_at")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("classifieds")
      .select("id, title, type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    rumours: rumoursRes.data || [],
    classifieds: classifiedsRes.data || [],
  };
}
