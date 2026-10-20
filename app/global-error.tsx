"use client";

import "./globals.css";
import { useReportError } from "@/lib/use-report-error";

/**
 * Shown when the root layout itself crashes (the header, for instance), so
 * app/error.tsx can't render. It replaces the whole page, so it brings its
 * own <html>. Reported like any other error (#186).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useReportError(error);

  return (
    <html lang="nl">
      <body className="bg-background text-foreground">
        <main className="flex min-h-screen items-center justify-center px-4 py-16">
          <div className="max-w-md text-center">
            <h1 className="mb-3 text-2xl font-bold">Er ging iets mis</h1>
            <p className="mb-6 text-muted-foreground">
              VolleyRumours kon niet geladen worden. Probeer het opnieuw, of kom
              later terug.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={reset}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Opnieuw proberen
              </button>
              {/* A full page load: the layout that crashed has to start over. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                className="rounded-md border px-4 py-2 text-sm font-medium"
              >
                Naar de startpagina
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
