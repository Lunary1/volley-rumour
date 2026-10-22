import type { createClient } from "@/lib/supabase/client";

type BrowserClient = ReturnType<typeof createClient>;

// The Supabase browser library is about 200 KB of code. Components that need
// it only after the page is up (the auth listener, the unread badge, Realtime
// vote counts, the report button) load it on demand, so it stays out of the
// first load of every page (#199).
export async function loadClient(): Promise<BrowserClient> {
  const supabase = await import("@/lib/supabase/client");
  return supabase.createClient();
}

// Runs `callback` once the browser is idle after the page has loaded, so
// background work doesn't compete with the first render and hydration.
// Returns a function that cancels it.
export function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 1000);
  return () => window.clearTimeout(id);
}

// Whether the browser holds a Supabase session cookie (`sb-<ref>-auth-token`,
// split into `.0`, `.1` … when long). Without one there is no session to
// listen to, so a logged-out visitor's page needn't load the library (#221).
export function hasSessionCookie(): boolean {
  return /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/.test(document.cookie);
}

// Runs `callback` once any element matching `selector` comes near the screen,
// then when idle: work for content further down waits until the visitor
// scrolls to it (#221). Returns a function that cancels it.
export function whenInView(selector: string, callback: () => void): () => void {
  const elements = document.querySelectorAll(selector);
  if (elements.length === 0 || typeof IntersectionObserver !== "function") {
    return whenIdle(callback);
  }
  let cancelIdle = () => {};
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      cancelIdle = whenIdle(callback);
    },
    { rootMargin: "200px" },
  );
  elements.forEach((element) => observer.observe(element));
  return () => {
    observer.disconnect();
    cancelIdle();
  };
}
