"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/share-button";
import { SITE_URL } from "@/lib/site-url";

// Shown right after a waitlist sign-up (#238): the moment someone is most
// willing to pass the site on to their team. The link carries
// utm_source=wachtlijst, so Vercel Web Analytics counts the visits these
// shares bring. The visitor shares it themselves; nothing leaves the site.
export const WAITLIST_SHARE_URL = `${SITE_URL}/?utm_source=wachtlijst`;
const MESSAGE =
  "Binnenkort: volleyrumours.be, transfergeruchten met bron en zoekertjes voor het Belgische volleybal. Schrijf je in voor de lancering:";

export function WaitlistShare() {
  const [copied, setCopied] = useState(false);
  // Only rendered after a sign-up, so this never runs on the server.
  const canShare = typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(WAITLIST_SHARE_URL);
      setCopied(true);
      toast.success("Link gekopieerd");
    } catch {
      toast.error("Kopiëren mislukt");
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: "VolleyRumours",
        text: MESSAGE,
        url: WAITLIST_SHARE_URL,
      });
    } catch {
      // Cancelled by the visitor.
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 lg:items-start">
      <p className="text-sm text-muted-foreground">
        Ken je spelers, trainers of clubs die dit moeten weten? Deel het met je
        ploeg.
      </p>
      <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
        <Button asChild>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${MESSAGE} ${WAITLIST_SHARE_URL}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon className="size-4" />
            Deel via WhatsApp
          </a>
        </Button>
        <Button variant="outline" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Gekopieerd" : "Kopieer link"}
        </Button>
        {canShare && (
          <Button variant="outline" onClick={share}>
            <Share2 />
            Andere app
          </Button>
        )}
      </div>
    </div>
  );
}
