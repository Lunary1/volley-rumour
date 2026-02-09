import { Flame, MessageSquare, Trophy, Search, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CountdownTimer } from "@/components/countdown-timer";
import { WaitlistForm } from "@/components/waitlist-form";
import { getInterestCount } from "@/app/actions/waitlist";
import Link from "next/link";

const FEATURES = [
  {
    icon: Flame,
    title: "Transfer Talk",
    description:
      "Deel en ontdek transfergeruchten in de Belgische volleybalwereld.",
  },
  {
    icon: Search,
    title: "Zoekertjes",
    description: "Vind spelers, trainers of teams via onze marktplaats.",
  },
  {
    icon: Trophy,
    title: "Leaderboard",
    description: "Verdien punten en word een betrouwbare bron in de community.",
  },
  {
    icon: MessageSquare,
    title: "Berichten",
    description: "Neem rechtstreeks contact op met andere leden.",
  },
];

export async function ComingSoonPage() {
  const launchDate =
    process.env.NEXT_PUBLIC_LAUNCH_DATE || "2026-03-15T18:00:00+01:00";
  const interestCount = await getInterestCount();

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-16 sm:py-24 lg:py-32 px-4">
        <div className="mx-auto max-w-3xl text-center space-y-8">
          {/* Brand */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Flame className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              VolleyRumours
            </h1>
          </div>

          {/* Tagline */}
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Dé community voor Belgische volleybal transfers
          </p>

          {/* Countdown */}
          <div className="flex justify-center">
            <CountdownTimer launchDate={launchDate} />
          </div>

          {/* Interest counter */}
          {interestCount > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Al <strong className="text-foreground">
                  {interestCount}+
                </strong>{" "}
                geïnteresseerden!
              </span>
            </p>
          )}

          {/* Waitlist form */}
          <div className="flex justify-center">
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* Feature Preview */}
      <section className="w-full py-12 sm:py-16 px-4 bg-muted/30">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-8">
            Wat je binnenkort kan verwachten
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="border-border/60">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer links (in-page, the layout footer is also present) */}
      <section className="w-full py-8 px-4">
        <div className="mx-auto max-w-3xl flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
          <Link
            href="/privacy"
            className="hover:text-foreground transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/voorwaarden"
            className="hover:text-foreground transition-colors"
          >
            Voorwaarden
          </Link>
          <Link
            href="/over-ons"
            className="hover:text-foreground transition-colors"
          >
            Over Ons
          </Link>
          <Link
            href="/contact"
            className="hover:text-foreground transition-colors"
          >
            Contact
          </Link>
        </div>
      </section>
    </div>
  );
}
