import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NO_INDEX } from "@/lib/seo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RumourForm, type RumourFormValues } from "@/components/rumour-form";

export const metadata: Metadata = {
  title: "Gerucht bewerken",
  robots: NO_INDEX,
};

export default async function EditRumourPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged-out visitors log in and come back here.
  if (!user) redirect(`/auth/login?next=/geruchten/${id}/bewerken`);

  // Only the author, and only while the rumour is pending (#192, D-042). The
  // UPDATE policy enforces the same.
  const { data: rumour, error } = await supabase
    .from("rumours")
    .select(
      "id, category, player_name, gender, from_club_name, from_division, to_club_name, to_division, description, source_type, source_url",
    )
    .eq("id", id)
    .eq("creator_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  // 22P02: the id isn't a uuid.
  if (error && error.code !== "22P02") {
    console.error("Error fetching rumour:", error);
  }
  if (!rumour) notFound();

  // The form stores "Voornaam Achternaam" in player_name.
  const [firstName, ...rest] = rumour.player_name.trim().split(/\s+/);
  const values: RumourFormValues = {
    id: rumour.id,
    category: rumour.category,
    firstName,
    lastName: rest.join(" "),
    gender: rumour.gender ?? undefined,
    currentClub: rumour.from_club_name ?? "",
    currentDivision: rumour.from_division ?? undefined,
    destinationClub: rumour.to_club_name ?? undefined,
    destinationDivision: rumour.to_division ?? undefined,
    description: rumour.description ?? undefined,
    sourceType: rumour.source_type ?? undefined,
    sourceUrl: rumour.source_url ?? undefined,
  };

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/profile"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar mijn profiel
        </Link>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-2xl gradient-text-neon">
              Gerucht bewerken
            </CardTitle>
            <CardDescription>
              Je gerucht wacht nog op een moderator. Je kan het aanpassen tot
              het nagekeken is.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RumourForm rumour={values} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
