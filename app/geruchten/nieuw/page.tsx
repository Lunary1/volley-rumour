"use client";

import React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Flame, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewRumourPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const playerName = formData.get("playerName") as string;
    const fromClub = formData.get("fromClub") as string;
    const toClub = formData.get("toClub") as string;
    const category = formData.get("category") as string;
    const description = formData.get("description") as string;

    const supabase = createClient();

    // Check if user is logged in
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Je moet ingelogd zijn om een gerucht te delen");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("rumours").insert({
      player_name: playerName,
      from_club_name: fromClub || null,
      to_club_name: toClub,
      category,
      description: description || null,
      creator_id: user.id,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/geruchten");
    router.refresh();
  }

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/geruchten"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar Transfer Talk
        </Link>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Flame className="h-5 w-5 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl">Nieuwe Transfer Talk</CardTitle>
            </div>
            <CardDescription>
              Deel een transfer mogelijkheid met de community. Als je tip klopt,
              verdien je punten!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="category">Categorie</Label>
                <Select name="category" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer een categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="trainer_transfer">
                      Trainer Transfer
                    </SelectItem>
                    <SelectItem value="player_retirement">
                      Speler Stopt
                    </SelectItem>
                    <SelectItem value="trainer_retirement">
                      Trainer Stopt
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="playerName">Naam Speler/Trainer</Label>
                <Input
                  id="playerName"
                  name="playerName"
                  placeholder="Bijv. Jan Janssen"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fromClub">Van Club (optioneel)</Label>
                  <Input
                    id="fromClub"
                    name="fromClub"
                    placeholder="Bijv. VC Antwerpen"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="toClub">Naar Club</Label>
                  <Input
                    id="toClub"
                    name="toClub"
                    placeholder="Bijv. VBC Gent"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Extra informatie (optioneel)
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Deel meer details over dit gerucht..."
                  rows={4}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Link href="/geruchten" className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-transparent"
                  >
                    Annuleren
                  </Button>
                </Link>
                <Button
                  type="submit"
                  className="flex-1 bg-primary text-primary-foreground"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Gerucht Delen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
