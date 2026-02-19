"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function login(email: string, password: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
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
