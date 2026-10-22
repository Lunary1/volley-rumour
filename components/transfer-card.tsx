import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { ArrowRight, Calendar, ExternalLink, UserCircle } from "lucide-react";
import { ShareButton } from "@/components/share-button";
import { CATEGORY_BADGE_VARIANTS } from "@/lib/category-badges";
import { formatDate } from "@/lib/dates";
import {
  TRANSFER_CATEGORIES,
  isRetirement,
  type TransferCategory,
} from "@/lib/transfers";

/** The transfer columns the card shows. */
export const TRANSFER_CARD_COLUMNS =
  "id, player_name, from_club, to_club, category, confirmed_at, source_url";

export interface TransferCardData {
  id: string;
  player_name: string;
  from_club: string | null;
  to_club: string | null;
  category: string;
  confirmed_at: string | null;
  source_url: string | null;
}

const categoryVariants: Record<TransferCategory, BadgeVariant> = {
  player_male: CATEGORY_BADGE_VARIANTS.player,
  player_female: CATEGORY_BADGE_VARIANTS.player,
  trainer_male: CATEGORY_BADGE_VARIANTS.trainer,
  trainer_female: CATEGORY_BADGE_VARIANTS.trainer,
  player_retirement: CATEGORY_BADGE_VARIANTS.retirement,
  trainer_retirement: CATEGORY_BADGE_VARIANTS.retirement,
};

/**
 * A confirmed transfer (#70, #82). No contact button: messaging is for
 * zoekertjes only (D-004).
 */
export function TransferCard({
  transfer,
  share = false,
}: {
  transfer: TransferCardData;
  /** Show a share button, as on /transfers. */
  share?: boolean;
}) {
  const category = transfer.category as TransferCategory;
  const retirement = isRetirement(transfer.category);
  const typeVariant =
    categoryVariants[category] ?? CATEGORY_BADGE_VARIANTS.retirement;
  const typeLabel = TRANSFER_CATEGORIES[category] ?? "Transfer";

  return (
    <Card className="bg-card border-border hover:border-border-strong transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <Badge variant={typeVariant}>{typeLabel}</Badge>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <UserCircle className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-balance">{transfer.player_name}</h3>
        </div>

        <div className="flex items-center gap-2 text-sm mb-3">
          {retirement ? (
            <>
              {transfer.from_club && (
                <>
                  <span className="text-muted-foreground">
                    {transfer.from_club}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </>
              )}
              <span className="text-foreground font-bold uppercase">Stopt</span>
            </>
          ) : (
            <>
              {transfer.from_club ? (
                <>
                  <span className="text-muted-foreground">
                    {transfer.from_club}
                  </span>
                  <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                </>
              ) : (
                <span className="text-muted-foreground italic">Nieuw</span>
              )}
              <span className="text-foreground font-medium">
                {transfer.to_club}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            {transfer.confirmed_at
              ? `Bevestigd op ${formatDate(transfer.confirmed_at, "d MMMM yyyy")}`
              : "Datum onbekend"}
          </span>
          {transfer.source_url && (
            <a
              href={transfer.source_url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="flex items-center gap-1 text-primary underline underline-offset-2"
            >
              Officiële bron
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>

        {share && (
          <div className="mt-4">
            <ShareButton
              title={`${transfer.player_name} — ${transfer.from_club ? `${transfer.from_club} ➜ ` : ""}${retirement ? "stopt" : transfer.to_club}`}
              shareText={
                retirement
                  ? `🏐 Bevestigd: ${transfer.player_name} stopt${transfer.from_club ? ` bij ${transfer.from_club}` : ""}. Bekijk het op VolleyRumours!`
                  : `🏐 Transfer bevestigd: ${transfer.player_name} ${transfer.from_club ? `van ${transfer.from_club} naar ${transfer.to_club}` : `naar ${transfer.to_club}`}. Bekijk het op VolleyRumours!`
              }
              url="/transfers"
              variant="outline"
              size="sm"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
