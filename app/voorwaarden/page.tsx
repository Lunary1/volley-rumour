import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Voorwaarden - VolleyRumours",
  description: "Servicevoorwaarden en gebruiksrichtlijnen voor VolleyRumours.",
};

export default function VoorwaardenPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Servicevoorwaarden
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Voordat je deelneemt aan VolleyRumours, lees alstublieft deze
            voorwaarden zorgvuldig door.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Inleiding */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Welkom bij VolleyRumours
          </h2>
          <p className="text-muted-foreground">
            VolleyRumours is een community-gedreven platform voor Belgische
            volleyballiefhebbers om transfers, geruchten, en classified
            advertenties te delen. Door VolleyRumours te gebruiken, ga je
            akkoord met deze voorwaarden.
          </p>
        </div>

        {/* Gedragsregels */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Gedragsregels
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Om VolleyRumours veilig en aangenaam voor iedereen te houden, mag
              je het volgende <strong>NIET</strong> doen:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Bedrog of misinformatie:</strong> Opzettelijk nepnieuws
                of onwaar geruchten verspreiden.
              </li>
              <li>
                <strong>Belediging of pesten:</strong> Andere gebruikers
                aanvallen, bedreigen, of discrimineren.
              </li>
              <li>
                <strong>Spam of irritatie:</strong> Herhaaldelijk advertenties,
                links of onwelkome berichten sturen.
              </li>
              <li>
                <strong>Illegale inhoud:</strong> Iets posten dat wetten
                overtreedt of privé-informatie bloostelt.
              </li>
              <li>
                <strong>Intellectuele eigendom:</strong> Auteursrecht of
                handelsmerken schenden.
              </li>
              <li>
                <strong>Manipulatie:</strong> Fake accounts maken of het
                stem-/reputatiesysteem misbruiken.
              </li>
            </ul>
          </div>
        </div>

        {/* Geruchten & Transfers */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Geruchten en Transfer Bevestiging
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              <strong>Geruchten posten:</strong> Je kunt vrij transfers of
              marktbewegingen delen als geruchten. Wees eerlijk over je bron en
              graad van zekerheid.
            </p>
            <p>
              <strong>Bevestiging proces:</strong> Geverifieerde moderators
              kunnen geruchten als echte transfers markeren op basis van
              officiële bewijzen.
            </p>
            <p>
              <strong>Geen garantie:</strong> VolleyRumours garandeert niet de
              nauwkeurigheid van geruchten. Informatie is alleen bedoeld ter
              vermaak en communitaire discussie.
            </p>
            <p>
              <strong>Betrouwbaarheid:</strong> Hoe meer van jouw geruchten
              worden bevestigd, hoe hoger je betrouwbaarheidsscore stijgt.
            </p>
          </div>
        </div>

        {/* Classified Ads */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Zoekertjes (Classified Advertenties)
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Zoekertjes zijn voor volleyball-gerelateerde advertenties zoals:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Spelers die een team zoeken</li>
              <li>Teams die spelers zoeken</li>
              <li>Trainers die positie zoeken</li>
              <li>Clubs die trainers zoeken</li>
            </ul>
            <p className="mt-4">
              <strong>Vereisten voor zoekertjes:</strong>
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Content moet volleyball-gerelateerd zijn</li>
              <li>
                Geen commerciële verkoop (geen uitrusting, tickets, etc. op
                grote schaal)
              </li>
              <li>Waarheid en relevantie zijn vereist</li>
              <li>Jij bent verantwoordelijk voor je advertentie</li>
            </ul>
          </div>
        </div>

        {/* Messages & Privacy */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Berichten en Privacycommunicatie
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Privé berichten:</strong> Alleen voor communicatie
                gerelateerd aan geruchten en zoekertjes.
              </li>
              <li>
                <strong>Geen spam:</strong> Massale berichten of onwelkome
                contact is verboden.
              </li>
              <li>
                <strong>Beperkte delen:</strong> Deel geen privégegevens
                (telefoon, adres) zonder toestemming.
              </li>
            </ul>
          </div>
        </div>

        {/* Voting System */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Stem- en Reputatiesysteem
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              <strong>Stemmen:</strong> Gebruikers kunnen geruchten upvoten of
              downvoten. Dit weerspiegelt communitaire consensus, niet waarheid.
            </p>
            <p>
              <strong>Misbruik:</strong> Manipulatie van stemmen (fake accounts,
              botting) leidt tot accountschorsing.
            </p>
            <p>
              <strong>Reputatie:</strong> Je betrouwbaarheidsscore is openbaar
              en gebaseerd op bevestigde geruchten. Dit is een
              community-initiatief, niet officieel.
            </p>
          </div>
        </div>

        {/* Account Responsibilities */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Accountverantwoordelijkheden
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Wachtwoord:</strong> Je bent verantwoordelijk voor het
                geheim houden van je wachtwoord.
              </li>
              <li>
                <strong>Inhoud:</strong> Jij bent verantwoordelijk voor alles
                wat je postvat.
              </li>
              <li>
                <strong>Termijn:</strong> Controleer je account regelmatig op
                berichten en updates.
              </li>
              <li>
                <strong>Schorsing:</strong> Schending van deze regels kan tot
                permanente verwijdering leiden.
              </li>
            </ul>
          </div>
        </div>

        {/* Moderation */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Moderatie en Handhaving
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              <strong>VolleyRumours-team:</strong> Wij behouden het recht om:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Inhoud te verwijderen die deze voorwaarden schendt</li>
              <li>
                Gebruikers op te waarschuwen, accounts op te schorten, of te
                verwijderen
              </li>
              <li>Geruchten als onwaar of spam te markeren</li>
              <li>Jouw account indien nodig in beslag te nemen</li>
            </ul>
            <p className="mt-4">
              <strong>Geen rechtsgarantie:</strong> We zijn niet
              verantwoordelijk voor inhoudfouten of communitaire beslissingen.
            </p>
          </div>
        </div>

        {/* Disclaimers */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Uitsluitingsbepalingen
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              <strong>Zoals aangeboden:</strong> VolleyRumours wordt aangeboden
              "as-is" zonder garanties.
            </p>
            <p>
              <strong>Geen aansprakelijkheid:</strong> We zijn niet
              aansprakelijk voor schade voortvloeiend uit:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Onnauwkeurigheid van geruchten</li>
              <li>Verlies van gegevens of toegang</li>
              <li>Gedrag van andere gebruikers</li>
              <li>Downtime of technische problemen</li>
            </ul>
          </div>
        </div>

        {/* Changes to Terms */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Wijzigingen aan deze Voorwaarden
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              We kunnen deze voorwaarden op elk moment aanpassen. Grote
              wijzigingen zullen via e-mail aangekondigd worden. Voortgezet
              gebruik van VolleyRumours na wijzigingen betekent acceptatie.
            </p>
          </div>
        </div>

        {/* Contact */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            Vragen?
          </h2>
          <p className="text-muted-foreground">
            Neem contact met ons op via ons{" "}
            <a
              href="/contact"
              className="text-primary hover:underline font-medium"
            >
              contactformulier
            </a>{" "}
            met eventuele vragen of bezwaren.
          </p>
        </div>
      </section>
    </div>
  );
}
