"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRumourVotes } from "@/components/rumour-votes";
import type { RumourForModal } from "@/components/rumour-detail-modal";

// The dialog's code loads when it is first wanted, not with the page (#200).
const loadModal = () => import("@/components/rumour-detail-modal");
const RumourDetailModal = dynamic(
  () => loadModal().then((module) => module.RumourDetailModal),
  { ssr: false },
);

interface RumourDetailButtonProps {
  rumour: RumourForModal;
  /** Why the user can't vote on this rumour, if so (#78). */
  closedReason: string | null;
}

/** "Bekijk meer" on a rumour card, and the detail dialog it opens. */
export function RumourDetailButton({
  rumour,
  closedReason,
}: RumourDetailButtonProps) {
  const { up, down, userVote, isVoting, vote } = useRumourVotes(rumour.id);
  const [open, setOpen] = useState(false);
  const [wanted, setWanted] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-primary hover:text-primary/90"
        // Start loading the dialog as soon as the user heads for the button.
        onPointerEnter={loadModal}
        onFocus={loadModal}
        onClick={() => {
          setWanted(true);
          setOpen(true);
        }}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Bekijk meer
      </Button>
      {wanted && (
        <RumourDetailModal
          rumour={rumour}
          open={open}
          onOpenChange={setOpen}
          votes={{ up, down }}
          userVote={userVote}
          onVote={(_id, voteType) => vote(voteType)}
          isVoting={isVoting}
          votingClosedReason={closedReason}
        />
      )}
    </>
  );
}
