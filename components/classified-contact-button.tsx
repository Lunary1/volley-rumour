"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { getExistingConversation } from "@/app/actions/messages";
import { cn } from "@/lib/utils";

// The message form loads when it is first wanted, not with the list (#200).
const ContactModal = dynamic(
  () =>
    import("@/components/contact-modal").then((module) => module.ContactModal),
  { ssr: false },
);

interface ClassifiedContactButtonProps {
  classifiedId: string;
  userId: string;
  userName: string;
  /** Featured cards get the larger button. */
  featured?: boolean;
}

/**
 * "Contact" on a card in the zoekertjes list: opens the existing
 * conversation about the ad, or the form to start one.
 */
export function ClassifiedContactButton({
  classifiedId,
  userId,
  userName,
  featured = false,
}: ClassifiedContactButtonProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [showModal, setShowModal] = useState(false);

  async function handleClick() {
    setChecking(true);
    try {
      const result = await getExistingConversation(classifiedId, userId);
      if (result.success && result.data?.conversationId) {
        router.push(`/messages/${result.data.conversationId}`);
      } else {
        setShowModal(true);
      }
    } catch (err) {
      console.error("Error checking conversation:", err);
      setShowModal(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={checking}
        className={cn(
          "w-full font-semibold text-primary-foreground text-sm bg-primary hover:bg-primary/90 transition-all duration-150 flex items-center justify-center gap-2",
          featured
            ? "mt-6 px-4 py-3 rounded-xl group-hover:shadow-md"
            : "px-3 py-2 rounded-lg mt-auto",
        )}
      >
        <MessageSquare className={featured ? "h-4 w-4" : "h-3.5 w-3.5"} />
        {featured ? "Contact opnemen" : "Contact"}
      </button>
      {showModal && (
        <ContactModal
          userId={userId}
          userName={userName}
          adId={classifiedId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
