"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessagePanel } from "@/components/ui/message-panel";
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
    <MessagePanel
      icon={TriangleAlert}
      iconClassName="text-destructive-text"
      title="Er ging iets mis"
      description="Deze pagina kon niet geladen worden. Probeer het opnieuw, of kom later terug."
    >
      <Button onClick={reset}>Opnieuw proberen</Button>
      <Button asChild variant="outline">
        <Link href="/">Naar de startpagina</Link>
      </Button>
    </MessagePanel>
  );
}
