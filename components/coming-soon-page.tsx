import {
  CalendarDays,
  CheckCircle,
  Flame,
  MessageSquare,
  Search,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { CountdownTimer } from "@/components/countdown-timer";
import { WaitlistForm } from "@/components/waitlist-form";
import { Volleyball } from "@/components/coming-soon/volleyball";
import { ZoekertjesBand } from "@/components/coming-soon/zoekertjes-band";
import { RumourWalkthrough } from "@/components/coming-soon/rumour-walkthrough";
import { getInterestCount } from "@/app/actions/waitlist";
import { formatDate } from "@/lib/dates";

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
    icon: CheckCircle,
    title: "Betrouwbare bronnen",
    description:
      "Zie hoe vaak een bijdrager gelijk had: bevestigde geruchten tellen, geen punten.",
  },
  {
    icon: MessageSquare,
    title: "Berichten",
    description: "Neem rechtstreeks contact op met andere leden.",
  },
];

export async function ComingSoonPage() {
  const date =
    process.env.NEXT_PUBLIC_LAUNCH_DATE || "2027-02-15T18:00:00+01:00";
  const interestCount = await getInterestCount();

  return (
    <div className="flex flex-col">
      {/* Hero: text and waitlist beside a volleyball to keep up (#229, #236) */}
      <section className="overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-8 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-24">
          <Volleyball className="mx-auto w-full max-w-56 sm:max-w-72 lg:order-2 lg:max-w-none" />

          <div className="flex flex-col items-center gap-7 text-center lg:items-start lg:text-left">
            <Badge variant="soft" size="pill">
              <CalendarDays />
              Lancering op {formatDate(date, "d MMMM yyyy")}
            </Badge>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
                Dé community voor Belgische volleybaltransfers
              </h1>
              <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
                Geruchten met een bron, bevestigde transfers en zoekertjes voor
                spelers, trainers en clubs. Schrijf je in en hoor als eerste
                wanneer we live gaan.
              </p>
            </div>

            <CountdownTimer launchDate={date} />

            <div className="flex w-full flex-col items-center gap-3 lg:items-start">
              <WaitlistForm />
              {interestCount > 0 && (
                <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  Al{" "}
                  <strong className="text-foreground">
                    {interestCount}+
                  </strong>{" "}
                  geïnteresseerden
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <ZoekertjesBand />

      {/* What's coming: each card rises in as it scrolls into view */}
      <section className="bg-muted/40 py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title="Wat je binnenkort kan verwachten"
            description="Alles over de Belgische volleybalmarkt, op één plek."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="reveal-on-scroll">
                <CardContent className="space-y-3">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary-soft">
                    <feature.icon className="size-5 text-primary-text" />
                  </div>
                  <h3 className="text-card-title font-semibold">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How Transfer Talk works */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title="Zo werkt Transfer Talk"
            description="Geen roddels zonder bron: elk gerucht wordt nagekeken."
          />
          <RumourWalkthrough />
        </div>
      </section>
    </div>
  );
}
