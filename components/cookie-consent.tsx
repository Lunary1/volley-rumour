"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { reopenConsent, setConsent, useConsent } from "@/lib/consent";
import {
  META_PIXEL_ID,
  grantMetaPixel,
  revokeMetaPixel,
  trackMetaEvent,
  trackPendingRegistration,
} from "@/lib/meta-pixel";

/**
 * The cookie banner and the Meta Pixel behind it (#288, D-054). Nothing of
 * Meta's loads before "Accepteren"; refusing is one click, like accepting,
 * with a button that looks the same.
 */
export function CookieConsent() {
  const state = useConsent();
  const pathname = usePathname();
  const consent = state?.consent ?? null;

  useEffect(() => {
    if (!META_PIXEL_ID) return;
    if (consent === "granted") {
      grantMetaPixel(META_PIXEL_ID);
      trackMetaEvent("PageView");
      trackPendingRegistration();
    } else {
      revokeMetaPixel();
    }
  }, [consent, pathname]);

  // The server sends the banner to everyone, so it paints with the page: a
  // banner that appears only after hydration became the LCP element on
  // phones (+0.5–0.75 s). For a visitor who already chose,
  // CONSENT_CHOSEN_SCRIPT hides it before the first paint, and hydration
  // removes it.
  if (!META_PIXEL_ID || (state !== null && !state.bannerOpen)) return null;

  return (
    <section
      data-cookie-banner={state === null ? "server" : "open"}
      aria-label="Cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border-strong bg-card shadow-lg"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-4 md:py-4 lg:px-8">
        <p className="text-sm text-muted-foreground md:max-w-3xl">
          <strong className="font-semibold text-foreground">
            Wij gebruiken cookies
          </strong>{" "}
          We gebruiken cookies die nodig zijn om de site te laten werken. Met je
          toestemming plaatsen we ook cookies van Meta om onze advertenties te
          meten. Je kan je keuze altijd wijzigen via Cookie-instellingen. Lees
          meer in ons{" "}
          <Link
            href="/privacy#cookies"
            className="underline hover:text-foreground"
          >
            privacybeleid
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            className="flex-1 md:flex-none"
            onClick={() => setConsent("denied")}
          >
            Weigeren
          </Button>
          <Button
            variant="outline"
            className="flex-1 md:flex-none"
            onClick={() => setConsent("granted")}
          >
            Accepteren
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Footer link that reopens the banner, to change or withdraw consent. */
export function CookieSettingsButton() {
  if (!META_PIXEL_ID) return null;
  return (
    <button
      type="button"
      onClick={reopenConsent}
      className="hover:text-foreground transition-colors"
    >
      Cookie-instellingen
    </button>
  );
}
