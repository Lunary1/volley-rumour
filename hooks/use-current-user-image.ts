"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useCurrentUserImage(): string | null {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    async function getCurrentUserImage() {
      const supabase = createClient();

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setImage(null);
          return;
        }

        // Try to get avatar_url from profile first
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", user.id)
          .single();

        if (profile?.avatar_url) {
          setImage(profile.avatar_url);
          return;
        }

        // Fall back to user_metadata if available (from OAuth providers)
        if (user.user_metadata?.avatar_url) {
          setImage(user.user_metadata.avatar_url);
          return;
        }

        setImage(null);
      } catch (error) {
        console.error("Error fetching user image:", error);
        setImage(null);
      }
    }

    getCurrentUserImage();
  }, []);

  return image;
}
