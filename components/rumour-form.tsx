"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createRumour, updateRumour } from "@/app/actions/rumour";
import { Button } from "@/components/ui/button";
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
import {
  PENDING_LIMIT_MESSAGE,
  RUMOUR_DIVISIONS,
  RUMOUR_GENDERS,
  RUMOUR_SOURCE_TYPES,
  SOURCE_URL_MAX_LENGTH,
} from "@/lib/rumours";
import { useIsClient } from "@/lib/use-is-client";

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const DIVISIONS = toOptions(RUMOUR_DIVISIONS);
const GENDERS = toOptions(RUMOUR_GENDERS);
const SOURCE_TYPES = toOptions(RUMOUR_SOURCE_TYPES);

const RUMOUR_CATEGORIES = [
  { value: "transfer", label: "Transfer Speler/Speelster" },
  { value: "trainer_transfer", label: "Transfer Trainer" },
  { value: "player_retirement", label: "Speler Stopt" },
  { value: "trainer_retirement", label: "Trainer Stopt" },
];

function isPlayerCategory(cat: string) {
  return cat === "transfer" || cat === "player_retirement";
}
function isTransferCategory(cat: string) {
  return cat === "transfer" || cat === "trainer_transfer";
}

/** A pending rumour as the form shows it, for editing (#192). */
export interface RumourFormValues {
  id: string;
  category: string;
  firstName: string;
  lastName: string;
  gender?: string;
  currentClub: string;
  currentDivision?: string;
  destinationClub?: string;
  destinationDivision?: string;
  description?: string;
  sourceType?: string;
  sourceUrl?: string;
}

interface RumourFormProps {
  /** Edit this pending rumour; without it, the form submits a new one. */
  rumour?: RumourFormValues;
  /** The author has the maximum of pending rumours (#54). New rumours only. */
  atPendingLimit?: boolean;
  /** Called after a new rumour was submitted. */
  onCreated?: () => void;
}

/**
 * The rumour form (#67, D-003): new rumours, and the author's edits while a
 * rumour is pending (#192, D-042). An edit asks for the declarations again,
 * because the content changed.
 */
export function RumourForm({
  rumour,
  atPendingLimit = false,
  onCreated,
}: RumourFormProps) {
  const router = useRouter();
  const isClient = useIsClient();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [descriptionLength, setDescriptionLength] = useState(
    rumour?.description?.length ?? 0,
  );
  const [selectedCategory, setSelectedCategory] = useState<string>(
    rumour?.category ?? "",
  );

  const showGender = isPlayerCategory(selectedCategory);
  const showDestination = isTransferCategory(selectedCategory);
  const sectionLabel = isPlayerCategory(selectedCategory)
    ? "Gegevens Speler/Speelster"
    : "Gegevens Trainer";

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
      const result = rumour
        ? await updateRumour(rumour.id, formData)
        : await createRumour(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (rumour) {
        toast.success("Je gerucht is aangepast en wacht op een moderator");
        router.push("/profile");
        router.refresh();
      } else {
        onCreated?.();
      }
    });
  }

  return (
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
            👆 Selecteer eerst een type gerucht om de rest van het formulier te
            zien.
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
                  defaultValue={rumour?.lastName}
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
                  defaultValue={rumour?.firstName}
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
                  <p className="text-xs text-muted-foreground">Man of vrouw</p>
                  <Select name="gender" required defaultValue={rumour?.gender}>
                    <SelectTrigger className="w-full">
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
              )}

              {/* Current club */}
              <div className="space-y-2">
                <Label htmlFor="currentClub">
                  Huidige Club <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isPlayerCategory(selectedCategory)
                    ? "De club waar de speler momenteel speelt"
                    : "De club waar de trainer momenteel werkt"}
                </p>
                <Input
                  id="currentClub"
                  name="currentClub"
                  defaultValue={rumour?.currentClub}
                  placeholder="Bijv. Knack Roeselare"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentDivision">
                Huidig Niveau{" "}
                <span className="text-muted-foreground">(optioneel)</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Het competitieniveau van de huidige club
              </p>
              <Select
                name="currentDivision"
                defaultValue={rumour?.currentDivision}
              >
                <SelectTrigger className="w-full">
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

          {/* ── Destination club section — transfer types only ── */}
          {showDestination && (
            <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
              <div className="pb-3 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
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
                    defaultValue={rumour?.destinationClub}
                    placeholder="Bijv. Caruur Gent Volley"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destinationDivision">
                    Doelniveau{" "}
                    <span className="text-muted-foreground">(optioneel)</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Het competitieniveau van de doelclub
                  </p>
                  <Select
                    name="destinationDivision"
                    defaultValue={rumour?.destinationDivision}
                  >
                    <SelectTrigger>
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
            </div>
          )}

          {/* ── Description (always shown) ────────────────────── */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">
                Extra informatie
                <span className="text-muted-foreground"> (optioneel)</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Voeg details toe die je tip sterker maken. Maximum 2000 tekens.
              </p>
              <Textarea
                id="description"
                name="description"
                defaultValue={rumour?.description}
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
              <h3 className="text-lg font-semibold text-primary">Bron</h3>
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
                <Select
                  name="sourceType"
                  required
                  defaultValue={rumour?.sourceType}
                >
                  <SelectTrigger id="sourceType" className="w-full">
                    <SelectValue placeholder="Selecteer bron" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sourceUrl">
                  Link naar de bron{" "}
                  <span className="text-muted-foreground">(optioneel)</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Bijvoorbeeld een artikel of bericht van de club
                </p>
                <Input
                  id="sourceUrl"
                  name="sourceUrl"
                  defaultValue={rumour?.sourceUrl}
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
                Ik deel dit gerucht te goeder trouw: ik geloof dat het klopt en
                het bevat geen beledigingen of privézaken{" "}
                <span className="text-destructive">*</span>
              </span>
            </label>
          </fieldset>

          {/* ── Form actions ──────────────────────────────────── */}
          <div className="flex gap-3 pt-6 border-t border-border">
            <Link href={rumour ? "/profile" : "/geruchten"} className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                Annuleren
              </Button>
            </Link>
            <Button
              type="submit"
              className="flex-1"
              disabled={!isClient || isPending || atPendingLimit}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {rumour ? "Wijzigingen opslaan" : "Gerucht Delen"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
