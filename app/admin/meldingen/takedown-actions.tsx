"use client";

import { useId, useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  rejectTakedownRequest,
  removeRumourForTakedown,
} from "@/app/actions/takedown";
import { handleServerActionResponse } from "@/lib/client-utils";
import { TAKEDOWN_NOTE_MAX_LENGTH } from "@/lib/takedown";

/** Remove the rumour, or reject the request, for one open takedown request. */
export function TakedownActions({
  requestId,
  reference,
}: {
  requestId: string;
  reference: string;
}) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [decision, setDecision] = useState<"remove" | "reject" | null>(null);
  const [note, setNote] = useState("");

  const noteRequired = decision === "reject";
  const canConfirm = !noteRequired || note.trim().length > 0;

  function confirm(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      if (decision === "remove") {
        handleServerActionResponse(
          await removeRumourForTakedown({ requestId, note }),
          { successMessage: `Gerucht verwijderd (${reference})` },
        );
      } else {
        handleServerActionResponse(
          await rejectTakedownRequest({ requestId, note }),
          { successMessage: `Verzoek ${reference} afgewezen` },
        );
      }
    });
  }

  if (!decision) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" onClick={() => setDecision("remove")}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Gerucht verwijderen
        </Button>
        <Button variant="outline" onClick={() => setDecision("reject")}>
          <X className="h-4 w-4" aria-hidden />
          Verzoek afwijzen
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={confirm}
      className="space-y-3 rounded-md border p-3"
      aria-label={
        decision === "remove"
          ? `Gerucht verwijderen voor ${reference}`
          : `Verzoek ${reference} afwijzen`
      }
    >
      <p className="text-sm">
        {decision === "remove"
          ? "Het gerucht verdwijnt overal; de auteur ziet het als 'Verwijderd' op het eigen profiel. Andere open verzoeken over dit gerucht worden mee afgehandeld."
          : "Het gerucht blijft staan."}
      </p>
      <div className="space-y-1">
        <Label htmlFor={`${id}-note`}>
          Toelichting voor de aanvrager{noteRequired ? "" : " (optioneel)"}
        </Label>
        <Textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={TAKEDOWN_NOTE_MAX_LENGTH}
          required={noteRequired}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant={decision === "remove" ? "destructive" : "default"}
          disabled={pending || !canConfirm}
        >
          {decision === "remove"
            ? "Verwijderen bevestigen"
            : "Afwijzen bevestigen"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDecision(null)}
          disabled={pending}
        >
          Annuleren
        </Button>
      </div>
    </form>
  );
}
