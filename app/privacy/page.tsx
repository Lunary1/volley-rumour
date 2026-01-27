import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - VolleyRumours",
  description: "Lees ons privacybeleid en hoe wij jouw gegevens beschermen.",
};

export default function PrivacyPage() {
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
            <p>
              VolleyRumours verzamelt verschillende soorten gegevens om je een
              betere ervaring te bieden:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Accountgegevens:</strong> E-mailadres, wachtwoord
                (beveiligd opgeslagen), profielnaam en avatar.
              </li>
              <li>
                <strong>Inhoudsgegevens:</strong> Geruchten, bevestigde
                transfers, zoekertjes en berichten die je plaatst.
              </li>
              <li>
                <strong>Interactiegegevens:</strong> Stemmen, reacties, en je
                actieve deelname aan discussies.
              </li>
              <li>
                <strong>Technische gegevens:</strong> IP-adres, browsertype,
                apparaattype en browsing-gedrag via Vercel Analytics.
              </li>
              <li>
                <strong>Communicatiegegevens:</strong> Berichten en
                contactformulier-indieningen.
              </li>
            </ul>
          </div>
        </div>

        {/* Betrouwbaarheidsscore */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Betrouwbaarheidsscore en Trust Score
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Je betrouwbaarheidsscore wordt automatisch bijgewerkt op basis van
              je bijdragen aan de community:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Punten verdienen:</strong> Wanneer je geruchten die je
                deelt door de community als waar worden bevestigd.
              </li>
              <li>
                <strong>Zichtbaarheid:</strong> Je score is openbaar en helpt
                andere gebruikers je betrouwbaarheid in te schatten.
              </li>
              <li>
                <strong>Geen persoonlijke gebruik:</strong> We gebruiken deze
                score alleen voor community-ranglijsten en zichtbaarheid.
              </li>
            </ul>
          </div>
        </div>

        {/* Conversation Privacy */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Privacy van Privéberichten
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>Privéberichten tussen gebruikers zijn:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Versleuteld:</strong> Berichten worden veilig opgeslagen
                in onze database.
              </li>
              <li>
                <strong>Beperkt toegang:</strong> Alleen jij en de ontvanger
                kunnen berichten zien.
              </li>
              <li>
                <strong>Niet openbaar:</strong> Berichten worden nooit getoond
                op je profiel of in publieke feeds.
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
                hosten, en real-time functies mogelijk maken.
              </li>
              <li>
                <strong>Verbetering:</strong> Bugs oplossen, prestaties
                optimaliseren, en nieuwe functies ontwikkelen.
              </li>
              <li>
                <strong>Analytics:</strong> Begrijpen hoe gebruikers onze
                platform gebruiken (via Vercel Analytics).
              </li>
              <li>
                <strong>Communicatie:</strong> Je op de hoogte houden van
                policywijzigingen of account-gerelateerde zaken.
              </li>
              <li>
                <strong>Veiligheid:</strong> Fraude voorkomen en gebruikers
                beschermen tegen misbruik.
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
                <strong>HTTPS versleuteling:</strong> Alle communicatie
                versleuteld tijdens verzending.
              </li>
              <li>
                <strong>Supabase infrastructure:</strong> Beheerd via de
                enterprise-grade Supabase-platform.
              </li>
              <li>
                <strong>Row-Level Security:</strong> Databasetechnologie
                voorkomt ongeautoriseerde toegang.
              </li>
              <li>
                <strong>Wachtwoordbeveiliging:</strong> Wachtwoorden gehashed
                met veilige algoritmen.
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
            <p>We gebruiken cookies en vergelijkbare trackingtechnologieën:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Authenticatie:</strong> Session-cookies voor inloggen.
              </li>
              <li>
                <strong>Analytics:</strong> Vercel Analytics voor
                gebruikersgedrag-inzichten (anoniem).
              </li>
              <li>
                <strong>Voorkeur:</strong> Thema-voorkeur (donker/licht)
                opslaan.
              </li>
            </ul>
          </div>
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
                <strong>Je account verwijderen:</strong> Je profiel en al je
                gegevens permanent verwijderen.
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
