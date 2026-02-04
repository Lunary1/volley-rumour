import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/app/actions/auth";
import { ClassifiedsList } from "@/components/classifieds-list";

async function getClassifieds() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classifieds")
    .select(
      `
      id,
      title,
      type,
      description,
      province,
      position,
      team_name,
      contact_name,
      division,
      created_at,
      user_id,
      is_featured,
      featured_until,
      profiles(username, trust_score)
    `,
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching classifieds:", error);
  }

  const rows = data ?? [];
  return rows.map((row: (typeof rows)[0]) => ({
    ...row,
    profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
  }));
}

export default async function ZoekertjesPage() {
  const user = await getCurrentUser();
  const classifieds = await getClassifieds();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Zoekertjes
          </h1>
          <p className="text-muted-foreground">
            Spelers, trainers en clubs op zoek naar nieuwe uitdagingen
          </p>
        </div>
        <Button
          asChild
          className="mt-4 md:mt-0 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Link href="/zoekertjes/nieuw">
            <Plus className="mr-2 h-4 w-4" />
            Plaats zoekertje
          </Link>
        </Button>
      </div>

      <ClassifiedsList classifieds={classifieds} currentUserId={user?.id} />
    </div>
  );
}
