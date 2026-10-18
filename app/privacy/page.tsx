import { Metadata } from "next";
import Link from "next/link";
import { isComingSoon } from "@/lib/coming-soon";

export const metadata: Metadata = {
  title: "Privacybeleid - VolleyRumours",
  description: "Lees ons privacybeleid en hoe wij jouw gegevens beschermen.",
};

// Every service that receives personal data (#77). Datadog was removed in
// D-023. Copy to be reviewed in #94.
const processors = [
  {
    name: "Supabase",
    purpose:
      "Onze database: je account, profiel, geruchten, zoekertjes, berichten, en de live berichten in gesprekken. In Supabase Storage bewaren we ook de profielfoto die je zelf uploadt. De servers staan in de EU (Parijs).",
  },
  {
    name: "Vercel",
    purpose:
      "Host de website en ontvangt daarvoor je IP-adres en browsergegevens. Vercel Web Analytics en Speed Insights tellen bezoeken en meten laadtijden, zonder cookies en zonder je IP-adres te bewaren.",
  },
  {
    name: "Resend",
    purpose:
      "Verstuurt e-mails over je account, zoals de bevestiging van je e-mailadres of een link voor een nieuw wachtwoord, en meldingen van een nieuw bericht of een beslissing over je gerucht. Resend krijgt je e-mailadres en de inhoud van die e-mail; een melding bevat nooit de tekst van een bericht of gerucht.",
  },
  {
    name: "Google",
    purpose:
      "Alleen als je inlogt met Google. We krijgen dan je e-mailadres, naam en profielfoto van je Google-account. Die profielfoto tonen we niet op de site.",
  },
];

