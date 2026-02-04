import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { getCurrentUser } from "@/app/actions/auth";
import {
  getDivisionLabel,
  getProvinceLabel,
} from "@/lib/classifieds-utils";
import { ClassifiedDetailContact } from "@/components/classified-detail-contact";

const TYPE_LABELS: Record<string, string> = {
  player_seeks_team: "Speler zoekt team",
  team_seeks_player: "Team zoekt speler",
  trainer_seeks_team: "Trainer zoekt team",
  team_seeks_trainer: "Team zoekt trainer",
};

async function getClassified(id: string) {
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
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
  return { ...data, profiles: profile };
}

export default async function ClassifiedDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const classified = await getClassified(id);
  const user = await getCurrentUser();

  if (!classified) notFound();

  const isOwn = user?.id === classified.user_id;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Button variant="ghost" asChild className="mb-6 -ml-2">
        <Link href="/zoekertjes" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Terug naar zoekertjes
        </Link>
      </Button>

      <article className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-primary/20 text-primary border border-primary/30">
              {TYPE_LABELS[classified.type] ?? classified.type}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(classified.created_at), {
                addSuffix: true,
                locale: nl,
              })}
            </span>
          </div>

          <header>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              {classified.contact_name || classified.title || "Zoekertje"}
            </h1>
            {classified.position && (
              <p className="text-lg font-semibold text-primary mt-1">
                {classified.position}
              </p>
            )}
            {classified.team_name && (
              <p className="text-foreground/80 mt-1">{classified.team_name}</p>
            )}
          </header>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {classified.province && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {getProvinceLabel(classified.province)}
              </span>
            )}
            {classified.division && (
              <span className="font-medium text-foreground/80">
                {getDivisionLabel(classified.division)}
              </span>
            )}
          </div>

          {classified.description && (
            <div className="prose prose-neutral dark:prose-invert max-w-none">
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Beschrijving
              </h2>
              <p className="text-foreground/90 whitespace-pre-wrap">
                {classified.description}
              </p>
            </div>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Geplaatst door{" "}
              <span className="font-medium text-foreground">
                {(classified.profiles as { username?: string } | null)?.username ?? "Onbekend"}
              </span>
              {(classified.profiles as { trust_score?: number } | null)?.trust_score != null && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  • Trust {(classified.profiles as { trust_score: number }).trust_score}
                </span>
              )}
            </p>
            {!isOwn && (
              <ClassifiedDetailContact
                classifiedId={classified.id}
                userId={classified.user_id}
                userName={(classified.profiles as { username?: string } | null)?.username ?? "deze gebruiker"}
              />
            )}
          </footer>
        </div>
      </article>
    </div>
  );
}
