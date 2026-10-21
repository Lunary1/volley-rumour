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
