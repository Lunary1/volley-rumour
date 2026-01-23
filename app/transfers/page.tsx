import { createClient } from "@/lib/supabase/server"
import { TransferCard } from "@/components/transfer-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { ArrowRight, UserPlus, UserMinus, Users } from "lucide-react"

async function getTransfers(type?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("transfers")
    .select("*")
    .order("confirmed_at", { ascending: false })
  
  if (type) {
    query = query.eq("transfer_type", type)
  }
  
  const { data } = await query.limit(50)
  return data || []
}

export default async function TransfersPage() {
  const [allTransfers, playerTransfers, coachTransfers, retirements] = await Promise.all([
    getTransfers(),
    getTransfers("player"),
    getTransfers("coach"),
    getTransfers("retirement"),
  ])

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
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4 mr-2" />
            Alles
          </TabsTrigger>
          <TabsTrigger value="players" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <UserPlus className="w-4 h-4 mr-2" />
            Spelers
          </TabsTrigger>
          <TabsTrigger value="coaches" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4 mr-2" />
            Trainers
          </TabsTrigger>
          <TabsTrigger value="retirements" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <UserMinus className="w-4 h-4 mr-2" />
            Gestopt
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {allTransfers.length === 0 ? (
            <EmptyState message="Nog geen transfers geregistreerd" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allTransfers.map((transfer) => (
                <TransferCard key={transfer.id} transfer={transfer} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="players">
          {playerTransfers.length === 0 ? (
            <EmptyState message="Nog geen spelerstransfers" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {playerTransfers.map((transfer) => (
                <TransferCard key={transfer.id} transfer={transfer} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="coaches">
          {coachTransfers.length === 0 ? (
            <EmptyState message="Nog geen trainerstransfers" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {coachTransfers.map((transfer) => (
                <TransferCard key={transfer.id} transfer={transfer} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="retirements">
          {retirements.length === 0 ? (
            <EmptyState message="Nog geen afscheidsberichten" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {retirements.map((transfer) => (
                <TransferCard key={transfer.id} transfer={transfer} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-12 text-center">
        <p className="text-muted-foreground mb-4">
          Ken je een transfer die nog niet vermeld staat?
        </p>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/geruchten/nieuw">
            Maak een gerucht aan
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 bg-card rounded-lg border border-border">
      <p className="text-muted-foreground">{message}</p>
      <p className="text-sm text-muted-foreground mt-2">
        Transfers worden toegevoegd wanneer geruchten bevestigd worden
      </p>
    </div>
  )
}
