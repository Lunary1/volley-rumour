"use client";

import { useState, useTransition } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { expireOpenRumours } from "@/app/actions/moderation";

/**
 * End of a transfer window: every lopend rumour becomes "Niet bevestigd" at
 * once (#70, D-020). Neutral for the authors' track record (D-005).
 */
export function ExpireAll({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function expire() {
    startTransition(async () => {
      const response = await expireOpenRumours();
      if (!response.success) {
        toast.error(response.error);
        return;
      }
      toast.success(
        response.data === 1
          ? "1 gerucht op niet bevestigd gezet"
          : `${response.data} geruchten op niet bevestigd gezet`,
      );
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Clock className="h-4 w-4" aria-hidden />
        Alle lopende geruchten afsluiten
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alle lopende geruchten afsluiten?</DialogTitle>
            <DialogDescription>
              {count === 1
                ? "Het lopende gerucht krijgt de status “Niet bevestigd”."
                : `Alle ${count} lopende geruchten krijgen de status “Niet bevestigd”.`}{" "}
              Doe dit aan het einde van een transferperiode. Stemmen sluit, en
              het telt niet mee in het trackrecord van de auteurs. Dit kan je
              niet ongedaan maken.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuleren
            </Button>
            <Button variant="destructive" onClick={expire} disabled={pending}>
              Ja, alles afsluiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
