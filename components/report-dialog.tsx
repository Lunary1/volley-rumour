"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reportContent } from "@/app/actions/reports";
import { createClient } from "@/lib/supabase/client";
import {
  REPORT_EXPLANATION_MAX_LENGTH,
  REPORT_EXPLANATION_MIN_LENGTH,
  reportReasonsFor,
  type ReportTargetType,
} from "@/lib/reports";
import { cn } from "@/lib/utils";

const TITLES: Record<ReportTargetType, string> = {
  rumour: "Gerucht melden",
  classified: "Zoekertje melden",
  conversation: "Gesprek melden",
};

interface ReportDialogProps {
  targetType: ReportTargetType;
  targetId: string;
  /** Rumours: offers the takedown form to the person it is about (#68). */
  takedownHref?: string;
  /** Conversations: the other participant, who can be blocked too (#87). */
  otherUserName?: string;
  className?: string;
  size?: "sm" | "default";
}

/**
 * "Melden" button and dialog for a rumour, zoekertje or conversation (#79,
 * #87). Logged-out visitors go to the login page and come back here. The
 * content stays visible until a moderator decides (D-015).
 */
export function ReportDialog({
  targetType,
  targetId,
  takedownHref,
  otherUserName,
  className,
  size = "sm",
}: ReportDialogProps) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [block, setBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blocked: boolean } | null>(null);

  const reasons = reportReasonsFor(targetType);
  const explanationRequired = reason === "other";

  async function start() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push(`/auth/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setReason("");
    setExplanation("");
    setBlock(false);
    setError(null);
    setDone(null);
    setOpen(true);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!reason) {
      setError("Kies een reden");
      return;
    }
    if (
      explanationRequired &&
      explanation.trim().length < REPORT_EXPLANATION_MIN_LENGTH
    ) {
      setError(
        `Leg in minstens ${REPORT_EXPLANATION_MIN_LENGTH} tekens uit wat er mis is`,
      );
      return;
    }
    startTransition(async () => {
      const result = await reportContent({
        targetType,
        targetId,
        reason,
        explanation,
        block: targetType === "conversation" && block,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDone(result.data);
      if (result.data.blocked) router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={size}
        className={cn("gap-1.5 text-muted-foreground", className)}
        onClick={start}
      >
        <Flag className="h-3.5 w-3.5" aria-hidden />
        Melden
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>{TITLES[targetType]}</DialogTitle>
            <DialogDescription>
              {done
                ? "Een moderator bekijkt je melding zo snel mogelijk."
                : "Een moderator bekijkt je melding. Tot dan blijft alles zichtbaar."}
            </DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="space-y-4">
              <p role="status" className="font-medium">
                Bedankt voor je melding.
                {done.blocked &&
                  ` Je hebt ${otherUserName ?? "deze gebruiker"} geblokkeerd.`}
              </p>
              <DialogFooter>
                <Button type="button" onClick={() => setOpen(false)}>
                  Sluiten
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {takedownHref && (
                <p className="rounded-md border bg-muted/30 p-3 text-sm">
                  Gaat dit gerucht over jou?{" "}
                  <Link
                    href={takedownHref}
                    className="text-primary underline underline-offset-2"
                  >
                    Vraag de verwijdering aan
                  </Link>
                </p>
              )}

              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">
                  Wat is er mis?
                </legend>
                {Object.entries(reasons).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-center gap-3 text-sm"
                  >
                    <input
                      type="radio"
                      name={`${id}-reason`}
                      value={value}
                      checked={reason === value}
                      onChange={() => setReason(value)}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>

              <div className="space-y-1">
                <Label htmlFor={`${id}-explanation`}>
                  Uitleg{explanationRequired ? "" : " (optioneel)"}
                </Label>
                <Textarea
                  id={`${id}-explanation`}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  maxLength={REPORT_EXPLANATION_MAX_LENGTH}
                  // Checked in submit(), so the error is Dutch and in place.
                  aria-required={explanationRequired}
                />
              </div>

              {targetType === "conversation" && (
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={block}
                    onChange={(e) => setBlock(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>
                    Blokkeer ook {otherUserName ?? "deze gebruiker"}, zodat dit
                    gesprek stopt
                  </span>
                </label>
              )}

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Annuleren
                </Button>
                <Button type="submit" disabled={pending}>
                  Melding versturen
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
