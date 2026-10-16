"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
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
import { blockUser, unblockUser } from "@/app/actions/messages";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/lib/use-is-client";

interface BlockUserDialogProps {
  userId: string;
  userName: string;
  className?: string;
}

/**
 * "Blokkeren" button in a conversation, with a confirmation (#73, J-07).
 * Reporting is separate ("Melden"); its dialog can block in the same step.
 */
export function BlockUserDialog({
  userId,
  userName,
  className,
}: BlockUserDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // A click before hydration wouldn't open the dialog; keep it off until then.
  const isClient = useIsClient();

  function confirm() {
    startTransition(async () => {
      const result = await blockUser(userId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(`Je hebt ${userName} geblokkeerd`);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("gap-1.5 text-muted-foreground", className)}
        onClick={() => setOpen(true)}
        disabled={!isClient}
        aria-label="Blokkeren"
      >
        <Ban className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Blokkeren</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full">
          <DialogHeader>
            <DialogTitle>{userName} blokkeren?</DialogTitle>
            <DialogDescription>
              Jullie kunnen elkaar dan geen berichten meer sturen en geen nieuw
              gesprek beginnen. {userName} krijgt hier geen bericht over. Je kan
              dit altijd ongedaan maken via je profiel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirm}
              disabled={pending}
            >
              Blokkeer {userName}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface UnblockButtonProps {
  userId: string;
  userName: string;
  className?: string;
}

/** Lifts a block, in a conversation or the profile's block list (#73). */
export function UnblockButton({
  userId,
  userName,
  className,
}: UnblockButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // A click before hydration does nothing; keep the button off until then.
  const isClient = useIsClient();

  function unblock() {
    startTransition(async () => {
      const result = await unblockUser(userId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${userName} is niet meer geblokkeerd`);
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={unblock}
      disabled={pending || !isClient}
      aria-label={`${userName} deblokkeren`}
    >
      Deblokkeren
    </Button>
  );
}
