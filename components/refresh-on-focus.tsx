"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders the current server page when the window regains focus, so a
 * list fetched on the server (e.g. conversations) catches up after the user
 * comes back from another tab.
 */
export function RefreshOnFocus() {
  const router = useRouter();

  useEffect(() => {
    const handleFocus = () => router.refresh();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [router]);

  return null;
}
