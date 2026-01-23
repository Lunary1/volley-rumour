import { createClient } from "@/lib/supabase/server"
import { RumourCard } from "@/components/rumour-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Flame, Plus, Filter } from "lucide-react"
import Link from "next/link"

async function getRumours() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("rumours")
    .select(`
      *,
      author:profiles(username, trust_score)
    `)
    .order("created_at", { ascending: false })
  
  return data || []
}

export default async function GeruchtenPage() {
  const rumours = await getRumours()

  const pendingRumours = rumours.filter((r) => r.status === "pending")
  const confirmedRumours = rumours.filter((r) => r.status === "confirmed")
  const deniedRumours = rumours.filter((r) => r.status === "denied")

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Geruchten</h1>
            <p className="text-muted-foreground">
              Ontdek de nieuwste volleybal geruchten en stem of ze waar zijn
            </p>
          </div>
          <Link href="/geruchten/nieuw">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-5 w-5" />
              Nieuw Gerucht
            </Button>
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Button variant="secondary" className="bg-primary/20 text-primary hover:bg-primary/30">
            Alle ({rumours.length})
          </Button>
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
            <Flame className="mr-2 h-4 w-4 text-accent" />
            Trending ({pendingRumours.length})
          </Button>
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
            Bevestigd ({confirmedRumours.length})
          </Button>
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
            Ontkracht ({deniedRumours.length})
          </Button>
        </div>

        {/* Rumours Grid */}
        {rumours.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rumours.map((rumour) => (
              <RumourCard key={rumour.id} rumour={rumour as any} />
            ))}
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <Flame className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">Nog geen geruchten</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Wees de eerste om een gerucht te delen! Heb je gehoord over een mogelijke transfer?
              </p>
              <Link href="/geruchten/nieuw">
                <Button className="bg-primary text-primary-foreground">
                  <Plus className="mr-2 h-5 w-5" />
                  Deel je eerste gerucht
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
