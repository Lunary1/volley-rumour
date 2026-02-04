"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { getExistingConversation } from "@/app/actions/messages";
import { ContactModal } from "@/components/contact-modal";

interface ClassifiedDetailContactProps {
  classifiedId: string;
  userId: string;
  userName: string;
}

export function ClassifiedDetailContact({
  classifiedId,
  userId,
  userName,
}: ClassifiedDetailContactProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleContactClick() {
    setLoading(true);
    try {
      const result = await getExistingConversation(classifiedId, userId);
      if (result.success && result.data?.conversationId) {
        router.push(`/messages/${result.data.conversationId}`);
        return;
      }
      setShowModal(true);
    } catch (err) {
      console.error("Error checking conversation:", err);
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={handleContactClick}
        disabled={loading}
        className="bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        Contact opnemen
      </Button>
      {showModal && (
        <ContactModal
          userId={userId}
          userName={userName}
          adId={classifiedId}
          adType="classified"
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
