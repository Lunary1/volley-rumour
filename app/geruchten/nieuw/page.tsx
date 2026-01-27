"use client";

import React from "react";
import { useState, useEffect } from "react";
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
import { ArrowLeft, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const DIVISIONS = [
  { value: "liga_heren", label: "LIGA HEREN" },
  { value: "liga_dames", label: "LIGA DAMES" },
  { value: "nat1_heren", label: "Nationale 1 Heren" },
  { value: "nat2_heren", label: "Nationale 2 Heren" },
  { value: "nat3_heren", label: "Nationale 3 Heren" },
  { value: "nat1_dames", label: "Nationale 1 Dames" },
  { value: "nat2_dames", label: "Nationale 2 Dames" },
  { value: "nat3_dames", label: "Nationale 3 Dames" },
  { value: "promo1_heren", label: "PROMO 1 Heren" },
  { value: "promo2_heren", label: "PROMO 2 Heren" },
  { value: "promo3_heren", label: "PROMO 3 Heren" },
  { value: "promo4_heren", label: "PROMO 4 Heren" },
  { value: "promo1_dames", label: "PROMO 1 Dames" },
  { value: "promo2_dames", label: "PROMO 2 Dames" },
  { value: "promo3_dames", label: "PROMO 3 Dames" },
  { value: "promo4_dames", label: "PROMO 4 Dames" },
];

const GENDERS = [
  { value: "male", label: "Man" },
  { value: "female", label: "Vrouw" },
];

export default function NewRumourPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/auth/login");
        return;
      }

      // Fetch user profile to get email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, username")
        .eq("id", authUser.id)
        .single();

      setUser({ ...authUser, ...profile });
    };

    checkUser();
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const supabase = createClient();

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      setError("Je moet ingelogd zijn om een gerucht te delen");
      setLoading(false);
      return;
    }

    const rumourData = {
      player_name: `${formData.get("playerFirstName")} ${formData.get("playerLastName")}`,
      from_club_name: formData.get("currentTeam") as string,
      to_club_name: formData.get("newClub") as string,
      description: (formData.get("description") as string) || null,
      category: "transfer",
      creator_id: authUser.id,
    };

    const { error: insertError } = await supabase
      .from("rumours")
      .insert(rumourData);

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/geruchten");
    router.refresh();
  }

  if (!user) {
    return (
      <div className="min-h-screen py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-neon-cyan" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/geruchten"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-neon-cyan dark:hover:text-neon-cyan transition-colors mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar Transfer Talk
        </Link>

        <Card className="bg-card border-border dark:border-neon-magenta/30">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="text-2xl gradient-text-neon">
                Nieuwe Transfer
              </CardTitle>
            </div>
            <CardDescription>
              Deel een transfer mogelijkheid met de community. Als je tip klopt,
              verdien je punten!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
                  {error}
                </div>
              )}

              {/* Player/Athlete Data Section */}
              <div className="space-y-4">
                <div className="pb-3 border-b border-neon-cyan/20 dark:border-neon-cyan/30">
                  <h3 className="text-lg font-semibold text-neon-cyan dark:text-neon-cyan flex items-center gap-2">
                    <span className="text-xl"></span> Gegevens Speler/Speelster
                  </h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="playerLastName">
                      Naam <span className="text-neon-coral">*</span>
                    </Label>
                    <Input
                      id="playerLastName"
                      name="playerLastName"
                      placeholder="Bijv. Janssen"
                      required
                      className="dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playerFirstName">
                      Voornaam <span className="text-neon-coral">*</span>
                    </Label>
                    <Input
                      id="playerFirstName"
                      name="playerFirstName"
                      placeholder="Bijv. Jan"
                      required
                      className="dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gender">
                      Geslacht <span className="text-neon-coral">*</span>
                    </Label>
                    <Select name="gender" required>
                      <SelectTrigger className="w-full dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70">
                        <SelectValue placeholder="Selecteer geslacht" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.map((gender) => (
                          <SelectItem key={gender.value} value={gender.value}>
                            {gender.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentTeam">
                      Huidig Team <span className="text-neon-coral">*</span>
                    </Label>
                    <Input
                      id="currentTeam"
                      name="currentTeam"
                      placeholder="Bijv. Knack Roeselare"
                      required
                      className="dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentDivision">Niveau (Huidig)</Label>
                  <Select name="currentDivision">
                    <SelectTrigger className="w-full dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70">
                      <SelectValue placeholder="Selecteer niveau" />
                    </SelectTrigger>
                    <SelectContent>
                      {DIVISIONS.map((division) => (
                        <SelectItem key={division.value} value={division.value}>
                          {division.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* New Club Data Section */}
              <div className="space-y-4">
                <div className="pb-3 border-b border-neon-coral/20 dark:border-neon-coral/30">
                  <h3 className="text-lg font-semibold text-neon-coral dark:text-neon-coral flex items-center gap-2">
                    <span className="text-xl"></span> Gegevens Nieuwe Club
                  </h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="newClub">
                      Clubnaam <span className="text-neon-coral">*</span>
                    </Label>
                    <Input
                      id="newClub"
                      name="newClub"
                      placeholder="Bijv. Caruur Gent Volley"
                      required
                      className="dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newDivision">
                      Niveau <span className="text-neon-coral">*</span>
                    </Label>
                    <Select name="newDivision" required>
                      <SelectTrigger className="dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70">
                        <SelectValue placeholder="Selecteer niveau" />
                      </SelectTrigger>
                      <SelectContent>
                        {DIVISIONS.map((division) => (
                          <SelectItem
                            key={division.value}
                            value={division.value}
                          >
                            {division.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Extra informatie (optioneel)
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Deel meer details over dit gerucht..."
                    rows={4}
                    className="dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-6 border-t border-border dark:border-neon-cyan/10">
                <Link href="/geruchten" className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-transparent border-neon-cyan/50 dark:border-neon-cyan/70 hover:bg-neon-cyan/10 dark:hover:shadow-[0_0_20px_rgba(178,190,255,0.2)] text-neon-cyan dark:text-neon-cyan"
                  >
                    Annuleren
                  </Button>
                </Link>
                <Button
                  type="submit"
                  className="flex-1 gradient-text-neon bg-gradient-to-b from-neon-magenta/40 to-neon-coral/40 hover:from-neon-magenta/50 hover:to-neon-coral/50 border border-neon-magenta/50 dark:border-neon-magenta/70 dark:shadow-[0_0_20px_rgba(216,180,254,0.2)] dark:hover:shadow-[0_0_30px_rgba(216,180,254,0.4)] text-white dark:text-white"
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
