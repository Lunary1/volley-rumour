import { format, formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  RUMOUR_CATEGORY_LABELS,
  RUMOUR_SOURCE_TYPES,
  RUMOUR_STATUS_LABELS,
  labelFor,
  type RumourStatus,
} from "@/lib/rumours";

// Pieces the takedown and report cards in /admin/meldingen share.

export interface RumourSummaryRow {
  player_name: string;
  category: string;
  from_club_name: string | null;
  to_club_name: string | null;
  description: string | null;
  source_type: string | null;
  source_url: string | null;
  status: string;
  creator: { username: string } | null;
}

export const RUMOUR_SUMMARY_COLUMNS =
  "player_name, category, from_club_name, to_club_name, description, source_type, source_url, status, creator:creator_id(username)";

/** A relative time with the exact time on hover. */
export function When({ date }: { date: string }) {
  return (
    <span title={format(new Date(date), "d MMM yyyy HH:mm", { locale: nl })}>
      {formatDistanceToNow(new Date(date), { addSuffix: true, locale: nl })}
    </span>
  );
}

/** The rumour a request or report is about, as the moderator needs it. */
export function RumourSummary({ rumour }: { rumour: RumourSummaryRow }) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {RUMOUR_CATEGORY_LABELS[rumour.category] ?? rumour.category}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {RUMOUR_STATUS_LABELS[rumour.status as RumourStatus] ?? rumour.status}{" "}
          · door {rumour.creator?.username ?? "een verwijderd account"}
        </span>
      </div>
      {(rumour.from_club_name || rumour.to_club_name) && (
        <p className="flex flex-wrap items-center gap-1.5">
          {rumour.from_club_name && <span>{rumour.from_club_name}</span>}
          {rumour.from_club_name && rumour.to_club_name && (
            <ArrowRight
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-label="naar"
            />
          )}
          {rumour.to_club_name && <span>{rumour.to_club_name}</span>}
        </p>
      )}
      <p className="text-muted-foreground">
        Bron:{" "}
        {labelFor(RUMOUR_SOURCE_TYPES, rumour.source_type) ??
          "Geen bron opgegeven"}
        {rumour.source_url && (
          <>
            {" · "}
            <a
              href={rumour.source_url}
              target="_blank"
              rel="nofollow ugc noopener noreferrer"
              className="break-all text-primary underline underline-offset-2"
            >
              {rumour.source_url}
            </a>
          </>
        )}
      </p>
      {rumour.description && (
        <p className="whitespace-pre-line text-muted-foreground">
          {rumour.description}
        </p>
      )}
    </div>
  );
}
