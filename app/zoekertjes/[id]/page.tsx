import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { getCurrentUser } from "@/app/actions/auth";
import {
  getDivisionLabel,
  getProvinceLabel,
  CLASSIFIED_TYPE_LABELS,
  CLASSIFIED_TYPE_COLORS,
} from "@/lib/classifieds-utils";
import { ClassifiedDetailContact } from "@/components/classified-detail-contact";
import { VerifiedBadge } from "@/components/verified-badge";
import { ShareButton } from "@/components/share-button";

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
      created_at,
      user_id,
      is_featured,
      featured_until,
      profiles(username, is_verified_source)
    `,
    )
    .eq("id", id)
    .eq("is_active", true)
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
  if (!classified) return { title: "Zoekertje" };
  const title = classified.contact_name || classified.title || "Zoekertje";
  return { title: `${title} | Zoekertjes` };
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
                title={classified.contact_name || classified.title || "Zoekertje"}
                url={`/zoekertjes/${classified.id}`}
                variant="outline"
                size="sm"
              />
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}
