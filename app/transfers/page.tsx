import { createClient } from "@/lib/supabase/server";
import {
  TRANSFER_CARD_COLUMNS,
  TransferCard,
  type TransferCardData,
} from "@/components/transfer-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { ArrowRight, UserPlus, UserMinus, Users } from "lucide-react";
import { TRANSFER_TABS, type TransferCategory } from "@/lib/transfers";

// Cache transfers for 60 seconds; moderators' changes revalidate the page.
export const revalidate = 60;

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
// in TRANSFER_TABS.
async function getTransfers(
  categories: readonly TransferCategory[] | null,
): Promise<TransferCardData[]> {
  const supabase = await createClient();
  let query = supabase
    .from("transfers")
    .select(TRANSFER_CARD_COLUMNS)
    .order("confirmed_at", { ascending: false });

  if (categories) {
    query = query.in("category", categories);
  }

  const { data } = await query.limit(50);
  return (data ?? []) as TransferCardData[];
}

export default async function TransfersPage() {
  const lists = await Promise.all(
    TRANSFER_TABS.map((tab) => getTransfers(tab.categories)),
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Transfers</h1>
        <p className="text-muted-foreground">
          Alle bevestigde transfers in het Belgische volleybal
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8 bg-secondary">
          {TRANSFER_TABS.map((tab) => {
            const Icon = tabIcons[tab.value];
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TRANSFER_TABS.map((tab, i) => (
          <TabsContent key={tab.value} value={tab.value}>
            {lists[i].length === 0 ? (
              <EmptyState message={emptyMessages[tab.value]} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {lists[i].map((transfer) => (
                  <TransferCard key={transfer.id} transfer={transfer} share />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-12 text-center">
        <p className="text-muted-foreground mb-4">
          Ken je een transfer die nog niet vermeld staat?
        </p>
        <Button
          asChild
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Link href="/geruchten/nieuw">
            Maak een gerucht aan
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 bg-card rounded-lg border border-border">
      <p className="text-muted-foreground">{message}</p>
      <p className="text-sm text-muted-foreground mt-2">
        Transfers worden toegevoegd wanneer een moderator een gerucht bevestigt
      </p>
    </div>
  );
}
