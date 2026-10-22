"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { getExistingConversation } from "@/app/actions/messages";
import { buttonVariants } from "@/components/ui/button";

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
  /** Featured cards get the larger, green button; others an outline one. */
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
        className={buttonVariants({
          variant: featured ? "default" : "outline",
          size: featured ? "xl" : "default",
        })}
      >
        <MessageSquare aria-hidden />
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
