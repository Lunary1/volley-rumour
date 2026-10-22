import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// The top of the homepage. It needs no data, so it is in the first HTML the
// server sends (#211); `aside` (Betrouwbare bronnen) streams in next to it.
export function Hero({ aside }: { aside: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Left: value proposition and the main actions */}
          <div className="lg:col-span-8">
            <p className="mb-3 text-sm font-medium text-primary">
              Community-driven · Belgische volleybal
            </p>
            <h1 className="mb-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
              Het centrum voor{" "}
              <span className="text-primary">transfer talk</span> en
              volleybalnieuws
            </h1>
            <p className="mb-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Wees als eerste op de hoogte. Deel geruchten, bevestig deals en
              bouw je reputatie op als betrouwbare bron.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/geruchten/nieuw">
                  <Plus className="size-5" />
                  Gerucht delen
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/transfers">
                  Bekijk Transfers
                  <ArrowRight className="size-5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Right: Betrouwbare bronnen, above the fold */}
          <div className="lg:col-span-4">{aside}</div>
        </div>
      </div>
    </section>
  );
}
