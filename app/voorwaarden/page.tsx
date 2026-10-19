import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { CONTACT_EMAIL } from "@/lib/legal";
import { MAX_PENDING_RUMOURS } from "@/lib/rumours";

export const metadata = pageMetadata({
  title: "Voorwaarden",
  description:
    "De gebruiksvoorwaarden van VolleyRumours: wie mag wat plaatsen, hoe moderatie werkt en hoe je een beslissing aanvecht.",
  path: "/voorwaarden",
});

// Rewritten for #94 to match the site after M2. A self-review against the
// GDPR, the DSA and Belgian law is in docs/product/legal-review.md.

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-foreground">{title}</h2>
      <div className="space-y-4 text-muted-foreground">{children}</div>
    </div>
  );
}

const linkClass = "text-primary hover:underline font-medium";

export default function VoorwaardenPage() {
  return (
    <div className="min-h-screen">
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Gebruiksvoorwaarden
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Deze voorwaarden gelden voor iedereen die VolleyRumours gebruikt.
            Lees ze voor je een account maakt.
          </p>
          {/* Same date as current_terms_version() in the database (#75):
              change both together, in a migration. */}
          <p className="mt-4 text-sm text-muted-foreground">
            Versie van 19 oktober 2026
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <Section title="Over VolleyRumours">
          <p>
            VolleyRumours is een gratis communitysite over het Belgische
            volleybal, zonder winstoogmerk. Je vindt er zoekertjes van spelers,
            trainers en clubs, en geruchten over transfers die een moderator
            eerst nakijkt. De site wordt gemaakt en gemodereerd door het
            VolleyRumours-team.
          </p>
          <p>
            Je bereikt ons via het{" "}
            <Link href="/contact" className={linkClass}>
              contactformulier
            </Link>{" "}
            of via{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
              {CONTACT_EMAIL}
            </a>
            , in het Nederlands of het Engels. Dat is ook het contactpunt voor
            autoriteiten.
          </p>
          <p>
            Door de site te gebruiken, ga je akkoord met deze voorwaarden en met
            ons{" "}
            <Link href="/privacy" className={linkClass}>
              privacybeleid
            </Link>
            .
          </p>
        </Section>

        {/* Age (#75, D-003) */}
        <Section title="Je account">
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              Je moet 16 jaar of ouder zijn om een account te maken. Bij het
              registreren bevestig je dat, en aanvaard je deze voorwaarden. We
              bewaren wanneer je dat deed en welke versie je aanvaardde.
            </li>
            <li>Eén account per persoon, met gegevens die kloppen.</li>
            <li>
              Je houdt je wachtwoord geheim. Wat er met je account gebeurt, valt
              onder jouw verantwoordelijkheid.
            </li>
            <li>
              Je kan je account op elk moment verwijderen op je profiel. Wat er
              dan met je gegevens en je geruchten gebeurt, staat in het{" "}
              <Link href="/privacy" className={linkClass}>
                privacybeleid
              </Link>
              .
            </li>
          </ul>
        </Section>

        <Section title="Gedragsregels">
          <p>Op VolleyRumours doe je het volgende niet:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              <strong>Bewust onjuiste informatie verspreiden:</strong> geen
              verzonnen geruchten of nepzoekertjes.
            </li>
            <li>
              <strong>Beledigen of pesten:</strong> andere mensen aanvallen,
              bedreigen of discrimineren, op de site of in berichten.
            </li>
            <li>
              <strong>Privéleven delen:</strong> geen gezondheid, familie,
              adressen, telefoonnummers of andere privézaken van anderen.
            </li>
            <li>
              <strong>Spam of oplichting:</strong> geen reclame, massaberichten
              of pogingen om geld of gegevens los te krijgen.
            </li>
            <li>
              <strong>Iets onwettigs plaatsen:</strong> ook geen inhoud die het
              auteursrecht of het merkenrecht van iemand anders schendt.
            </li>
            <li>
              <strong>Het systeem misbruiken:</strong> geen nepaccounts, geen
              stemmen met meerdere accounts, geen geautomatiseerde toegang.
            </li>
          </ul>
        </Section>

        {/* D-002, D-012, D-013, D-020 */}
        <Section title="Geruchten">
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              Geruchten gaan alleen over seniorspelers en -trainers. Over
              minderjarigen en jeugdspelers plaats je niets.
            </li>
            <li>
              Je geeft aan waar je gerucht vandaan komt en je bevestigt dat je
              het te goeder trouw deelt. Een link naar een bron mag erbij.
            </li>
            <li>
              Een moderator kijkt elk gerucht na voor het online komt. Een
              afgewezen gerucht zie je op je profiel, met de reden. Je kan
              maximaal {MAX_PENDING_RUMOURS} geruchten tegelijk laten nakijken.
            </li>
            <li>
              Een moderator rondt een gerucht af als bevestigd (op basis van een
              officiële bron), ontkracht of niet bevestigd. Een bevestigd
              gerucht wordt een transfer.
            </li>
            <li>
              Bij je geruchten tonen we je track record: hoeveel van je
              afgeronde geruchten bevestigd werden. Alleen de beslissingen van
              moderators tellen, geen stemmen.
            </li>
            <li>
              Een gerucht blijft een gerucht. We garanderen niet dat het klopt,
              ook niet als het online staat.
            </li>
          </ul>
        </Section>

        <Section title="Stemmen">
          <p>
            Ingelogde gebruikers kunnen stemmen of ze denken dat een lopend
            gerucht klopt. Dat toont wat de stemmers denken, niet wat waar is.
            Je stemt niet op je eigen geruchten. Wie op wat stemde, ziet niemand
            anders.
          </p>
        </Section>

        {/* D-019, D-022, D-024 */}
        <Section title="Zoekertjes">
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              Zoekertjes zijn voor seniorvolleybal: een speler of trainer die
              een team zoekt, of een team dat een speler of trainer zoekt.
              Verkoop van spullen, tickets of diensten hoort hier niet.
            </li>
            <li>
              Je zoekertje klopt en blijft actueel. Is de plaats ingevuld,
              markeer het dan als gevonden.
            </li>
            <li>
              Een zoekertje blijft online tot het einde van het seizoen (31
              augustus) en minstens 30 dagen. Daarna kan je het verlengen.
            </li>
            <li>
              Wie reageert, doet dat via een bericht op de site. Je e-mailadres
              blijft verborgen.
            </li>
            <li>
              Zoekertjes plaatsen is gratis. Het team kan een zoekertje gratis
              als &quot;Aanbevolen&quot; tonen. Als we daar ooit geld voor
              vragen, passen we eerst deze voorwaarden aan.
            </li>
          </ul>
        </Section>

        {/* D-015, D-018 */}
        <Section title="Berichten">
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              Berichten zijn voor contact over een zoekertje. Alleen jij en de
              ander lezen ze.
            </li>
            <li>
              Je kan iemand blokkeren: dan kan die persoon je geen berichten
              meer sturen. Je kan een gesprek ook melden.
            </li>
            <li>
              Wordt een gesprek gemeld, dan kan een moderator het lezen zolang
              de melding openstaat. Dat wordt elke keer vastgelegd.
            </li>
          </ul>
        </Section>

        <Section title="Wat je plaatst">
          <p>
            Wat je plaatst, blijft van jou. Je geeft ons wel de toestemming,
            gratis en niet-exclusief, om het op VolleyRumours te tonen, te
            bewaren en te laten delen, bijvoorbeeld met een deelafbeelding. Die
            toestemming loopt zolang het op de site staat.
          </p>
          <p>
            Een gepubliceerd gerucht hoort bij het archief van de site. Als je
            je account verwijdert, blijft het staan, zonder je naam. Je
            zoekertjes en berichten verdwijnen dan wel.
          </p>
          <p>
            Je bent zelf verantwoordelijk voor wat je plaatst, en je plaatst
            alleen wat je mag delen.
          </p>
        </Section>

        {/* D-014, D-015, D-036; DSA art. 14 and 16 */}
        <Section title="Melden en laten verwijderen">
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              Met &quot;Melden&quot; bij een gerucht, zoekertje of gesprek laat
              je ons weten dat iets niet in orde is, met een reden.
            </li>
            <li>
              Gaat een gerucht over jou, je kind of iemand die je
              vertegenwoordigt, dan kan je zonder account vragen om het te{" "}
              <Link href="/verwijderverzoek" className={linkClass}>
                verwijderen
              </Link>
              . Je krijgt een referentienummer en een link waar je de beslissing
              ziet.
            </li>
            <li>
              Tot een moderator beslist, blijft de inhoud zichtbaar. We streven
              ernaar binnen 72 uur te beslissen over verwijderverzoeken en
              meldingen, en binnen 24 uur over nieuwe geruchten.
            </li>
            <li>
              Elke beslissing neemt een mens. We gebruiken geen automatische
              moderatie. Elke beslissing wordt vastgelegd in een logboek.
            </li>
          </ul>
        </Section>

        {/* D-016 */}
        <Section title="Wat we kunnen doen">
          <p>
            Houdt iemand zich niet aan deze voorwaarden of aan de wet, dan
            kunnen we, naargelang hoe ernstig het is:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>een gerucht afwijzen of inhoud van de site halen;</li>
            <li>je per e-mail waarschuwen;</li>
            <li>
              je account schorsen, tot een datum of voor onbepaalde tijd. Een
              geschorst account kan de site nog lezen, maar niets plaatsen,
              stemmen of berichten sturen.
            </li>
          </ul>
          <p>
            Je ziet altijd wat we beslisten en waarom: op je profiel bij je
            gerucht of zoekertje, of bovenaan elke pagina bij een schorsing.
          </p>
        </Section>

        {/* DSA art. 17 and 20 */}
        <Section title="Niet akkoord met een beslissing">
          <p>
            Ben je het niet eens met een beslissing over je inhoud, je account
            of je verwijderverzoek? Laat het ons binnen 6 maanden weten via het{" "}
            <Link href="/contact" className={linkClass}>
              contactformulier
            </Link>
            , ook als je geschorst bent. Zeg over welke beslissing het gaat en
            waarom. We bekijken ze opnieuw en laten je weten wat we beslissen.
          </p>
          <p>
            Je kan ook altijd naar de rechter stappen. Gaat het om je
            persoonsgegevens, dan kan je een klacht indienen bij de{" "}
            <a
              href="https://www.gegevensbeschermingsautoriteit.be"
              className={linkClass}
              rel="noopener noreferrer"
            >
              Gegevensbeschermingsautoriteit
            </a>
            .
          </p>
        </Section>

        <Section title="Aansprakelijkheid">
          <p>
            We doen ons best om de site veilig en beschikbaar te houden, maar
            kunnen niet beloven dat ze altijd werkt of foutloos is. Geruchten,
            zoekertjes en berichten komen van gebruikers; daarvoor zijn wij niet
            verantwoordelijk, tot we horen dat er iets mis mee is.
          </p>
          <p>
            Voor zover de wet het toelaat, zijn we niet aansprakelijk voor
            schade door inhoud van gebruikers, door hun gedrag, of doordat de
            site even niet werkt. Dat geldt niet als we opzettelijk of met grove
            fout handelen, en het beperkt de rechten niet die je als consument
            hebt.
          </p>
        </Section>

        <Section title="Wijzigingen">
          <p>
            We kunnen deze voorwaarden aanpassen, bijvoorbeeld als de site
            verandert. Bij een nieuwe versie vragen we je ze opnieuw te
            aanvaarden voor je verder gaat met je account.
          </p>
        </Section>

        <Section title="Toepasselijk recht">
          <p>
            Op deze voorwaarden is het Belgische recht van toepassing. Bij een
            geschil zoeken we eerst samen een oplossing. Lukt dat niet, dan zijn
            de Belgische rechtbanken bevoegd.
          </p>
        </Section>
      </section>
    </div>
  );
}
