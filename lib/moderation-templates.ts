import type { RejectionReason } from "@/lib/rumours";

// Standard Dutch replies for moderators (#93). A template fills a note field
// in the admin area; the moderator edits it before sending. Text in [square
// brackets] must be replaced, and a note that still has some can't be sent.
// The moderator handbook (docs/product/moderation.md) says when to use which.

export type ModerationTemplate = { label: string; text: string };

/** Notes for the author of a rejected rumour, per rejection reason. */
export const REJECTION_TEMPLATES: Record<
  RejectionReason,
  ModerationTemplate[]
> = {
  no_source: [
    {
      label: "Bron toevoegen",
      text: "We konden dit gerucht niet nagaan. Voeg een bron toe, bijvoorbeeld een link naar een artikel of een bericht van de club, en dien het opnieuw in.",
    },
    {
      label: "Bron ondersteunt het niet",
      text: "De bron die je opgaf, zegt niets over deze transfer. Heb je een andere bron? Dien het gerucht dan opnieuw in.",
    },
  ],
  minor_or_not_senior: [
    {
      label: "Geen senior niveau",
      text: "We plaatsen alleen geruchten over spelers en trainers in Liga, Nationale en Promo.",
    },
    {
      label: "Mogelijk minderjarig",
      text: "Het lijkt erop dat dit gerucht over een jeugdspeler gaat. Over minderjarigen plaatsen we geen geruchten.",
    },
  ],
  offensive_or_personal: [
    {
      label: "Privéleven of gezondheid",
      text: "Houd het bij de transfer zelf. Laat opmerkingen over het privéleven, de gezondheid of het contract weg en dien het gerucht opnieuw in.",
    },
    {
      label: "Beledigend",
      text: "Je gerucht bevat beledigende taal. Schrijf het zakelijk en dien het opnieuw in.",
    },
  ],
  duplicate: [
    {
      label: "Staat er al",
      text: "Dit gerucht staat er al: [speler, van club naar club]. Je kunt daar meestemmen.",
    },
  ],
  incomplete: [
    {
      label: "Clubs ontbreken",
      text: "Vermeld de speler, de huidige club en de club waar die naartoe zou gaan, en dien het gerucht opnieuw in.",
    },
  ],
  other: [
    {
      label: "Vrije reden",
      text: "We plaatsen dit gerucht niet omdat [reden].",
    },
  ],
};

/** Notes for the requester when a takedown request is decided. */
export const TAKEDOWN_TEMPLATES: Record<
  "remove" | "reject",
  ModerationTemplate[]
> = {
  remove: [
    {
      label: "Verwijderd",
      text: "We hebben het gerucht verwijderd. Het staat niet meer op VolleyRumours. Bedankt voor je verzoek.",
    },
  ],
  reject: [
    {
      label: "Gaat over de transfer",
      text: "Het gerucht gaat over een mogelijke transfer en niet over je privéleven, en de bron is voldoende. We laten het daarom staan. Klopt er iets niet? Dien dan een nieuw verzoek in en leg uit wat er niet klopt.",
    },
    {
      label: "Officieel bevestigd",
      text: "Deze transfer is intussen officieel bekendgemaakt door [club of bron]. We laten het gerucht daarom staan.",
    },
    {
      label: "Verband onduidelijk",
      text: "We konden niet nagaan hoe je verbonden bent met de persoon over wie het gerucht gaat. Dien een nieuw verzoek in en vertel wie je bent voor die persoon.",
    },
  ],
};

/** Notes on a report: for the author when content is removed, else internal. */
export const REPORT_TEMPLATES: Record<
  "remove" | "dismiss" | "action",
  ModerationTemplate[]
> = {
  remove: [
    {
      label: "Persoonlijke informatie",
      text: "Je inhoud bevatte persoonlijke informatie over iemand. Dat laten we niet toe op VolleyRumours.",
    },
    {
      label: "Beledigend",
      text: "Je inhoud was beledigend of haatdragend en is daarom verwijderd.",
    },
    {
      label: "Spam of oplichting",
      text: "Je zoekertje leek op spam of oplichting en is daarom verwijderd. Denk je dat dit een vergissing is? Neem dan contact met ons op.",
    },
    {
      label: "Onjuist",
      text: "Je gerucht bleek onjuist of misleidend en is daarom verwijderd.",
    },
  ],
  dismiss: [
    {
      label: "Geen inbreuk",
      text: "Nagekeken: geen inbreuk op de regels.",
    },
  ],
  action: [
    {
      label: "Waarschuwing per e-mail",
      text: "Gebruiker op [datum] per e-mail gewaarschuwd.",
    },
    {
      label: "Doorgegeven voor schorsing",
      text: "Doorgegeven aan een beheerder voor een schorsing: [waarom].",
    },
  ],
};

/** Reasons a suspended user sees on every page. */
export const SUSPENSION_TEMPLATES: ModerationTemplate[] = [
  {
    label: "Intimidatie in berichten",
    text: "Je stuurde herhaaldelijk intimiderende of beledigende berichten naar andere leden.",
  },
  {
    label: "Spam of oplichting",
    text: "Je plaatste zoekertjes of berichten die op spam of oplichting leken.",
  },
  {
    label: "Persoonlijke informatie",
    text: "Je plaatste herhaaldelijk persoonlijke informatie over spelers, ook na een waarschuwing.",
  },
];

/** True while a note still has a [placeholder] from a template. */
export function hasTemplatePlaceholder(text: string) {
  return /\[[^\]]*\]/.test(text);
}
