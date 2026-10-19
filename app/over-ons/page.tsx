import { pageMetadata } from "@/lib/seo";
import { Flame } from "lucide-react";

export const metadata = pageMetadata({
  title: "Over Ons",
  description:
    "Meer over VolleyRumours en onze missie voor de volleybalcommunity.",
  path: "/over-ons",
});

export default function OverOnsPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="flex items-center gap-3 mb-4">
            <Flame className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Over Ons</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl">
            VolleyRumours is hét platform waar de Belgische volleybalcommunity
            samenkomt om transfers, geruchten en kansen te delen.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Mission */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Onze Missie
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Wij geloven dat volleybal meer is dan alleen sport—het gaat om
            community, passie en verbinding. VolleyRumours is ontstaan met één
            doel: de Belgische volleybalcommunity dichter bij elkaar brengen
            door informatie, transfers en kansen transparant en toegankelijk te
            maken. Wij willen spelers helpen hun ideale team te vinden, clubs
            hun volgende sterspeler te ontdekken, en iedereen op de hoogte te
            houden van wat er gebeurt in onze sport.
          </p>
        </div>

        {/* How It Works */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Hoe VolleyRumours Werkt
          </h2>
          <div className="space-y-6">
            {/* Transfer Talk */}
            <div className="border-l-4 border-primary pl-6">
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                Transfer Talk
              </h3>
              <p className="text-muted-foreground">
                Deel wat je hebt gehoord over transfers en marktbewegingen. De
                community stemt erop en moderators bevestigen of ontkrachten
                geruchten op basis van officiële informatie.
              </p>
            </div>

            {/* Classifieds */}
            <div className="border-l-4 border-accent pl-6">
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                Zoekertjes
              </h3>
              <p className="text-muted-foreground">
                Plaats een advertentie als je een team zoekt, trainers, spelers
                of medespelers. Maak direct contact met geïnteresseerden via ons
                berichtensysteem.
              </p>
            </div>

            {/* Betrouwbare bronnen (#88) */}
            <div className="border-l-4 border-primary pl-6">
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                Betrouwbare bronnen
              </h3>
              <p className="text-muted-foreground">
                Bekijk welke bijdragers het vaakst gelijk hadden: wie minstens 5
                afgeronde geruchten heeft, gerangschikt op het aandeel dat
                bevestigd werd.
              </p>
            </div>

            {/* Conversations */}
            <div className="border-l-4 border-accent pl-6">
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                Privéberichten
              </h3>
              <p className="text-muted-foreground">
                Communiceer veilig met andere gebruikers over transfers en
                zoekertjes. Berichten zijn privé en beveiligd.
              </p>
            </div>
          </div>
        </div>

        {/* Track record (#88, D-005) */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Je track record
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              We zeggen nooit dat een gerucht klopt. We tonen wel hoe vaak een
              bijdrager in het verleden gelijk had, bijvoorbeeld “12 van 15
              bevestigd”.
            </p>
            <div className="bg-card border border-border rounded-lg p-6 space-y-3">
              <div>
                <p className="font-semibold text-foreground mb-1">
                  ✓ Bevestigd of ontkracht
                </p>
                <p className="text-sm">
                  Telt mee zodra een moderator het gerucht afrondt op basis van
                  een officiële bron.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">
                  – Niet bevestigd
                </p>
                <p className="text-sm">
                  Geruchten die niet bevestigd en niet ontkracht raakten, tellen
                  niet mee.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Stemmen</p>
                <p className="text-sm">
                  Tonen wat de community denkt, maar tellen niet mee voor
                  iemands track record.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Community Values */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Onze Waarden
          </h2>
          <div className="grid gap-4">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-2">
                🤝 Community First
              </h3>
              <p className="text-muted-foreground text-sm">
                Alles draait om elkaar helpen. Moderatie is transparent, eerlijk
                en verstandig.
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-2">
                💯 Eerlijkheid
              </h3>
              <p className="text-muted-foreground text-sm">
                Misinformatie en bedrog zijn niet welkom. Laten we
                marktbewegingen eerlijk discussiëren.
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-2">
                🏐 Voor Volleyballiefhebbers
              </h3>
              <p className="text-muted-foreground text-sm">
                VolleyRumours is gebouwd door volleyballiefhebbers, voor
                volleyballiefhebbers.
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-2">
                🚀 Altijd Evoluerend
              </h3>
              <p className="text-muted-foreground text-sm">
                We luisteren naar community-feedback en voegen regelmatig
                functies toe.
              </p>
            </div>
          </div>
        </div>

        {/* Future */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Wat Komt Eraan?
          </h2>
          <p className="text-muted-foreground">
            We hebben grote plannen voor VolleyRumours! Volg ons op updates
            voor:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2 mt-4 text-muted-foreground">
            <li>Geavanceerde zoek- en filterfuncties</li>
            <li>Community-voting over roadmap-functies (binnenkort!)</li>
            <li>Verbeterde mobiele app-ervaring</li>
            <li>Partnerships met volleybalclubs en organisaties</li>
            <li>Meer community-functies en engagement-tools</li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Contacteer Ons
          </h2>
          <p className="text-muted-foreground">
            Heb je vragen, suggesties, of wil je samenwerken? Neem contact met
            ons op via ons{" "}
            <a
              href="/contact"
              className="text-primary hover:underline font-medium"
            >
              contactformulier
            </a>
            . We kijken uit naar je feedback!
          </p>
        </div>
      </section>
    </div>
  );
}
