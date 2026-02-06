"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createRumour } from "@/app/actions/rumour";
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
import { ArrowLeft, Loader2, Info } from "lucide-react";
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

const RUMOUR_CATEGORIES = [
  { value: "transfer", label: "Transfer Speler/Speelster" },
  { value: "trainer_transfer", label: "Transfer Trainer" },
  { value: "player_retirement", label: "Speler Stopt" },
  { value: "trainer_retirement", label: "Trainer Stopt" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPlayerCategory(cat: string) {
  return cat === "transfer" || cat === "player_retirement";
}
function isTransferCategory(cat: string) {
  return cat === "transfer" || cat === "trainer_transfer";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function NewRumourPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [descriptionLength, setDescriptionLength] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Derived booleans for conditional rendering
  const showGender = isPlayerCategory(selectedCategory);
  const showDestination = isTransferCategory(selectedCategory);
  const sectionLabel = isPlayerCategory(selectedCategory)
    ? "Gegevens Speler/Speelster"
    : "Gegevens Trainer";

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
    setError(null);

    if (!selectedCategory) {
      setError("Selecteer alstublieft een soort gerucht");
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("category", selectedCategory);

    startTransition(async () => {
      const result = await createRumour(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push("/geruchten");
      router.refresh();
    });
  }

  // ── Loading state ──────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

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
                Nieuw Gerucht
              </CardTitle>
            </div>
            <CardDescription>
              Deel een transfer of stopzetting met de community. Als je tip
              klopt, verdien je punten!
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Help Callout */}
            <div className="mb-6 p-4 rounded-lg bg-neon-cyan/10 dark:bg-neon-cyan/5 border border-neon-cyan/30 dark:border-neon-cyan/20 flex gap-3">
              <Info className="h-5 w-5 text-neon-cyan shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">
                  💡 Hoe werkt het?
                </p>
                <p>
                  Bevestigde transfers geven je <strong>+5 punten</strong>. Hoe
                  meer je tip opvalt, hoe hoger je op de leaderboard!
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
                  {error}
                </div>
              )}

              {/* ── Step 1: Category selector ─────────────────────────────── */}
              <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border dark:border-neon-cyan/10">
                <div className="space-y-2">
                  <Label htmlFor="category">
                    Soort Gerucht <span className="text-neon-coral">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Selecteer wat voor type gerucht dit is
                  </p>
                  <Select
                    name="category"
                    required
                    value={selectedCategory}
                    onValueChange={(v) => {
                      setSelectedCategory(v);
                      setError(null);
                    }}
                  >
                    <SelectTrigger className="w-full dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70">
                      <SelectValue placeholder="Selecteer type gerucht" />
                    </SelectTrigger>
                    <SelectContent>
                      {RUMOUR_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ── Prompt when no category selected ──────────────────────── */}
              {!selectedCategory && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">
                    👆 Selecteer eerst een type gerucht om de rest van het
                    formulier te zien.
                  </p>
                </div>
              )}

              {/* ── Step 2: Fields shown once a category is selected ───── */}
              {selectedCategory && (
                <div className="space-y-8 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                  {/* ── Person data section ────────────────────────────── */}
                  <div className="space-y-4">
                    <div className="pb-3 border-b border-neon-cyan/20 dark:border-neon-cyan/30">
                      <h3 className="text-lg font-semibold text-neon-cyan dark:text-neon-cyan flex items-center gap-2">
                        <span className="text-xl"></span> {sectionLabel}
                      </h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="lastName">
                          Achternaam <span className="text-neon-coral">*</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {isPlayerCategory(selectedCategory)
                            ? "De achternaam van de speler"
                            : "De achternaam van de trainer"}
                        </p>
                        <Input
                          id="lastName"
                          name="lastName"
                          placeholder="Bijv. Janssen"
                          minLength={2}
                          maxLength={100}
                          required
                          className="dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="firstName">
                          Voornaam <span className="text-neon-coral">*</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {isPlayerCategory(selectedCategory)
                            ? "De voornaam van de speler"
                            : "De voornaam van de trainer"}
                        </p>
                        <Input
                          id="firstName"
                          name="firstName"
                          placeholder="Bijv. Jan"
                          minLength={2}
                          maxLength={100}
                          required
                          className="dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Gender — only for player categories */}
                      {showGender && (
                        <div className="space-y-2 animate-in fade-in-0 duration-200">
                          <Label htmlFor="gender">
                            Geslacht <span className="text-neon-coral">*</span>
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Man of vrouw
                          </p>
                          <Select name="gender" required>
                            <SelectTrigger className="w-full dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70">
                              <SelectValue placeholder="Selecteer geslacht" />
                            </SelectTrigger>
                            <SelectContent>
                              {GENDERS.map((gender) => (
                                <SelectItem
                                  key={gender.value}
                                  value={gender.value}
                                >
                                  {gender.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Current club */}
                      <div className="space-y-2">
                        <Label htmlFor="currentClub">
                          Huidige Club{" "}
                          <span className="text-neon-coral">*</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {isPlayerCategory(selectedCategory)
                            ? "De club waar de speler momenteel speelt"
                            : "De club waar de trainer momenteel werkt"}
                        </p>
                        <Input
                          id="currentClub"
                          name="currentClub"
                          placeholder="Bijv. Knack Roeselare"
                          required
                          className="dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currentDivision">
                        Huidig Niveau{" "}
                        <span className="text-muted-foreground">
                          (optioneel)
                        </span>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Het competitieniveau van de huidige club
                      </p>
                      <Select name="currentDivision">
                        <SelectTrigger className="w-full dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70">
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

                  {/* ── Destination club section — transfer types only ── */}
                  {showDestination && (
                    <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                      <div className="pb-3 border-b border-neon-coral/20 dark:border-neon-coral/30">
                        <h3 className="text-lg font-semibold text-neon-coral dark:text-neon-coral flex items-center gap-2">
                          <span className="text-xl"></span> Gegevens Nieuwe Club
                        </h3>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="destinationClub">
                            Doelclub <span className="text-neon-coral">*</span>
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {isPlayerCategory(selectedCategory)
                              ? "De club waar de speler naartoe gaat"
                              : "De club waar de trainer naartoe gaat"}
                          </p>
                          <Input
                            id="destinationClub"
                            name="destinationClub"
                            placeholder="Bijv. Caruur Gent Volley"
                            required
                            className="dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="destinationDivision">
                            Doelniveau{" "}
                            <span className="text-muted-foreground">
                              (optioneel)
                            </span>
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Het competitieniveau van de doelclub
                          </p>
                          <Select name="destinationDivision">
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
                  )}

                  {/* ── Description (always shown) ────────────────────── */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="description">
                        Extra informatie
                        <span className="text-muted-foreground">
                          {" "}
                          (optioneel)
                        </span>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Voeg aanvullende details toe die je tip sterker maken —
                        bronnen, geruchten, etc. Maximum 2000 tekens.
                      </p>
                      <Textarea
                        id="description"
                        name="description"
                        placeholder="Deel meer details over dit gerucht. Voeg bronnen of context toe..."
                        rows={4}
                        maxLength={2000}
                        onChange={(e) =>
                          setDescriptionLength(e.currentTarget.value.length)
                        }
                        className="dark:bg-input/30 dark:border-neon-cyan/30 dark:focus:border-neon-cyan/70"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span></span>
                        <span>{descriptionLength} / 2000 tekens</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Form actions ──────────────────────────────────── */}
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
                      className="flex-1 gradient-text-neon bg-linear-to-b from-neon-magenta/40 to-neon-coral/40 hover:from-neon-magenta/50 hover:to-neon-coral/50 border border-neon-magenta/50 dark:border-neon-magenta/70 dark:shadow-[0_0_20px_rgba(216,180,254,0.2)] dark:hover:shadow-[0_0_30px_rgba(216,180,254,0.4)] text-white dark:text-white"
                      disabled={isPending}
                    >
                      {isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Gerucht Delen
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
