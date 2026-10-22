import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Initials } from "@/components/ui/initials";
import { VerifiedBadge } from "@/components/verified-badge";
import { RelativeTime } from "@/components/relative-time";
import { ClassifiedContactButton } from "@/components/classified-contact-button";
import { ClassifiedTypeLabel } from "@/components/classified-type-label";
import { labelFor } from "@/lib/rumours";
import {
  getDivisionLabel,
  getPositionLabel,
  getProvinceLabel,
  TRAINER_DIPLOMA_LABELS,
} from "@/lib/classifieds-utils";
import { cn } from "@/lib/utils";

// A zoekertje in the list (#207): a standard card, or the larger featured
// one. The body links to the ad; the contact button sits outside the link.

export interface ClassifiedCardData {
  id: string;
  title: string;
  type: string;
  description: string | null;
  province: string | null;
  position: string | null;
  trainer_diploma?: string | null;
  team_name: string | null;
  contact_name: string | null;
  division: string | null;
  created_at: string;
  user_id: string;
  is_featured?: boolean;
  featured_until?: string | null;
  profiles?: {
    username: string;
    is_verified_source?: boolean;
  } | null;
}

/** Who posted the ad, as "contact · team", without repeating a name. */
function posterLine(classified: ClassifiedCardData): string {
  const names = [classified.contact_name, classified.team_name]
    .map((name) => name?.trim())
    .filter((name): name is string => !!name);
  return [...new Set(names)].join(" · ");
}

/** The name in a card's footer: the poster, else the account. */
function posterName(classified: ClassifiedCardData): string {
  return posterLine(classified) || classified.profiles?.username || "Onbekend";
}

/** "Setter · Nationale 1 Heren", or the diploma for trainer ads. */
function metaLine(classified: ClassifiedCardData): string {
  const what =
    getPositionLabel(classified.position) ||
    labelFor(TRAINER_DIPLOMA_LABELS, classified.trainer_diploma) ||
    "";
  return [what, getDivisionLabel(classified.division)]
    .filter(Boolean)
    .join(" · ");
}

/** Who the contact form addresses. */
function contactName(classified: ClassifiedCardData): string {
  return classified.profiles?.username || "deze gebruiker";
}

function Province({
  classified,
  className,
}: {
  classified: ClassifiedCardData;
  className?: string;
}) {
  if (!classified.province) return null;
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-muted-foreground",
        className,
      )}
    >
      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {getProvinceLabel(classified.province)}
    </p>
  );
}

const TITLE_HOVER =
  "wrap-anywhere line-clamp-3 text-foreground underline-offset-3 group-hover:text-primary-text group-hover:underline";

export function ClassifiedCard({
  classified,
  featured = false,
  isOwn,
}: {
  classified: ClassifiedCardData;
  featured?: boolean;
  isOwn: boolean;
}) {
  const name = posterName(classified);
  const meta = metaLine(classified);
  const contact = !isOwn && (
    <ClassifiedContactButton
      classifiedId={classified.id}
      userId={classified.user_id}
      userName={contactName(classified)}
      featured={featured}
    />
  );

  if (featured) {
    return (
      <article className="group flex flex-col gap-4 rounded-2xl border border-feature-border bg-feature-bg p-6 md:p-7">
        <Link
          href={`/zoekertjes/${classified.id}`}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="soft" size="pill">
              <Star className="fill-current" aria-hidden />
              Aanbevolen
            </Badge>
            <ClassifiedTypeLabel type={classified.type} />
          </div>
          <div className="space-y-1.5">
            <h3
              className={cn(
                "text-2xl leading-tight font-bold tracking-tight",
                TITLE_HOVER,
              )}
            >
              {classified.title}
            </h3>
            {meta && (
              <p className="text-md font-medium text-secondary-foreground">
                {meta}
              </p>
            )}
          </div>
          {classified.description && (
            <p className="text-md text-secondary-foreground wrap-anywhere line-clamp-2">
              {classified.description}
            </p>
          )}
          <Province classified={classified} className="text-sm" />
        </Link>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-feature-border pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Initials name={name} size="md" />
            <div className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                <span className="truncate">{name}</span>
                {classified.profiles?.is_verified_source && (
                  <VerifiedBadge size="md" />
                )}
              </span>
              <span className="text-meta text-muted-foreground">
                <RelativeTime date={classified.created_at} />
              </span>
            </div>
          </div>
          {contact}
        </div>
      </article>
    );
  }

  return (
    <article className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-strong">
      <Link
        href={`/zoekertjes/${classified.id}`}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-2">
          <ClassifiedTypeLabel type={classified.type} />
          <span className="min-w-0 truncate text-meta text-muted-foreground">
            <RelativeTime date={classified.created_at} />
          </span>
        </div>
        <div className="space-y-1">
          <h3
            className={cn(
              "text-card-title font-semibold tracking-tight",
              TITLE_HOVER,
            )}
          >
            {classified.title}
          </h3>
          {meta && <p className="text-sm text-secondary-foreground">{meta}</p>}
        </div>
        <Province classified={classified} className="text-meta" />
      </Link>

      <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-border pt-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <Initials name={name} size="sm" />
          <span className="flex min-w-0 items-center gap-1 text-sm font-medium text-secondary-foreground">
            <span className="truncate">{name}</span>
            {classified.profiles?.is_verified_source && (
              <VerifiedBadge size="sm" />
            )}
          </span>
        </div>
        {contact}
      </div>
    </article>
  );
}
