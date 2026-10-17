"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTransfer,
  updateTransfer,
  type TransferInput,
} from "@/app/actions/transfers";
import { handleServerActionResponse } from "@/lib/client-utils";
import { useIsClient } from "@/lib/use-is-client";
import {
  RUMOUR_DIVISIONS,
  SOURCE_URL_MAX_LENGTH,
  type RumourDivision,
} from "@/lib/rumours";
import {
  CLUB_NAME_MAX_LENGTH,
  TRANSFER_CATEGORIES,
  TRANSFER_CATEGORY_KEYS,
  TRANSFER_NAME_MAX_LENGTH,
  isRetirement,
  type TransferCategory,
} from "@/lib/transfers";

const NO_DIVISION = "none";

export interface TransferFormValues {
  playerName: string;
  category: TransferCategory | null;
  fromClub: string;
  toClub: string;
  division: RumourDivision | null;
  /** YYYY-MM-DD */
  confirmedOn: string;
  sourceUrl: string;
}

/**
 * Add a transfer, or correct one when `transferId` is given (#70, J-14).
 * Every transfer needs an official source (D-020).
 */
export function TransferForm({
  transferId,
  initial,
  today,
  onDone,
}: {
  transferId?: string;
  initial: TransferFormValues;
  /** Today in Belgium, the latest date a transfer can have. */
  today: string;
  onDone: () => void;
}) {
  const id = useId();
  const isClient = useIsClient();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);
  const set = <K extends keyof TransferFormValues>(
    key: K,
    value: TransferFormValues[K],
  ) => setValues((v) => ({ ...v, [key]: value }));

  const retirement = !!values.category && isRetirement(values.category);
  const editing = !!transferId;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.category) return;
    const input: TransferInput = {
      ...values,
      category: values.category,
      toClub: retirement ? "" : values.toClub,
    };
    startTransition(async () => {
      const response = editing
        ? await updateTransfer(transferId, input)
        : await createTransfer(input);
      handleServerActionResponse(response, {
        successMessage: editing
          ? `Transfer van ${values.playerName.trim()} aangepast`
          : `Transfer van ${values.playerName.trim()} toegevoegd`,
      });
      if (response.success) onDone();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-md border p-3"
      aria-label={editing ? "Transfer aanpassen" : "Transfer toevoegen"}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-name`}>Naam</Label>
          <Input
            id={`${id}-name`}
            value={values.playerName}
            onChange={(e) => set("playerName", e.target.value)}
            maxLength={TRANSFER_NAME_MAX_LENGTH}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-date`}>Bevestigd op</Label>
          <Input
            id={`${id}-date`}
            type="date"
            value={values.confirmedOn}
            max={today}
            onChange={(e) => set("confirmedOn", e.target.value)}
            required
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Soort transfer</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {TRANSFER_CATEGORY_KEYS.map((value) => (
            <div key={value} className="flex items-center gap-2">
              <input
                type="radio"
                id={`${id}-${value}`}
                name={`${id}-category`}
                value={value}
                checked={values.category === value}
                onChange={() => set("category", value)}
                className="h-4 w-4 accent-primary"
              />
              <Label htmlFor={`${id}-${value}`} className="font-normal">
                {TRANSFER_CATEGORIES[value]}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-from`}>
            {retirement ? "Club" : "Vorige club"} (optioneel)
          </Label>
          <Input
            id={`${id}-from`}
            value={values.fromClub}
            onChange={(e) => set("fromClub", e.target.value)}
            maxLength={CLUB_NAME_MAX_LENGTH}
          />
        </div>
        {!retirement && (
          <div className="space-y-1">
            <Label htmlFor={`${id}-to`}>Nieuwe club</Label>
            <Input
              id={`${id}-to`}
              value={values.toClub}
              onChange={(e) => set("toClub", e.target.value)}
              maxLength={CLUB_NAME_MAX_LENGTH}
              required
            />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${id}-division`}>Reeks (optioneel)</Label>
        <Select
          value={values.division ?? NO_DIVISION}
          onValueChange={(v) =>
            set("division", v === NO_DIVISION ? null : (v as RumourDivision))
          }
        >
          <SelectTrigger id={`${id}-division`} className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DIVISION}>Geen reeks</SelectItem>
            {Object.entries(RUMOUR_DIVISIONS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${id}-source`}>
          Link naar de officiële bron (club, federatie of pers)
        </Label>
        <Input
          id={`${id}-source`}
          type="url"
          inputMode="url"
          value={values.sourceUrl}
          onChange={(e) => set("sourceUrl", e.target.value)}
          maxLength={SOURCE_URL_MAX_LENGTH}
          placeholder="https://"
          required
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={!isClient || pending || !values.category}
        >
          {editing ? "Wijzigingen opslaan" : "Transfer toevoegen"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onDone}
          disabled={pending}
        >
          Annuleren
        </Button>
      </div>
    </form>
  );
}
