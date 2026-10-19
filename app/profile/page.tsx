import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRecentActivity } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { ProfileView } from "./profile-view";
import type { BlockedUser } from "./blocked-users-card";
import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Profiel", robots: NO_INDEX };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Je bent niet ingelogd</p>
          <Link href="/auth/login">
            <Button>Inloggen</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, username, avatar_path, rumours_confirmed, rumours_denied, is_verified_source, instagram_url, source_description",
    )
    .eq("id", user.id)
    .single();

  // Logged in, but the profile didn't load: say so instead of asking the
  // user to log in again (#149).
  if (!profile) {
    console.error("Error fetching profile:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">
            Je profiel kon niet geladen worden.
          </p>
          <Link href="/profile">
            <Button variant="outline">Opnieuw proberen</Button>
          </Link>
        </div>
      </div>
    );
  }

  const [rumours, votes, classifieds, recentActivity, blocks, optOut] =
    await Promise.all([
      supabase
        .from("rumours")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", user.id),
      supabase
        .from("rumour_votes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("classifieds")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      getRecentActivity(),
      // Users I blocked (#73), newest first.
      supabase
        .from("blocked_users")
        .select(
          "blocked_id, created_at, blocked:profiles!blocked_users_blocked_id_fkey(username)",
        )
        .eq("blocker_id", user.id)
        .order("created_at", { ascending: false }),
      // A row means email notifications are off (#98).
      supabase
        .from("email_opt_outs")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const blockedUsers: BlockedUser[] = (blocks.data ?? []).map((block) => {
    // Many-to-one, so one profile; without generated types the client
    // types it as a list.
    const blocked = block.blocked as unknown as { username: string } | null;
    return {
      id: block.blocked_id,
      username: blocked?.username ?? "Gebruiker",
      blockedAt: block.created_at,
    };
  });

  return (
    <ProfileView
      initialProfile={profile}
      stats={{
        rumourCount: rumours.count || 0,
        voteCount: votes.count || 0,
        classifiedCount: classifieds.count || 0,
      }}
      recentActivity={recentActivity}
      blockedUsers={blockedUsers}
      emailNotifications={!optOut.data}
    />
  );
}
