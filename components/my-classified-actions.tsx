"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteClassified,
  renewClassified,
  setClassifiedActive,
} from "@/app/actions/classifieds";
import { classifiedLastDay } from "@/lib/classifieds-utils";

interface MyClassifiedActionsProps {
  id: string;
  title: string;
  isActive: boolean;
  /** Past its expiry date (#84): renewing replaces "gevonden"/back online. */
  isExpired: boolean;
  /** A moderator removed it (#69): it can only be deleted. */
  isRemoved: boolean;
}

/**
 * Edit, "gevonden" / back online and delete for one of the user's own
 * zoekertjes in "Mijn zoekertjes" (#72, J-05, J-08).
 */
export function MyClassifiedActions({
  id,
  title,
  isActive,
  isExpired,
  isRemoved,
}: MyClassifiedActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      const result = await setClassifiedActive(id, !isActive);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        isActive
          ? "Gemarkeerd als gevonden. Je zoekertje staat niet meer in de lijst."
          : "Je zoekertje staat weer online",
      );
      router.refresh();
    });
  }

  function renew() {
    startTransition(async () => {
      const result = await renewClassified(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Je zoekertje staat weer online tot ${classifiedLastDay(result.data.expiresAt)}`,
      );
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteClassified(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setConfirmOpen(false);
      toast.success("Je zoekertje is verwijderd");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!isRemoved && (
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/zoekertjes/${id}/bewerken`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Bewerken
            </Link>
          </Button>
          {isExpired ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={renew}
              disabled={pending}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Verlengen
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleActive}
              disabled={pending}
            >
              {isActive ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Gevonden
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Weer online zetten
                </>
              )}
            </Button>
          )}
        </>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Verwijderen
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full">
          <DialogHeader>
            <DialogTitle>Zoekertje verwijderen?</DialogTitle>
            <DialogDescription>
              &ldquo;{title}&rdquo; wordt definitief verwijderd. Je gesprekken
              erover blijven bewaard. Heb je gevonden wat je zocht? Dan kan je
              het ook als gevonden markeren.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={remove}
              disabled={pending}
            >
              Definitief verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
