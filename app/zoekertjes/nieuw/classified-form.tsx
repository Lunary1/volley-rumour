"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, Send } from "lucide-react";
import { createClassified } from "@/app/actions/classifieds";
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
  CLASSIFIED_DESCRIPTION_MAX_LENGTH,
  CLASSIFIED_GENDERS,
  CLASSIFIED_TYPES,
  DIVISION_LABELS,
  POSITION_LABELS,
  PROVINCE_LABELS,
  TRAINER_DIPLOMA_LABELS,
  divisionMatchesGender,
  isPersonAd,
  isPlayerAd,
} from "@/lib/classifieds-utils";
import { useIsClient } from "@/lib/use-is-client";

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const TYPES = toOptions(CLASSIFIED_TYPES);
const GENDERS = toOptions(CLASSIFIED_GENDERS);
const DIVISIONS = toOptions(DIVISION_LABELS);
const POSITIONS = toOptions(POSITION_LABELS);
const DIPLOMAS = toOptions(TRAINER_DIPLOMA_LABELS);
const PROVINCES = toOptions(PROVINCE_LABELS);

const inputClass = "bg-input border-border text-foreground";

function Required() {
  return <span className="text-destructive">*</span>;
}

function SelectField({
  name,
  label,
  placeholder,
  options,
  required = false,
  disabled = false,
  onValueChange,
}: {
  name: string;
  label: React.ReactNode;
  placeholder: string;
  options: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Select
        name={name}
        required={required}
        disabled={disabled}
        onValueChange={onValueChange}
      >
        <SelectTrigger id={name} className={`${inputClass} w-full`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TextField({
  name,
  label,
  placeholder,
  required = false,
}: {
  name: string;
  label: React.ReactNode;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        placeholder={placeholder}
        required={required}
        maxLength={200}
        className={inputClass}
      />
    </div>
  );
}

export function ClassifiedForm() {
  const router = useRouter();
  const hydrated = useIsClient();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);

  const isPerson = type ? isPersonAd(type) : false;
  // Every senior division is heren or dames (#71).
  const divisions = gender
    ? DIVISIONS.filter((d) => divisionMatchesGender(d.value, gender))
    : [];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createClassified(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success("Je zoekertje staat online");
      router.push(`/zoekertjes/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <SelectField
        name="type"
        label="Type zoekertje"
        placeholder="Selecteer type"
        options={TYPES}
        required
        onValueChange={setType}
      />

      {type && (
        <>
          {isPerson ? (
            <div className="grid grid-cols-2 gap-4">
              <TextField
                name="firstName"
                label={
                  <>
                    Voornaam <Required />
                  </>
                }
                placeholder="Bijv. Jan"
                required
              />
              <TextField
                name="lastName"
                label={
                  <>
                    Naam <Required />
                  </>
                }
                placeholder="Bijv. Janssen"
                required
              />
            </div>
          ) : (
            <TextField
              name="teamName"
              label={
                <>
                  Teamnaam/Club <Required />
                </>
              }
              placeholder="Bijv. Caruur Gent Volley"
              required
            />
          )}

          {type === "player_seeks_team" && (
            <TextField
              name="club"
              label={
                <>
                  Clubnaam <Required />
                </>
              }
              placeholder="Bijv. Knack Roeselare"
              required
            />
          )}
          {type === "trainer_seeks_team" && (
            <TextField
              name="club"
              label="Huidige clubnaam (optioneel)"
              placeholder="Bijv. Knack Roeselare"
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              name="gender"
              label={
                <>
                  Dames/Heren <Required />
                </>
              }
              placeholder="Selecteer"
              options={GENDERS}
              required
              onValueChange={setGender}
            />
            {/* Remounts empty when Dames/Heren changes. */}
            <SelectField
              key={gender ?? "none"}
              name="division"
              label={
                <>
                  Niveau <Required />
                </>
              }
              placeholder={
                gender ? "Selecteer niveau" : "Kies eerst Dames/Heren"
              }
              options={divisions}
              required
              disabled={!gender}
            />
          </div>

          {isPlayerAd(type) && (
            <SelectField
              name="position"
              label={
                <>
                  Positie <Required />
                </>
              }
              placeholder="Selecteer positie"
              options={POSITIONS}
              required
            />
          )}
          {type === "trainer_seeks_team" && (
            <SelectField
              name="diploma"
              label={
                <>
                  Diploma <Required />
                </>
              }
              placeholder="Selecteer diploma"
              options={DIPLOMAS}
              required
            />
          )}
          {type === "team_seeks_trainer" && (
            <SelectField
              name="diploma"
              label="Minimaal diploma (optioneel)"
              placeholder="Selecteer diploma"
              options={DIPLOMAS}
            />
          )}

          <SelectField
            name="province"
            label={
              <>
                Provincie <Required />
              </>
            }
            placeholder="Selecteer provincie"
            options={PROVINCES}
            required
          />

          <div className="space-y-2">
            <Label htmlFor="description">
              {isPerson
                ? "Omschrijf hier kort wat je precies zoekt"
                : "Omschrijf hier kort wat jullie precies zoeken"}
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder={
                isPerson
                  ? "Vertel meer over jezelf en wat je zoekt..."
                  : "Vertel meer over je team en wat je zoekt..."
              }
              rows={4}
              maxLength={CLASSIFIED_DESCRIPTION_MAX_LENGTH}
              className={inputClass}
            />
          </div>

          <div className="flex gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              {isPerson
                ? "Je zoekertje is openbaar: iedereen kan je naam, je club en alles wat je hier invult zien."
                : "Je zoekertje is openbaar: iedereen kan de naam van je team en alles wat je hier invult zien."}
            </p>
          </div>
        </>
      )}

      {error && (
        <div
          role="alert"
          className="p-3 bg-destructive/10 border border-destructive rounded-md text-destructive text-sm"
        >
          {error}
        </div>
      )}

      {/* Until hydration a click would submit the fields as a GET (#127). */}
      <Button
        type="submit"
        disabled={pending || !type || !hydrated}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        {pending ? (
          "Bezig met plaatsen..."
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Zoekertje plaatsen
          </>
        )}
      </Button>
    </form>
  );
}
