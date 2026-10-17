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
import { ArrowLeft, Clock, Loader2, Info } from "lucide-react";
import Link from "next/link";
import {
  MAX_PENDING_RUMOURS,
  PENDING_LIMIT_MESSAGE,
  RUMOUR_DIVISIONS,
  RUMOUR_GENDERS,
  RUMOUR_SOURCE_TYPES,
  SOURCE_URL_MAX_LENGTH,
} from "@/lib/rumours";

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const DIVISIONS = toOptions(RUMOUR_DIVISIONS);
const GENDERS = toOptions(RUMOUR_GENDERS);
const SOURCE_TYPES = toOptions(RUMOUR_SOURCE_TYPES);

// Logged-out visitors log in and come back here (#67).
const LOGIN_URL = "/auth/login?next=/geruchten/nieuw";

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
  const [submitted, setSubmitted] = useState(false);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [descriptionLength, setDescriptionLength] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  // The database enforces the cap (#54); this only warns before typing.
  const [atPendingLimit, setAtPendingLimit] = useState(false);

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
        router.push(LOGIN_URL);
        return;
      }

      const [{ data: profile }, { count: pendingCount }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, username")
          .eq("id", authUser.id)
          .single(),
        supabase
          .from("rumours")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", authUser.id)
          .eq("status", "pending"),
      ]);

      setAtPendingLimit((pendingCount ?? 0) >= MAX_PENDING_RUMOURS);
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

      // New rumours stay pending until a moderator approves them (#65), so
      // Transfer Talk wouldn't show it yet.
      setSubmitted(true);
    });
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="min-h-screen py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  // ── Submitted ──────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h1 className="text-2xl font-bold mb-2">
                Je gerucht wordt nagekeken
              </h1>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Een moderator bekijkt je gerucht voor het op Transfer Talk
                verschijnt. Tot dan zie je het alleen zelf, op je profiel.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/profile">
                  <Button>Naar mijn profiel</Button>
                </Link>
                <Link href="/geruchten">
                  <Button variant="outline">Terug naar Transfer Talk</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
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
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar Transfer Talk
        </Link>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="text-2xl gradient-text-neon">
                Nieuw Gerucht
              </CardTitle>
            </div>
            <CardDescription>
              Deel een transfer of stopzetting met de community. Klopt je tip,
              dan groeit je track record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Help Callout */}
            <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/30 flex gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">
                  💡 Hoe werkt het?
                </p>
                <p>
                  Als een moderator je gerucht bevestigt of ontkracht, telt het
                  mee voor je <strong>track record</strong>: hoeveel van je
                  geruchten bevestigd werden. Vanaf 5 afgeronde geruchten kan je
                  bij de <strong>betrouwbare bronnen</strong> staan.
                </p>
                <p className="mt-2">
                  Een moderator kijkt elk gerucht na voor het online komt.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {atPendingLimit && (
                <div
                  role="status"
                  className="p-3 text-sm bg-muted/50 rounded-md border border-border"
                >
                  {PENDING_LIMIT_MESSAGE}
                </div>
              )}

              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
                  {error}
                </div>
              )}

              {/* ── Step 1: Category selector ─────────────────────────────── */}
              <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
                <div className="space-y-2">
                  <Label htmlFor="category">
                    Soort Gerucht <span className="text-destructive">*</span>
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
                    <SelectTrigger className="w-full">
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
                    <div className="pb-3 border-b border-primary/20">
                      <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                        <span className="text-xl"></span> {sectionLabel}
                      </h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="lastName">
                          Achternaam <span className="text-destructive">*</span>
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
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="firstName">
                          Voornaam <span className="text-destructive">*</span>
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
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Gender — only for player categories */}
                      {showGender && (
                        <div className="space-y-2 animate-in fade-in-0 duration-200">
                          <Label htmlFor="gender">
                            Geslacht <span className="text-destructive">*</span>
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Man of vrouw
                          </p>
                          <Select name="gender" required>
                            <SelectTrigger className="w-full">
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
                          <span className="text-destructive">*</span>
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
                        <SelectTrigger className="w-full">
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
                      <div className="pb-3 border-b border-accent/40">
                        <h3 className="text-lg font-semibold text-accent-foreground flex items-center gap-2">
                          <span className="text-xl"></span> Gegevens Nieuwe Club
                        </h3>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="destinationClub">
                            Doelclub <span className="text-destructive">*</span>
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
                            <SelectTrigger>
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
                        Voeg details toe die je tip sterker maken. Maximum 2000
                        tekens.
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
                        className="dark:bg-input/30"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span></span>
                        <span>{descriptionLength} / 2000 tekens</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Source (#67) ─────────────────────────────────── */}
                  <div className="space-y-4">
                    <div className="pb-3 border-b border-primary/20">
                      <h3 className="text-lg font-semibold text-primary">
                        Bron
                      </h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="sourceType">
                          Waar komt je gerucht vandaan?{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Lezers en moderators zien de bron bij je gerucht
                        </p>
                        <Select name="sourceType" required>
                          <SelectTrigger id="sourceType" className="w-full">
                            <SelectValue placeholder="Selecteer bron" />
                          </SelectTrigger>
                          <SelectContent>
                            {SOURCE_TYPES.map((source) => (
                              <SelectItem
                                key={source.value}
                                value={source.value}
                              >
                                {source.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sourceUrl">
                          Link naar de bron{" "}
                          <span className="text-muted-foreground">
                            (optioneel)
                          </span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Bijvoorbeeld een artikel of bericht van de club
                        </p>
                        <Input
                          id="sourceUrl"
                          name="sourceUrl"
                          type="url"
                          inputMode="url"
                          placeholder="https://"
                          maxLength={SOURCE_URL_MAX_LENGTH}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Declarations (#67, D-003) ─────────────────────── */}
                  <fieldset className="space-y-3">
                    <legend className="sr-only">Verklaringen</legend>
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        name="declaredSenior"
                        required
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                      />
                      <span>
                        Dit gerucht gaat over een seniorspeler of -trainer{" "}
                        <span className="text-destructive">*</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        name="declaredGoodFaith"
                        required
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                      />
                      <span>
                        Ik deel dit gerucht te goeder trouw: ik geloof dat het
                        klopt en het bevat geen beledigingen of privézaken{" "}
                        <span className="text-destructive">*</span>
                      </span>
                    </label>
                  </fieldset>

                  {/* ── Form actions ──────────────────────────────────── */}
                  <div className="flex gap-3 pt-6 border-t border-border">
                    <Link href="/geruchten" className="flex-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                      >
                        Annuleren
                      </Button>
                    </Link>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isPending || atPendingLimit}
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
