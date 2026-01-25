"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useCurrentUserName(): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    async function getCurrentUserName() {
      const supabase = createClient();

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setName(null);
          return;
        }

        // Try to get username from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();

        if (profile?.username) {
          setName(profile.username);
          return;
        }

        // Fall back to user_metadata name from OAuth providers
        if (user.user_metadata?.name) {
          setName(user.user_metadata.name);
          return;
        }

        // Fall back to email if nothing else
        if (user.email) {
          setName(user.email.split("@")[0]);
          return;
        }

        setName(null);
      } catch (error) {
        console.error("Error fetching user name:", error);
        setName(null);
      }
    }

    getCurrentUserName();
  }, []);

  return name;
}
