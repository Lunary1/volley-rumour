import { REGISTRATION_COOKIE, readCookie } from "@/lib/consent-cookie";

// The Meta Pixel (#288, D-054), so Meta ads can optimise for sign-ups. It
// loads only after "Accepteren" in the cookie banner, and without an ID
// there is no banner and no Pixel. No advanced matching: Meta never gets an
// email address or other form data from us.
//
// Ad blockers block fbevents.js, replace it with a stand-in, or make fbq
// throw. None of that may break a page: every call into Meta's code is
// wrapped, and the site never waits for it.
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let granted = false;

function fbq(...args: unknown[]) {
  try {
    window.fbq?.(...args);
  } catch {
    // A blocker's stand-in for fbq; the page carries on without Meta.
  }
}

/**
 * Meta's base code: a queue that fbevents.js drains when it arrives. The
 * script itself waits until the browser is idle, so the click on
 * "Accepteren" stays quick (INP).
 */
function loadScript(pixelId: string) {
  const queue = function (...args: unknown[]) {
    if (queue.callMethod) queue.callMethod(...args);
    else queue.queue.push(args);
  } as Fbq;
  queue.push = queue;
  queue.loaded = true;
  queue.version = "2.0";
  queue.queue = [];
  window.fbq = queue;
  window._fbq = queue;
  fbq("init", pixelId);

  const inject = () => {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  };
  if ("requestIdleCallback" in window) {
    requestIdleCallback(inject, { timeout: 3000 });
  } else {
    setTimeout(inject, 1000);
  }
}

/** Loads the Pixel once; after a withdrawal and a new "Accepteren", resumes it. */
export function grantMetaPixel(pixelId: string) {
  if (granted) return;
  if (!window.fbq) loadScript(pixelId);
  else fbq("consent", "grant");
  granted = true;
}

/** Stops sending and removes Meta's cookies, after "Weigeren". */
export function revokeMetaPixel() {
  if (!granted) return;
  granted = false;
  fbq("consent", "revoke");
  const host = location.hostname;
  const domains = [host, `.${host}`, `.${host.replace(/^www\./, "")}`];
  for (const name of ["_fbp", "_fbc"]) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}`;
    }
  }
}

export function trackMetaEvent(
  event: "PageView" | "Lead" | "CompleteRegistration",
) {
  if (granted) fbq("track", event);
}

/** A Google sign-up flagged by the OAuth callback, sent once. */
export function trackPendingRegistration() {
  if (readCookie(REGISTRATION_COOKIE) === null) return;
  document.cookie = `${REGISTRATION_COOKIE}=; Max-Age=0; Path=/`;
  trackMetaEvent("CompleteRegistration");
}
