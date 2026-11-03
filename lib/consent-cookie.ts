// Cookie names shared by the banner and the server (#288, D-054). The
// visitor's cookie choice is a first-party cookie, so it is the same on every
// page and the OAuth callback can read it. Asked again after six months.
export const CONSENT_COOKIE = "vr_cookie_consent";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 182;
// Sets the cookie again from the server: Safari keeps a cookie set by
// JavaScript for only 7 days, and would ask iPhone visitors every week.
export const CONSENT_ROUTE = "/cookie-keuze";

// Set by the OAuth callback when a Google sign-up creates an account and
// the visitor already accepted; the next page sends CompleteRegistration.
export const REGISTRATION_COOKIE = "vr_meta_registratie";

export type Consent = "granted" | "denied";

export function isConsent(value: unknown): value is Consent {
  return value === "granted" || value === "denied";
}

// Runs in <head> before the first paint: marks <html> when a choice is
// stored, so CSS hides the server-rendered banner (globals.css) and returning
// visitors never see it flash.
export const CONSENT_CHOSEN_SCRIPT = `try{if(/(?:^|; )${CONSENT_COOKIE}=(granted|denied)(?:;|$)/.test(document.cookie))document.documentElement.dataset.cookieChoice=""}catch(e){}`;

export function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
