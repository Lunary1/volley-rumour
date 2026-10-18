import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NotFoundPanel } from "@/components/not-found-panel";

export const metadata: Metadata = {
  title: "Pagina niet gevonden - VolleyRumours",
};

/**
 * #90: every `notFound()` and unknown URL lands here instead of Next's
 * English 404. Kept generic on purpose: /admin returns it to non-staff and
 * mustn't advertise itself.
 */
export default function NotFound() {
  return (
    <NotFoundPanel
      title="Pagina niet gevonden"
      description="Deze pagina bestaat niet of is niet meer beschikbaar. Misschien werd ze verwijderd, of klopt de link niet."
    >
      <Button asChild>
        <Link href="/">Naar de startpagina</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/zoekertjes">Bekijk de zoekertjes</Link>
      </Button>
    </NotFoundPanel>
  );
}
