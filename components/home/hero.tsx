import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// The top of the homepage (#240): the question the site answers, the two
// things a visitor can add, and the counts. Its text needs no data, so it is
// in the first HTML the server sends (#211); `stats` and `board` (the
// transfer board) stream in. From lg the board stands beside it.
export function Hero({
  stats,
  board,
}: {
  stats: React.ReactNode;
  board: React.ReactNode;
}) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-16">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-5 lg:pt-4">
          <p className="text-label font-semibold tracking-wide text-muted-foreground uppercase">
            Belgisch volleybal · transfermarkt
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Wie gaat waarheen?
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            Geruchten met een bron, nagekeken door moderators. Bevestigde
            transfers. En zoekertjes voor spelers, trainers en clubs.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/geruchten/nieuw">
                <Plus className="size-5" />
                Gerucht delen
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/zoekertjes/nieuw">Zoekertje plaatsen</Link>
            </Button>
          </div>
          {stats}
        </div>

        <div className="min-w-0 lg:col-span-7">{board}</div>
      </div>
    </section>
  );
}
