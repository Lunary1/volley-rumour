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
    return { error: "Huidiig wachtwoord is onjuist" };
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

export async function getProfileStats() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  // Count user's rumours
  const { count: rumourCount } = await supabase
    .from("rumours")
    .select("id", { count: "exact" })
    .eq("creator_id", user.id);

  // Count user's votes
  const { count: voteCount } = await supabase
    .from("rumour_votes")
    .select("id", { count: "exact" })
    .eq("user_id", user.id);

  // Count confirmed rumours
  const { count: confirmedCount } = await supabase
    .from("rumours")
    .select("id", { count: "exact" })
    .eq("creator_id", user.id)
    .eq("status", "confirmed");

  // Count classifieds posted
  const { count: classifiedCount } = await supabase
    .from("classifieds")
    .select("id", { count: "exact" })
    .eq("author_id", user.id);

  return {
    profile,
    stats: {
      rumourCount: rumourCount || 0,
      voteCount: voteCount || 0,
      confirmedCount: confirmedCount || 0,
      classifiedCount: classifiedCount || 0,
    },
  };
}
