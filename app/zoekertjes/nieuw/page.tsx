"use client"

import React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Send } from "lucide-react"
import Link from "next/link"

export default function NewClassifiedPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError("Je moet ingelogd zijn om een zoekertje te plaatsen")
      setLoading(false)
      return
    }

    const classifiedData = {
      user_id: user.id,
      type: formData.get("type") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      name: formData.get("name") as string,
      position: formData.get("position") as string || null,
      current_club: formData.get("current_club") as string || null,
      preferred_region: formData.get("preferred_region") as string || null,
      preferred_level: formData.get("preferred_level") as string || null,
      contact_email: formData.get("contact_email") as string,
      status: "active",
    }

    const { error: insertError } = await supabase
      .from("classifieds")
      .insert(classifiedData)

    if (insertError) {
      setError("Er ging iets mis bij het plaatsen van je zoekertje")
      setLoading(false)
      return
    }

    router.push("/zoekertjes")
    router.refresh()
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link 
        href="/zoekertjes" 
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Terug naar zoekertjes
      </Link>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Nieuw Zoekertje Plaatsen</CardTitle>
          <CardDescription>
            Op zoek naar een nieuwe club of speler? Plaats hier je zoekertje!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="type">Type zoekertje</Label>
              <Select name="type" required>
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player_seeking">Speler zoekt club</SelectItem>
                  <SelectItem value="coach_seeking">Trainer zoekt club</SelectItem>
                  <SelectItem value="team_seeking">Club zoekt speler/trainer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Naam</Label>
              <Input 
                id="name" 
                name="name" 
                placeholder="Je naam of clubnaam" 
                required 
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input 
                id="title" 
                name="title" 
                placeholder="bv. Ervaren setter zoekt nieuwe uitdaging" 
                required 
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschrijving</Label>
              <Textarea 
                id="description" 
                name="description" 
                placeholder="Vertel meer over jezelf, je ervaring en wat je zoekt..." 
                rows={5}
                required 
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">Positie (optioneel)</Label>
                <Input 
                  id="position" 
                  name="position" 
                  placeholder="bv. Setter, Libero" 
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current_club">Huidige club (optioneel)</Label>
                <Input 
                  id="current_club" 
                  name="current_club" 
                  placeholder="Je huidige club" 
                  className="bg-input border-border text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preferred_region">Voorkeur regio (optioneel)</Label>
                <Input 
                  id="preferred_region" 
                  name="preferred_region" 
                  placeholder="bv. Oost-Vlaanderen" 
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferred_level">Voorkeur niveau (optioneel)</Label>
                <Input 
                  id="preferred_level" 
                  name="preferred_level" 
                  placeholder="bv. Liga A, Nationale 1" 
                  className="bg-input border-border text-foreground"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact e-mail</Label>
              <Input 
                id="contact_email" 
                name="contact_email" 
                type="email"
                placeholder="je@email.com" 
                required 
                className="bg-input border-border text-foreground"
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive rounded-md text-destructive text-sm">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? (
                "Bezig met plaatsen..."
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Zoekertje plaatsen
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
