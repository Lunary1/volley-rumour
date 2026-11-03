"use client";

import { useSyncExternalStore } from "react";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  CONSENT_ROUTE,
  isConsent,
  readCookie,
  type Consent,
} from "@/lib/consent-cookie";

// The cookie banner's state (#288, D-054); the cookie itself is in
// lib/consent-cookie.ts.
let reopened = false;
// With cookies blocked, the choice holds for this visit, so the banner
// doesn't come back on every page.
let remembered: Consent | null = null;
const listeners = new Set<() => void>();

function readConsent(): Consent | null {
  const value = readCookie(CONSENT_COOKIE);
  return isConsent(value) ? value : remembered;
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function setConsent(consent: Consent) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${consent}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  remembered = consent;
  reopened = false;
  notify();
  // Best effort: without it the cookie above still holds the choice.
  fetch(CONSENT_ROUTE, {
    method: "POST",
    body: consent,
    keepalive: true,
  }).catch(() => {});
}

/** "Cookie-instellingen" in the footer: show the banner again. */
export function reopenConsent() {
  reopened = true;
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// A string, so React sees an unchanged snapshot as equal.
function snapshot() {
  return `${readConsent() ?? "none"}|${reopened ? "open" : "closed"}`;
}

/**
 * The stored choice, and whether the banner shows: on a first visit, after
 * six months, or when the visitor reopens it. Null while server rendering.
 */
export function useConsent(): {
  consent: Consent | null;
  bannerOpen: boolean;
} | null {
  const value = useSyncExternalStore(subscribe, snapshot, () => null);
  if (value === null) return null;
  const [consent, open] = value.split("|");
  return {
    consent: consent === "none" ? null : (consent as Consent),
    bannerOpen: consent === "none" || open === "open",
  };
}
