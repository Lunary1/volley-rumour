import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NotFoundPanel } from "@/components/not-found-panel";

/**
 * #90: an ad that was found, expired, removed or never existed. The page's
 * own metadata already says "Zoekertje", so this doesn't set a title.
 */
export default function ClassifiedNotFound() {
  return (
    <NotFoundPanel
      title="Zoekertje niet beschikbaar"
      description="Dit zoekertje bestaat niet of staat niet meer online. Misschien werd het gevonden, is het verlopen of werd het verwijderd."
    >
      <Button asChild>
        <Link href="/zoekertjes">Bekijk alle zoekertjes</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/">Naar de startpagina</Link>
      </Button>
    </NotFoundPanel>
  );
}
