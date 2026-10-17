"use client";

import { useId, useState, useTransition } from "react";
import { Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resolveRumour } from "@/app/actions/moderation";
import { handleServerActionResponse } from "@/lib/client-utils";
import { useIsClient } from "@/lib/use-is-client";
import { SOURCE_URL_MAX_LENGTH } from "@/lib/rumours";
import {
  RESOLUTION_NOTE_MAX_LENGTH,
  TRANSFER_CATEGORIES,
  defaultTransferCategory,
  transferCategoriesFor,
  type TransferCategory,
} from "@/lib/transfers";

type Outcome = "confirmed" | "denied" | "expired";

const submitLabels: Record<Outcome, string> = {
  confirmed: "Bevestigen en transfer aanmaken",
  denied: "Ontkrachten bevestigen",
  expired: "Op niet bevestigd zetten",
};

const formLabels: Record<Outcome, string> = {
  confirmed: "bevestigen",
  denied: "ontkrachten",
  expired: "op niet bevestigd zetten",
};

const successLabels: Record<Outcome, string> = {
  confirmed: "bevestigd, de transfer staat online",
  denied: "ontkracht",
  expired: "op niet bevestigd gezet",
};

/**
 * Confirm, deny or expire one lopend rumour (#70, D-020). Confirming needs an
 * official source and the transfer's type; the database checks both.
 */
export function ResolveActions({
  rumourId,
  playerName,
  category,
  gender,
}: {
  rumourId: string;
  playerName: string;
  category: string;
  gender: string | null;
}) {
  const id = useId();
  const isClient = useIsClient();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [transferCategory, setTransferCategory] =
    useState<TransferCategory | null>(
      defaultTransferCategory(category, gender),
    );
  const [sourceUrl, setSourceUrl] = useState("");
  const [note, setNote] = useState("");

  const categories = transferCategoriesFor(category);
  const canSubmit =
    outcome === "confirmed"
      ? !!transferCategory && sourceUrl.trim().length > 0
      : outcome !== null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!outcome) return;
    startTransition(async () => {
      const response = await resolveRumour(
        outcome === "confirmed"
          ? {
              outcome,
              rumourId,
              category: transferCategory!,
              sourceUrl,
              note,
            }
          : outcome === "denied"
            ? { outcome, rumourId, sourceUrl, note }
            : { outcome, rumourId, note },
      );
      handleServerActionResponse(response, {
        successMessage: `Gerucht over ${playerName} ${successLabels[outcome]}`,
      });
    });
  }

  if (!outcome) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOutcome("confirmed")}>
          <Check className="h-4 w-4" aria-hidden />
          Bevestigen
        </Button>
        <Button variant="outline" onClick={() => setOutcome("denied")}>
          <X className="h-4 w-4" aria-hidden />
          Ontkrachten
        </Button>
        <Button variant="outline" onClick={() => setOutcome("expired")}>
          <Clock className="h-4 w-4" aria-hidden />
          Niet bevestigd
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-md border p-3"
      aria-label={`Gerucht over ${playerName} ${formLabels[outcome]}`}
    >
      {outcome === "confirmed" && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Soort transfer</legend>
          {categories.map((value) => (
            <div key={value} className="flex items-center gap-2">
              <input
                type="radio"
                id={`${id}-${value}`}
                name={`${id}-category`}
                value={value}
                checked={transferCategory === value}
                onChange={() => setTransferCategory(value)}
                className="h-4 w-4 accent-primary"
              />
              <Label htmlFor={`${id}-${value}`} className="font-normal">
                {TRANSFER_CATEGORIES[value]}
              </Label>
            </div>
          ))}
        </fieldset>
      )}
      {outcome !== "expired" && (
        <div className="space-y-1">
          <Label htmlFor={`${id}-source`}>
            {outcome === "confirmed"
              ? "Link naar de officiële bron (club, federatie of pers)"
              : "Link naar de bron (optioneel)"}
          </Label>
          <Input
            id={`${id}-source`}
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            maxLength={SOURCE_URL_MAX_LENGTH}
            required={outcome === "confirmed"}
            placeholder="https://"
          />
          <p className="text-xs text-muted-foreground">
            Iedereen ziet deze link bij het gerucht.
          </p>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor={`${id}-note`}>
          Toelichting voor het logboek (optioneel)
        </Label>
        <Textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={RESOLUTION_NOTE_MAX_LENGTH}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant={outcome === "confirmed" ? "default" : "destructive"}
          disabled={!isClient || pending || !canSubmit}
        >
          {submitLabels[outcome]}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOutcome(null)}
          disabled={pending}
        >
          Annuleren
        </Button>
      </div>
    </form>
  );
}
