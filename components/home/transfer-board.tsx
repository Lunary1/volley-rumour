import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Ledger,
  LedgerList,
  LedgerRow,
  LedgerRowSkeleton,
  ShareBar,
} from "@/components/ui/ledger";
import { RelativeTime } from "@/components/relative-time";
import { cn } from "@/lib/utils";
import { getTransferBoard, type BoardRumour } from "@/lib/public-data";
import {
  RUMOUR_DIVISIONS,
  RUMOUR_STATUS_BADGE_VARIANTS,
  RUMOUR_STATUS_LABELS,
  belief,
  labelFor,
  type RumourStatus,
} from "@/lib/rumours";

// The transfer board at the top of the homepage (#240): who is said to move
// where, how sure the community is and whether a moderator confirmed it.
// Every row links to the rumour. It streams in next to the hero.

const ROWS = 8;
/** Three lines on a phone, two from sm. */
const ROW_HEIGHT = "h-20 sm:h-17";

function BoardFrame({ children }: { children: React.ReactNode }) {
  return (
    <Ledger
      title="Transferbord"
      description="De nieuwste geruchten, nagekeken voor ze online komen"
      href="/geruchten"
      linkLabel="Alle geruchten"
    >
      {children}
    </Ledger>
  );
}

export async function TransferBoard() {
  const rumours = await getTransferBoard().catch((error) => {
    console.error("Error loading the transfer board:", error);
    return [];
  });

  if (rumours.length === 0) {
    return (
      <EmptyState
        icon={Flame}
        title="Nog geen geruchten"
        description="Weet jij wie volgend seizoen van club wisselt? Deel het eerste gerucht."
      >
        <Button asChild>
          <Link href="/geruchten/nieuw">Gerucht delen</Link>
        </Button>
      </EmptyState>
    );
  }

  // Fewer rumours than rows: the open slots stay, like a departure board, so
  // the board keeps its skeleton's height (#211). The first one asks for one.
  const open = ROWS - rumours.length;
  return (
    <BoardFrame>
      <LedgerList>
        {rumours.map((rumour) => (
          <BoardRow key={rumour.id} rumour={rumour} />
        ))}
        {open > 0 && (
          <LedgerRow
            href="/geruchten/nieuw"
            className={cn(ROW_HEIGHT, "text-meta text-muted-foreground")}
          >
            Weet jij wie er nog verhuist? Deel een gerucht.
          </LedgerRow>
        )}
        {Array.from({ length: open - 1 }, (_, i) => (
          <li key={i} className={ROW_HEIGHT} aria-hidden />
        ))}
      </LedgerList>
    </BoardFrame>
  );
}

export function TransferBoardSkeleton() {
  return (
    <BoardFrame>
      <LedgerList>
        {Array.from({ length: ROWS }, (_, i) => (
          <LedgerRowSkeleton key={i} className={ROW_HEIGHT} />
        ))}
      </LedgerList>
    </BoardFrame>
  );
}

function BoardRow({ rumour }: { rumour: BoardRumour }) {
  const retirement = rumour.category.includes("retirement");
  const division = labelFor(
    RUMOUR_DIVISIONS,
    retirement ? rumour.from_division : rumour.to_division,
  );
  const share = belief(rumour.votes_true, rumour.votes_false);
  const status = rumour.status as RumourStatus;

  return (
    <LedgerRow href={`/geruchten/${rumour.id}`} className={ROW_HEIGHT}>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="truncate font-semibold">{rumour.player_name}</span>
          <span className="hidden shrink-0 text-meta text-muted-foreground sm:inline">
            <RelativeTime date={rumour.created_at} strict />
          </span>
        </p>
        <p className="flex min-w-0 items-center gap-1.5 text-meta text-muted-foreground">
          {rumour.from_club_name && (
            <>
              <span className="truncate">{rumour.from_club_name}</span>
              <ArrowRight className="size-3.5 shrink-0" aria-hidden />
              <span className="sr-only">naar</span>
            </>
          )}
          <span className="truncate font-medium text-foreground">
            {retirement ? "Stopt" : rumour.to_club_name}
          </span>
          {division && (
            <span className="hidden shrink-0 sm:inline">· {division}</span>
          )}
        </p>
        {/* A phone has no room beside the name: when and where go below. */}
        <p className="truncate text-meta text-muted-foreground sm:hidden">
          <RelativeTime date={rumour.created_at} strict />
          {division && ` · ${division}`}
        </p>
      </div>

      <div className="flex w-24 shrink-0 flex-col items-end gap-1.5">
        <Badge variant={RUMOUR_STATUS_BADGE_VARIANTS[status]}>
          {RUMOUR_STATUS_LABELS[status]}
        </Badge>
        {share === null ? (
          <span className="text-tiny text-muted-foreground">
            Nog geen stemmen
          </span>
        ) : (
          <span className="flex w-full items-center gap-1.5">
            <ShareBar value={share} />
            <span
              className="text-tiny font-semibold tabular-nums"
              title={`${share}% van de stemmers denkt dat dit klopt`}
            >
              <span className="sr-only">
                {share}% van de stemmers denkt dat dit klopt
              </span>
              <span aria-hidden>{share}%</span>
            </span>
          </span>
        )}
      </div>
    </LedgerRow>
  );
}
