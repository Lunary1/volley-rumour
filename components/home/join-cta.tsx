import Link from "next/link";
import { Button } from "@/components/ui/button";

// The sign-up call to action at the bottom of the homepage.
export function JoinCta() {
  return (
    <section className="border-t border-border py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="mb-4 text-2xl font-bold text-balance sm:text-3xl">
          Doe mee. Verdien vertrouwen. Groei je reputatie.
        </h2>
        <p className="mb-8 leading-relaxed text-muted-foreground">
          Sluit aan bij de volleybalcommunity. Deel insider info, stem op
          geruchten en bouw een track record op met tips die kloppen.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/auth/sign-up">Gratis registreren</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/over-ons">Meer info</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
