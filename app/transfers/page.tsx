import { TransferCard } from "@/components/transfer-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageNav } from "@/components/page-nav";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, UserPlus, UserMinus, Users } from "lucide-react";
import { chipVariants } from "@/components/ui/chip";
import { TRANSFER_TABS, parseTransferTab, transfersUrl } from "@/lib/transfers";
import {
  TRANSFERS_PER_PAGE,
  getTransfersPage,
  pageCount,
  parsePage,
} from "@/lib/public-data";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Transfers",
  description:
    "Bevestigde transfers van spelers en trainers in het Belgische volleybal, met de officiële bron.",
  path: "/transfers",
});

const tabIcons = {
  all: Users,
  players: UserPlus,
  trainers: Users,
  retirements: UserMinus,
} as const;

const emptyMessages = {
  all: "Nog geen transfers geregistreerd",
  players: "Nog geen spelerstransfers",
  trainers: "Nog geen trainerstransfers",
  retirements: "Nog geen afscheidsberichten",
} as const;

// One set of transfer types everywhere (#82): each tab lists the categories
// in TRANSFER_TABS. The tab and page live in the URL and the server loads
// one page of one tab, cached for every visitor (#96).
export default async function TransfersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const tab = parseTransferTab(searchParams.type);
  const page = parsePage(searchParams.pagina);

  const result = await getTransfersPage(tab, page);
  if (!result) redirect(transfersUrl(tab));
  const totalPages = pageCount(result.total, TRANSFERS_PER_PAGE);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Transfers</h1>
        <p className="text-muted-foreground">
          Alle bevestigde transfers in het Belgische volleybal
        </p>
      </div>

      <nav aria-label="Soort transfer" className="mb-8 flex flex-wrap gap-2">
        {TRANSFER_TABS.map((t) => {
          const Icon = tabIcons[t.value];
          const active = t.value === tab;
          return (
            <Link
              key={t.value}
              href={transfersUrl(t.value)}
              aria-current={active ? "page" : undefined}
              className={chipVariants({ active })}
            >
              <Icon className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {result.transfers.length === 0 ? (
        <EmptyState
          title={emptyMessages[tab]}
          description="Transfers worden toegevoegd wanneer een moderator een gerucht bevestigt."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {result.transfers.map((transfer) => (
              <TransferCard key={transfer.id} transfer={transfer} share />
            ))}
          </div>
          <PageNav
            currentPage={page}
            totalPages={totalPages}
            pageUrl={(p) => transfersUrl(tab, p)}
          />
        </>
      )}

      <div className="mt-12 text-center">
        <p className="text-muted-foreground mb-4">
          Ken je een transfer die nog niet vermeld staat?
        </p>
        <Button asChild>
          <Link href="/geruchten/nieuw">
            Maak een gerucht aan
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
