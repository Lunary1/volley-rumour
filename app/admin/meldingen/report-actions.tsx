"use client";

import { useId, useState, useTransition } from "react";
import { Check, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { closeReport, removeReportedContent } from "@/app/actions/reports";
import { handleServerActionResponse } from "@/lib/client-utils";
import { REPORT_NOTE_MAX_LENGTH, type ReportTargetType } from "@/lib/reports";

type Decision = "remove" | "dismiss" | "action";

const DECISIONS: Record<
  Decision,
  { explain: string; noteLabel: string; confirm: string; success: string }
> = {
  remove: {
    explain:
      "De inhoud verdwijnt overal; de auteur ziet ze als 'Verwijderd' op het eigen profiel, met je toelichting. Andere open meldingen hierover worden mee afgehandeld.",
    noteLabel: "Toelichting voor de auteur (optioneel)",
    confirm: "Verwijderen bevestigen",
    success: "Inhoud verwijderd",
  },
  dismiss: {
    explain:
      "Alles blijft staan. Andere open meldingen hierover worden mee afgesloten.",
    noteLabel: "Interne notitie (optioneel)",
    confirm: "Afsluiten zonder actie",
    success: "Melding afgesloten",
  },
  action: {
    explain:
      "Noteer wat je deed, bijvoorbeeld een waarschuwing per e-mail of een schorsing. Een beheerder schorst via de gebruiker hierboven.",
    noteLabel: "Welke maatregel nam je?",
    confirm: "Maatregel bevestigen",
    success: "Melding afgesloten",
  },
};

/** The moderator's decision on one open report. */
export function ReportActions({
  reportId,
  targetType,
}: {
  reportId: string;
  targetType: ReportTargetType;
}) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");

  const noteRequired = decision === "action";
  const canConfirm = !noteRequired || note.trim().length > 0;

  function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!decision) return;
    startTransition(async () => {
      const result =
        decision === "remove"
          ? await removeReportedContent({ reportId, note })
          : await closeReport({
              reportId,
              outcome: decision === "action" ? "action_taken" : "dismissed",
              note,
            });
      handleServerActionResponse(result, {
        successMessage: DECISIONS[decision].success,
      });
    });
  }

  if (!decision) {
    return (
      <div className="flex flex-wrap gap-2">
        {targetType === "conversation" ? (
          <Button variant="destructive" onClick={() => setDecision("action")}>
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Maatregel genomen
          </Button>
        ) : (
          <Button variant="destructive" onClick={() => setDecision("remove")}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Inhoud verwijderen
          </Button>
        )}
        <Button variant="outline" onClick={() => setDecision("dismiss")}>
          <Check className="h-4 w-4" aria-hidden />
          Geen actie
        </Button>
      </div>
    );
  }

  const copy = DECISIONS[decision];
  return (
    <form
      onSubmit={confirm}
      className="space-y-3 rounded-md border p-3"
      aria-label={copy.confirm}
    >
      <p className="text-sm">{copy.explain}</p>
      <div className="space-y-1">
        <Label htmlFor={`${id}-note`}>{copy.noteLabel}</Label>
        <Textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={REPORT_NOTE_MAX_LENGTH}
          required={noteRequired}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant={decision === "dismiss" ? "default" : "destructive"}
          disabled={pending || !canConfirm}
        >
          {copy.confirm}
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
