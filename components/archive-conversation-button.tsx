"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setConversationArchived } from "@/app/actions/messages";
import { handleServerActionResponse } from "@/lib/client-utils";
import { useIsClient } from "@/lib/use-is-client";

interface ArchiveConversationButtonProps {
  conversationId: string;
  otherUserName: string;
  adTitle: string;
  archived: boolean;
}

/**
 * Archive or unarchive a conversation from the inbox, for the current user
 * only (#91, J-07).
 */
export function ArchiveConversationButton({
  conversationId,
  otherUserName,
  adTitle,
  archived,
}: ArchiveConversationButtonProps) {
  const router = useRouter();
  const isClient = useIsClient();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setConversationArchived(conversationId, !archived);
      handleServerActionResponse(result, {
        successMessage: archived
          ? "Gesprek teruggezet naar je inbox"
          : "Gesprek gearchiveerd",
      });
      if (result.success) router.refresh();
    });
  }

  const subject = `gesprek met ${otherUserName} over ${adTitle}`;
  const label = archived
    ? `Zet ${subject} terug naar inbox`
    : `Archiveer ${subject}`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
      aria-label={label}
      title={archived ? "Terugzetten naar inbox" : "Archiveren"}
      disabled={!isClient || pending}
      onClick={toggle}
    >
      {archived ? (
        <ArchiveRestore className="h-4 w-4" aria-hidden />
      ) : (
        <Archive className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
