"use client";

import { useId, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { approveRumour, rejectRumour } from "@/app/actions/moderation";
import { handleServerActionResponse } from "@/lib/client-utils";
import {
  hasTemplatePlaceholder,
  REJECTION_TEMPLATES,
} from "@/lib/moderation-templates";
import { PlaceholderHint, TemplatePicker } from "@/app/admin/template-picker";
import {
  REJECTION_NOTE_MAX_LENGTH,
  REJECTION_REASONS,
  type RejectionReason,
} from "@/lib/rumours";

const reasons = Object.entries(REJECTION_REASONS) as [
  RejectionReason,
  string,
][];

/** Approve and reject buttons for one pending rumour in the queue. */
export function ModerationActions({
  rumourId,
  playerName,
}: {
  rumourId: string;
  playerName: string;
}) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectionReason | null>(null);
  const [note, setNote] = useState("");

  const noteRequired = reason === "other";
  const canReject =
    !!reason &&
    (!noteRequired || note.trim().length > 0) &&
    !hasTemplatePlaceholder(note);

  function approve() {
    startTransition(async () => {
      handleServerActionResponse(await approveRumour(rumourId), {
        successMessage: `Gerucht over ${playerName} goedgekeurd`,
      });
    });
  }

  function reject(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) return;
    startTransition(async () => {
      handleServerActionResponse(
        await rejectRumour({ rumourId, reason, note }),
        { successMessage: `Gerucht over ${playerName} afgewezen` },
      );
    });
  }

  if (!rejecting) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button onClick={approve} disabled={pending}>
          <Check className="h-4 w-4" aria-hidden />
          Goedkeuren
        </Button>
        <Button
          variant="outline"
          onClick={() => setRejecting(true)}
          disabled={pending}
        >
          <X className="h-4 w-4" aria-hidden />
          Afwijzen
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={reject}
      className="space-y-3 rounded-md border p-3"
      aria-label={`Gerucht over ${playerName} afwijzen`}
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">
          Reden (de auteur ziet deze)
        </legend>
        {reasons.map(([value, label]) => (
          <div key={value} className="flex items-center gap-2">
            <input
              type="radio"
              id={`${id}-${value}`}
              name={`${id}-reason`}
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
              className="h-4 w-4 accent-primary"
            />
            <Label htmlFor={`${id}-${value}`} className="font-normal">
              {label}
            </Label>
          </div>
        ))}
      </fieldset>
      {reason && (
        <TemplatePicker
          templates={REJECTION_TEMPLATES[reason]}
          onPick={setNote}
        />
      )}
      <div className="space-y-1">
        <Label htmlFor={`${id}-note`}>
          Toelichting voor de auteur{noteRequired ? "" : " (optioneel)"}
        </Label>
        <Textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={REJECTION_NOTE_MAX_LENGTH}
          required={noteRequired}
          placeholder={
            reason === "duplicate"
              ? "Over welk gerucht gaat het al?"
              : undefined
          }
        />
        <PlaceholderHint text={note} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="destructive"
          disabled={pending || !canReject}
        >
          Afwijzen bevestigen
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setRejecting(false)}
          disabled={pending}
        >
          Annuleren
        </Button>
      </div>
    </form>
  );
}
