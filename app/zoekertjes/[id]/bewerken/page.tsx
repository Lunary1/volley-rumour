import { NO_INDEX } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isPersonAd } from "@/lib/classifieds-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ClassifiedForm,
  type ClassifiedFormValues,
} from "@/components/classified-form";

export const metadata: Metadata = {
  title: "Zoekertje bewerken",
  robots: NO_INDEX,
};

export default async function EditClassifiedPage({
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
  if (!user) redirect(`/auth/login?next=/zoekertjes/${id}/bewerken`);

  // Only the owner edits, and not once a moderator removed the ad (#72).
  const { data: ad } = await supabase
    .from("classifieds")
    .select(
      "id, type, contact_name, team_name, gender, division, position, trainer_diploma, province, description",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!ad) notFound();

  // A person's ad stores "Voornaam Naam" in contact_name and their club in
  // team_name; a team's stores the team in both.
  const values: ClassifiedFormValues = {
    id: ad.id,
    type: ad.type,
    gender: ad.gender ?? undefined,
    division: ad.division ?? undefined,
    position: ad.position ?? undefined,
    diploma: ad.trainer_diploma ?? undefined,
    province: ad.province ?? undefined,
    description: ad.description ?? undefined,
  };
  if (isPersonAd(ad.type)) {
    const [firstName, ...rest] = ad.contact_name.trim().split(/\s+/);
    values.firstName = firstName;
    values.lastName = rest.join(" ");
    values.club = ad.team_name ?? undefined;
  } else {
    values.teamName = ad.team_name ?? ad.contact_name;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/zoekertjes/mijn"
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Terug naar mijn zoekertjes
      </Link>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Zoekertje bewerken</CardTitle>
          <CardDescription>Je wijzigingen staan meteen online.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClassifiedForm classified={values} />
        </CardContent>
      </Card>
    </div>
  );
}
