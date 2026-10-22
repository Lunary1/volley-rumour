import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import { RUMOUR_DIVISIONS, labelFor, type RumourDivision } from "@/lib/rumours";
import {
  TRANSFER_CATEGORIES,
  isRetirement,
  type TransferCategory,
} from "@/lib/transfers";
import { AddTransfer, TransferItemActions } from "./transfer-item";

// Staff add, correct and remove confirmed transfers (#70, J-14). Transfers
// from a confirmed rumour show up here too. The admin layout already let only
// staff through; the database functions check again and log every change.

const PAGE_SIZE = 100;

interface Transfer {
  id: string;
  player_name: string;
  category: string;
  from_club: string | null;
  to_club: string | null;
  division: string | null;
  source_url: string | null;
  source_rumour_id: string | null;
  confirmed_at: string | null;
}

export default async function AdminTransfersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transfers")
    .select(
      "id, player_name, category, from_club, to_club, division, source_url, source_rumour_id, confirmed_at",
    )
    .order("confirmed_at", { ascending: false })
    .limit(PAGE_SIZE);
  const transfers = (data ?? []) as Transfer[];
  const today = formatDate(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Transfers</h2>
        <p className="text-sm text-muted-foreground">
          Bevestigde transfers, nieuwste eerst. Voeg een officieel aangekondigde
          transfer toe, of pas een vergissing aan. Elke wijziging komt in het
          logboek.
        </p>
      </div>

      <AddTransfer today={today} />

      {error ? (
        <p className="text-destructive-text">
          De transfers konden niet geladen worden.
        </p>
      ) : transfers.length === 0 ? (
        <p className="text-muted-foreground">Nog geen transfers.</p>
      ) : (
        <ul aria-label="Transfers" className="space-y-4">
          {transfers.map((transfer) => {
            const category = transfer.category as TransferCategory;
            const retirement = isRetirement(transfer.category);
            return (
              <li key={transfer.id}>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {TRANSFER_CATEGORIES[category] ?? transfer.category}
                      </Badge>
                      {transfer.source_rumour_id && (
                        <Badge variant="secondary">Uit een gerucht</Badge>
                      )}
                      {transfer.confirmed_at && (
                        <span className="text-xs text-muted-foreground">
                          Bevestigd op{" "}
                          {formatDate(transfer.confirmed_at, "d MMMM yyyy")}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-lg">
                      <h3>{transfer.player_name}</h3>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span>{transfer.from_club ?? "Onbekende club"}</span>
                      <ArrowRight
                        className="h-4 w-4 text-muted-foreground"
                        aria-label="naar"
                      />
                      <span>{retirement ? "Stopt" : transfer.to_club}</span>
                      {transfer.division && (
                        <span className="text-muted-foreground">
                          (
                          {labelFor(RUMOUR_DIVISIONS, transfer.division) ??
                            transfer.division}
                          )
                        </span>
                      )}
                    </p>
                    <p className="min-w-0 text-sm">
                      <span className="text-muted-foreground">Bron: </span>
                      {transfer.source_url ? (
                        <a
                          href={transfer.source_url}
                          target="_blank"
                          rel="nofollow noopener noreferrer"
                          className="break-all text-primary underline underline-offset-2"
                        >
                          {transfer.source_url}
                        </a>
                      ) : (
                        "geen opgegeven"
                      )}
                    </p>
                    <TransferItemActions
                      transferId={transfer.id}
                      playerName={transfer.player_name}
                      fromRumour={!!transfer.source_rumour_id}
                      today={today}
                      values={{
                        playerName: transfer.player_name,
                        category:
                          category in TRANSFER_CATEGORIES ? category : null,
                        fromClub: transfer.from_club ?? "",
                        toClub: transfer.to_club ?? "",
                        division:
                          transfer.division &&
                          transfer.division in RUMOUR_DIVISIONS
                            ? (transfer.division as RumourDivision)
                            : null,
                        confirmedOn: transfer.confirmed_at
                          ? formatDate(transfer.confirmed_at, "yyyy-MM-dd")
                          : today,
                        sourceUrl: transfer.source_url ?? "",
                      }}
                    />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
