"use client";

import { useId, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { handleContactMessage } from "@/app/actions/contact";
import { handleServerActionResponse } from "@/lib/client-utils";
import { CONTACT_NOTE_MAX_LENGTH } from "@/lib/contact";
import { useIsClient } from "@/lib/use-is-client";

/** Mark one open contact message as handled, with an optional note. */
export function ContactActions({ messageId }: { messageId: string }) {
  const id = useId();
  // A click before hydration would be lost (#80).
  const hydrated = useIsClient();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  function confirm(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      handleServerActionResponse(
        await handleContactMessage({ messageId, note }),
        { successMessage: "Bericht afgehandeld" },
      );
    });
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={!hydrated}
      >
        <Check className="h-4 w-4" aria-hidden />
        Afgehandeld
      </Button>
    );
  }

  return (
    <form
      onSubmit={confirm}
      className="space-y-3 rounded-md border p-3"
      aria-label="Bericht afhandelen"
    >
      <div className="space-y-1">
        <Label htmlFor={`${id}-note`}>Interne notitie (optioneel)</Label>
        <Textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={CONTACT_NOTE_MAX_LENGTH}
          placeholder="Bijvoorbeeld: beantwoord per mail."
        />
        <p className="text-xs text-muted-foreground">
          Alleen voor beheer; de afzender ziet dit niet.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          Afhandelen bevestigen
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
