import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  Users,
  GraduationCap,
  Pencil,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { getCurrentUser } from "@/app/actions/auth";
import {
  getDivisionLabel,
  getProvinceLabel,
  getPositionLabel,
  CLASSIFIED_GENDERS,
  CLASSIFIED_TYPE_LABELS,
  CLASSIFIED_TYPE_COLORS,
  TRAINER_DIPLOMA_LABELS,
  classifiedLastDay,
  isClassifiedExpired,
} from "@/lib/classifieds-utils";
import { labelFor } from "@/lib/rumours";
import { ClassifiedDetailContact } from "@/components/classified-detail-contact";
import { VerifiedBadge } from "@/components/verified-badge";
import { ShareButton } from "@/components/share-button";
import { ReportDialog } from "@/components/report-dialog";

/** Profile fragment returned with classified (from Supabase relation). */
export interface ClassifiedProfile {
  username?: string | null;
  is_verified_source?: boolean;
}

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
      gender,
      trainer_diploma,
      created_at,
      user_id,
      is_active,
      expires_at,
      is_featured,
      featured_until,
      profiles(username, is_verified_source)
    `,
    )
    .eq("id", id)
    // RLS still shows removed ads to their author and staff (#69).
    .is("removed_at", null)
    .single();

  if (error || !data) return null;
  const profile: ClassifiedProfile | null = Array.isArray(data.profiles)
    ? ((data.profiles[0] as ClassifiedProfile) ?? null)
    : (data.profiles as ClassifiedProfile);
  return { ...data, profiles: profile } as Omit<typeof data, "profiles"> & {
    profiles: ClassifiedProfile | null;
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const classified = await getClassified(id);
  if (!classified?.is_active || isClassifiedExpired(classified.expires_at)) {
    return { title: "Zoekertje" };
  }
  return { title: `${classified.title || "Zoekertje"} | Zoekertjes` };
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
  const expired = isClassifiedExpired(classified.expires_at);
  // An ad marked "gevonden" or expired is gone for everyone but its owner
  // (#72, #84). RLS already hides it; staff still read it there.
  if ((!classified.is_active || expired) && !isOwn) notFound();
  const lastDay = classifiedLastDay(classified.expires_at);
  const title = classified.title || "Zoekertje";
  // Team ads use the team name as contact name, already shown below the title.
  const showContactName =
    classified.contact_name && classified.contact_name !== classified.team_name;
  const gender = labelFor(CLASSIFIED_GENDERS, classified.gender);
  const diploma = labelFor(TRAINER_DIPLOMA_LABELS, classified.trainer_diploma);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Button variant="ghost" asChild className="mb-6 -ml-2">
        <Link href="/zoekertjes" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Terug naar zoekertjes
        </Link>
      </Button>

      {isOwn && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <p>
            {expired
              ? `Je zoekertje is verlopen op ${lastDay} en staat niet meer in de lijst. Verleng het via Mijn zoekertjes.`
              : classified.is_active
                ? "Dit is jouw zoekertje."
                : "Je hebt dit zoekertje als gevonden gemarkeerd. Het staat niet meer in de lijst."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/zoekertjes/${classified.id}/bewerken`}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Bewerken
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/zoekertjes/mijn">Mijn zoekertjes</Link>
            </Button>
          </div>
        </div>
      )}

      <article className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${
                CLASSIFIED_TYPE_COLORS[classified.type] ??
                "bg-primary/20 text-primary border-primary/30"
              }`}
            >
              {CLASSIFIED_TYPE_LABELS[classified.type] ?? classified.type}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(classified.created_at), {
                addSuffix: true,
                locale: nl,
              })}
            </span>
            {!expired && (
              <span className="text-sm text-muted-foreground">
                · Online tot {lastDay}
              </span>
            )}
          </div>

          <header>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              {title}
            </h1>
            {classified.position && (
              <p className="text-lg font-semibold text-primary mt-1">
                {getPositionLabel(classified.position)}
              </p>
            )}
            {diploma && (
              <p className="text-lg font-semibold text-primary mt-1 flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                {classified.type === "team_seeks_trainer"
                  ? `Minimaal diploma: ${diploma}`
                  : `Diploma: ${diploma}`}
              </p>
            )}
            {classified.team_name && (
              <p className="text-foreground/80 mt-1">{classified.team_name}</p>
            )}
          </header>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {showContactName && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                Contact: {classified.contact_name}
              </span>
            )}
            {gender && (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {gender}
              </span>
            )}
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
                {classified.profiles?.username ?? "Onbekend"}
              </span>
              {classified.profiles?.is_verified_source && (
                <VerifiedBadge size="sm" />
              )}
            </p>
            <div className="flex items-center gap-2">
              {!isOwn && (
                <ClassifiedDetailContact
                  classifiedId={classified.id}
                  userId={classified.user_id}
                  userName={classified.profiles?.username ?? "deze gebruiker"}
                />
              )}
              <ShareButton
                title={title}
                shareText={`🏐 Bekijk dit zoekertje op VolleyRumours: ${title}`}
                url={`/zoekertjes/${classified.id}`}
                variant="outline"
                size="sm"
              />
              {!isOwn && (
                <ReportDialog
                  targetType="classified"
                  targetId={classified.id}
                />
              )}
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}
