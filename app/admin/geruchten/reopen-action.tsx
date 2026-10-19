"use client";

import { useId, useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reopenRumour } from "@/app/actions/moderation";
import { handleServerActionResponse } from "@/lib/client-utils";
import { useIsClient } from "@/lib/use-is-client";
import { RESOLUTION_NOTE_MAX_LENGTH } from "@/lib/transfers";

/**
 * Reopen a wrongly denied or expired rumour (#150). The reason is required
 * and goes in the log; the database checks the status again.
 */
export function ReopenAction({
  rumourId,
  playerName,
}: {
  rumourId: string;
  playerName: string;
}) {
  const id = useId();
  const isClient = useIsClient();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const response = await reopenRumour({ rumourId, reason });
      handleServerActionResponse(response, {
        successMessage: `Gerucht over ${playerName} is weer lopend`,
      });
    });
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <RotateCcw className="h-4 w-4" aria-hidden />
        Heropenen
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-md border p-3"
      aria-label={`Gerucht over ${playerName} heropenen`}
    >
      <div className="space-y-1">
        <Label htmlFor={`${id}-reason`}>Reden voor het logboek</Label>
        <Textarea
          id={`${id}-reason`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={RESOLUTION_NOTE_MAX_LENGTH}
          required
        />
        <p className="text-xs text-muted-foreground">
          Het gerucht wordt weer lopend: stemmen kan opnieuw en de beslissing
          telt niet meer mee voor de auteur.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={!isClient || pending || reason.trim().length === 0}
        >
          Heropenen bevestigen
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuleren
        </Button>
      </div>
    </form>
  );
}
