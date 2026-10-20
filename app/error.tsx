"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReportError } from "@/lib/use-report-error";

/**
 * #90: a page that crashes shows this instead of Next's English
 * "Application error". The header and footer stay, so the visitor can
 * navigate away. Browser errors are reported for /admin/fouten (#186).
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useReportError(error);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4 py-16">
      <div className="max-w-md text-center">
        <TriangleAlert
          className="mx-auto mb-4 h-12 w-12 text-destructive"
          aria-hidden="true"
        />
        <h1 className="mb-3 text-2xl font-bold text-foreground">
          Er ging iets mis
        </h1>
        <p className="mb-6 text-muted-foreground">
          Deze pagina kon niet geladen worden. Probeer het opnieuw, of kom later
          terug.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset}>Opnieuw proberen</Button>
          <Button asChild variant="outline">
            <Link href="/">Naar de startpagina</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
