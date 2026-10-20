"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Undo2 } from "lucide-react";
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
import { withdrawRumour } from "@/app/actions/rumour";
import { canEditRumour, canWithdrawRumour } from "@/lib/rumours";
import { useIsClient } from "@/lib/use-is-client";

interface MyRumourActionsProps {
  id: string;
  playerName: string;
  status: string;
}

/**
 * Edit (pending only) and withdraw (pending or lopend) for one of the
 * author's own rumours on their profile (#192, D-042).
 */
export function MyRumourActions({
  id,
  playerName,
  status,
}: MyRumourActionsProps) {
  const router = useRouter();
  const isClient = useIsClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canWithdrawRumour(status)) return null;

  function withdraw() {
    startTransition(async () => {
      const result = await withdrawRumour(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setConfirmOpen(false);
      toast.success("Je gerucht is ingetrokken");
      router.refresh();
    });
  }

  return (
    <div className="mt-1 flex flex-wrap gap-2 px-3">
      {canEditRumour(status) && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/geruchten/${id}/bewerken`}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Bewerken
          </Link>
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
        disabled={!isClient || pending}
      >
        <Undo2 className="h-3.5 w-3.5" aria-hidden />
        Intrekken
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full">
          <DialogHeader>
            <DialogTitle>Gerucht intrekken?</DialogTitle>
            <DialogDescription>
              Je gerucht over {playerName} verdwijnt van de site. Dit kan je
              niet ongedaan maken.{" "}
              {canEditRumour(status)
                ? "Wil je alleen iets verbeteren? Kies dan Bewerken."
                : "Wil je iets verbeteren? Deel dan daarna een nieuw gerucht."}
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
              onClick={withdraw}
              disabled={pending}
            >
              Intrekken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
