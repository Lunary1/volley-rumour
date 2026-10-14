import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRecentActivity } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { ProfileView } from "./profile-view";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).single()
    : { data: null };

  if (!user || !profile) {
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

  const [rumours, votes, confirmed, classifieds, recentActivity] =
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
        .from("rumours")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", user.id)
        .eq("status", "confirmed"),
      supabase
        .from("classifieds")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      getRecentActivity(),
    ]);

  return (
    <ProfileView
      initialProfile={profile}
      stats={{
        rumourCount: rumours.count || 0,
        voteCount: votes.count || 0,
        confirmedCount: confirmed.count || 0,
        classifiedCount: classifieds.count || 0,
      }}
      recentActivity={recentActivity}
    />
  );
}
