"use client";

import { useId, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteTransfer } from "@/app/actions/transfers";
import { handleServerActionResponse } from "@/lib/client-utils";
import { RESOLUTION_NOTE_MAX_LENGTH } from "@/lib/transfers";
import { TransferForm, type TransferFormValues } from "./transfer-form";

const emptyTransfer: TransferFormValues = {
  playerName: "",
  category: null,
  fromClub: "",
  toClub: "",
  division: null,
  confirmedOn: "",
  sourceUrl: "",
};

/** "Transfer toevoegen" and its form, for a transfer without a rumour. */
export function AddTransfer({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Transfer toevoegen
      </Button>
    );
  }
  return (
    <TransferForm
      initial={{ ...emptyTransfer, confirmedOn: today }}
      today={today}
      onDone={() => setOpen(false)}
    />
  );
}

/** Edit and delete for one transfer in the list. */
export function TransferItemActions({
  transferId,
  playerName,
  fromRumour,
  values,
  today,
}: {
  transferId: string;
  playerName: string;
  /** Came from a rumour: deleting puts the rumour back to lopend. */
  fromRumour: boolean;
  values: TransferFormValues;
  today: string;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const response = await deleteTransfer({ transferId, reason });
      handleServerActionResponse(response, {
        successMessage: `Transfer van ${playerName} verwijderd`,
      });
      if (response.success) setConfirmOpen(false);
    });
  }

  if (editing) {
    return (
      <TransferForm
        transferId={transferId}
        initial={values}
        today={today}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" aria-hidden />
          Aanpassen
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Verwijderen
        </Button>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer van {playerName} verwijderen?</DialogTitle>
            <DialogDescription>
              {fromRumour
                ? "Deze transfer komt van een gerucht. Dat gerucht wordt weer lopend, zodat je het opnieuw kan afsluiten."
                : "De transfer verdwijnt van de site."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor={`${id}-reason`}>
              Reden voor het logboek (optioneel)
            </Label>
            <Textarea
              id={`${id}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={RESOLUTION_NOTE_MAX_LENGTH}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Annuleren
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              Ja, verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