export default function PrivacyPage() {
  // Coming-soon mode closes the takedown form, so don't link to it.
  const comingSoon = isComingSoon();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Privacybeleid
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            We nemen je privacy serieus. Lees hier hoe we je gegevens
            verzamelen, gebruiken en beschermen.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Gegevensverzameling */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Gegevensverzameling
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>Dit zijn de gegevens die VolleyRumours verzamelt:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Accountgegevens:</strong> E-mailadres, wachtwoord
                (beveiligd opgeslagen), gebruikersnaam, weergavenaam en de
                profielfoto die je zelf uploadt. Bij het uploaden verwijderen we
                de gegevens in het bestand, zoals de plaats waar de foto genomen
                is. Log je in met Google, dan nemen we je naam van Google over.
                Ook wanneer je bevestigde dat je 16 jaar of ouder bent en welke
                versie van de voorwaarden je aanvaardde.
              </li>
              <li>
                <strong>Inhoudsgegevens:</strong> Geruchten, zoekertjes en
                berichten die je plaatst.
              </li>
              <li>
                <strong>Interactiegegevens:</strong> Je stemmen op geruchten, je
                meldingen en de gebruikers die je blokkeert.
              </li>
              <li>
                <strong>Technische gegevens:</strong> Je IP-adres en
                browsergegevens, die nodig zijn om de site te tonen, en anonieme
                bezoekcijfers via Vercel Web Analytics en Speed Insights.
              </li>
              <li>
                <strong>Communicatiegegevens:</strong> Berichten via het
                contactformulier en verwijderverzoeken.
              </li>
              <li>
                <strong>Wachtlijst:</strong> Je e-mailadres, als je je
                inschrijft om te horen wanneer de site opent.
              </li>
            </ul>
          </div>
        </div>

        {/* Track record (#88, D-005) */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Track record
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Bij je geruchten tonen we je track record: hoeveel van je
              afgeronde geruchten een moderator bevestigde. Afgerond betekent
              bevestigd of ontkracht.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Berekening:</strong> Alleen de beslissingen van
                moderators tellen. Stemmen en niet bevestigde geruchten tellen
                niet mee.
              </li>
              <li>
                <strong>Zichtbaarheid:</strong> Je track record is openbaar, bij
                je geruchten en, vanaf 5 afgeronde geruchten, op de lijst met
                betrouwbare bronnen.
              </li>
              <li>
                <strong>Stemmen:</strong> Wie op welk gerucht stemde, is niet
                zichtbaar voor andere gebruikers.
              </li>
            </ul>
          </div>
        </div>

        {/* Conversation Privacy (reported conversations: D-015) */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Privacy van Privéberichten
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>Privéberichten tussen gebruikers zijn:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Beperkt toegankelijk:</strong> Alleen jij en de ander in
                het gesprek kunnen de berichten lezen.
              </li>
              <li>
                <strong>Niet openbaar:</strong> Berichten worden nooit getoond
                op je profiel of in publieke feeds.
              </li>
              <li>
                <strong>Bij een melding:</strong> Meldt een van jullie het
                gesprek, dan kan een moderator het lezen zolang de melding
                openstaat. Elke keer dat dat gebeurt, wordt het vastgelegd.
              </li>
            </ul>
          </div>
        </div>

        {/* Datagebruik */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Hoe we je gegevens gebruiken
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Servicelevering:</strong> Je account beheren, content
                tonen en live berichten mogelijk maken.
              </li>
              <li>
                <strong>Verbetering:</strong> Bugs oplossen, prestaties
                verbeteren en nieuwe functies ontwikkelen.
              </li>
              <li>
                <strong>Analytics:</strong> Begrijpen hoe bezoekers de site
                gebruiken, via Vercel Web Analytics en Speed Insights.
              </li>
              <li>
                <strong>Communicatie:</strong> E-mails over je account, een
                korte melding bij een nieuw bericht of een beslissing over je
                gerucht (zonder de inhoud; uit te zetten op je profiel), en één
                e-mail wanneer de site opent als je op de wachtlijst staat.
              </li>
              <li>
                <strong>Veiligheid:</strong> Misbruik voorkomen en gebruikers
                beschermen, met meldingen, blokkeringen en moderatie.
              </li>
            </ul>
            <p>
              We verkopen je gegevens niet en gebruiken geen advertentie- of
              trackingdiensten.
            </p>
          </div>
        </div>

        {/* Processors (#77) */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Wie verwerkt je gegevens
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Deze diensten verwerken gegevens voor ons. Ze gebruiken je
              gegevens alleen om die dienst te leveren.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              {processors.map((processor) => (
                <li key={processor.name}>
                  <strong>{processor.name}:</strong> {processor.purpose}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Retention (D-011, D-014, D-016, D-017, D-028) */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Hoe lang we je gegevens bewaren
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Account en inhoud:</strong> Je profiel, geruchten,
                zoekertjes en berichten bewaren we tot je ze verwijdert of je
                account verwijdert.
              </li>
              <li>
                <strong>Account verwijderen:</strong> We wissen in één keer je
                profiel, profielfoto, zoekertjes, stemmen, blokkeringen, je
                gesprekken met alle berichten erin, en je geruchten die nog niet
                gepubliceerd zijn. Je gepubliceerde geruchten blijven staan,
                zonder je naam. Je meldingen blijven bewaard, zonder je naam. We
                houden alleen bij dát er een account verwijderd is, zonder te
                bewaren welk.
              </li>
              <li>
                <strong>Schorsingen:</strong> Tot je account verwijderd wordt.
              </li>
              <li>
                <strong>Logboek van moderatoracties:</strong> 2 jaar. Daarin
                staat welke moderator wat deed, en bij welke gebruiker of welke
                inhoud.
              </li>
              <li>
                <strong>Verwijderverzoeken en contactberichten:</strong> 12
                maanden, zie hieronder.
              </li>
              <li>
                <strong>Wachtlijst:</strong> Tot we de e-mail over de opening
                van de site verstuurd hebben. Daarna wissen we de lijst.
              </li>
            </ul>
          </div>
        </div>

        {/* Data Security */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Gegevensbeveiliging
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              We nemen beveiligingsmaatregelen om je gegevens te beschermen:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>HTTPS-versleuteling:</strong> Alle communicatie is
                versleuteld tijdens verzending.
              </li>
              <li>
                <strong>Toegangsregels in de database:</strong> Elke gebruiker
                kan alleen de gegevens lezen en wijzigen waar hij of zij recht
                op heeft.
              </li>
              <li>
                <strong>Wachtwoordbeveiliging:</strong> Wachtwoorden worden
                gehasht met veilige algoritmen.
              </li>
            </ul>
          </div>
        </div>

        {/* Cookies */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Cookies
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>We gebruiken alleen cookies die nodig zijn:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Inloggen:</strong> Cookies die bijhouden dat je ingelogd
                bent.
              </li>
              <li>
                <strong>Thema:</strong> Je keuze voor licht of donker, bewaard
                in je browser.
              </li>
              <li>
                <strong>Geen tracking:</strong> Vercel Web Analytics en Speed
                Insights werken zonder cookies. We gebruiken geen advertentie-
                of trackingcookies.
              </li>
            </ul>
          </div>
        </div>

        {/* Takedown requests (#68, D-014). Copy to be reviewed in #94. */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Geruchten over jou
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Gaat een gerucht over jou, je kind of iemand die je
              vertegenwoordigt, dan kan je zonder account vragen om het te
              verwijderen
              {comingSoon ? (
                "."
              ) : (
                <>
                  {" "}
                  via{" "}
                  <Link
                    href="/verwijderverzoek"
                    className="text-primary hover:underline font-medium"
                  >
                    dit formulier
                  </Link>
                  .
                </>
              )}{" "}
              Een moderator beslist; tot dan blijft het gerucht zichtbaar.
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Wat we bewaren:</strong> je naam, e-mailadres, je uitleg
                en over welk gerucht het gaat. Alleen moderators zien deze
                gegevens.
              </li>
              <li>
                <strong>Misbruik voorkomen:</strong> om te veel verzoeken te
                beperken bewaren we een versleutelde code van je IP-adres die
                elke dag verandert.
              </li>
              <li>
                <strong>Hoe lang:</strong> 12 maanden na je verzoek wissen we je
                naam, e-mailadres, uitleg en die code. Het referentienummer en
                de beslissing blijven bewaard.
              </li>
            </ul>
          </div>
        </div>

        {/* Contact form (#81, D-017). Copy to be reviewed in #94. */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Berichten via het contactformulier
          </h2>
          <ul className="list-disc list-inside space-y-2 ml-2 text-muted-foreground">
            <li>
              <strong>Wat we bewaren:</strong> je naam, e-mailadres, onderwerp
              en bericht, en je account als je ingelogd was. Alleen moderators
              en beheerders lezen ze, om je te antwoorden.
            </li>
            <li>
              <strong>Misbruik voorkomen:</strong> om te veel berichten te
              beperken bewaren we een versleutelde code van je IP-adres die elke
              dag verandert.
            </li>
            <li>
              <strong>Hoe lang:</strong> 12 maanden nadat we je bericht
              afgehandeld hebben, wissen we je naam, e-mailadres, bericht en die
              code.
            </li>
          </ul>
        </div>

        {/* User Rights */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Jouw rechten
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>Je hebt het recht om:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Je gegevens inzien:</strong> Contacteer ons voor een
                kopie van je gegevens.
              </li>
              <li>
                <strong>Je account verwijderen:</strong> Je profiel en je
                gegevens wissen, zoals hierboven beschreven.
              </li>
              <li>
                <strong>Correcties aanvragen:</strong> Onjuiste informatie
                corrigeren.
              </li>
            </ul>
          </div>
        </div>

        {/* Contact */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Vragen over privacy?
          </h2>
          <p className="text-muted-foreground">
            Neem contact met ons op via ons{" "}
            <a
              href="/contact"
              className="text-primary hover:underline font-medium"
            >
              contactformulier
            </a>
            . We beantwoorden je vragen graag.
          </p>
        </div>
      </section>
    </div>
  );
}
