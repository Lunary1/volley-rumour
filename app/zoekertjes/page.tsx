import { createClient } from "@/lib/supabase/server"
import { ClassifiedCard } from "@/components/classified-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { Plus, User, Users, Building2 } from "lucide-react"

async function getClassifieds(type?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("classifieds")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
  
  if (type) {
    query = query.eq("type", type)
  }
  
  const { data } = await query.limit(50)
  return data || []
}

export default async function ZoekertjesPage() {
  const [allClassifieds, playerSeeking, coachSeeking, teamSeeking] = await Promise.all([
    getClassifieds(),
    getClassifieds("player_seeking"),
    getClassifieds("coach_seeking"),
    getClassifieds("team_seeking"),
  ])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Zoekertjes</h1>
          <p className="text-muted-foreground">
            Spelers, trainers en clubs op zoek naar nieuwe uitdagingen
          </p>
        </div>
        <Button asChild className="mt-4 md:mt-0 bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/zoekertjes/nieuw">
            <Plus className="mr-2 h-4 w-4" />
            Plaats zoekertje
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8 bg-secondary">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Alles
          </TabsTrigger>
          <TabsTrigger value="players" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <User className="w-4 h-4 mr-2" />
            Spelers
          </TabsTrigger>
          <TabsTrigger value="coaches" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4 mr-2" />
            Trainers
          </TabsTrigger>
          <TabsTrigger value="teams" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Building2 className="w-4 h-4 mr-2" />
            Clubs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {allClassifieds.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allClassifieds.map((classified) => (
                <ClassifiedCard key={classified.id} classified={classified} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="players">
          {playerSeeking.length === 0 ? (
            <EmptyState type="spelers" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {playerSeeking.map((classified) => (
                <ClassifiedCard key={classified.id} classified={classified} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="coaches">
          {coachSeeking.length === 0 ? (
            <EmptyState type="trainers" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {coachSeeking.map((classified) => (
                <ClassifiedCard key={classified.id} classified={classified} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="teams">
          {teamSeeking.length === 0 ? (
            <EmptyState type="clubs" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teamSeeking.map((classified) => (
                <ClassifiedCard key={classified.id} classified={classified} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EmptyState({ type }: { type?: string }) {
  return (
    <div className="text-center py-12 bg-card rounded-lg border border-border">
      <p className="text-muted-foreground">
        {type ? `Nog geen zoekertjes van ${type}` : "Nog geen zoekertjes geplaatst"}
      </p>
      <Button asChild variant="outline" className="mt-4 border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent">
        <Link href="/zoekertjes/nieuw">
          <Plus className="mr-2 h-4 w-4" />
          Wees de eerste!
        </Link>
      </Button>
    </div>
  )
}
