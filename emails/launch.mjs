// The launch email (#253, part of #95): sent once to everyone on the
// waitlist when the site opens, by scripts/launch-email.mjs. After it has
// gone out the waitlist is deleted (D-028), so this is the only email those
// addresses ever get from the waitlist.

import {
  SITE,
  button,
  features,
  layout,
  link,
  note,
  paragraph,
} from "./layout.mjs";

const UTM = "utm_source=waitlist&utm_medium=email&utm_campaign=launch";
export const SIGN_UP_URL = `${SITE}/auth/sign-up?${UTM}`;
const ZOEKERTJES_URL = `${SITE}/zoekertjes?${UTM}`;
const HOME_URL = `${SITE}/?${UTM}`;

export const SUBJECT = "VolleyRumours is live";
const PREHEADER =
  "Zoekertjes, transfergeruchten en wie het vooraf goed had: vanaf vandaag voor iedereen.";

const FEATURES = [
  {
    title: "Zoekertjes",
    text: "Zoek je een ploeg, speler of trainer? Plaats gratis een zoekertje en filter op reeks, provincie en positie.",
  },
  {
    title: "Transfer Talk",
    text: "Volg de transfergeruchten, elk met een bron en nagekeken door een moderator. Stem mee: klopt het?",
  },
  {
    title: "Betrouwbare bronnen",
    text: "Deel zelf een gerucht. Wie vaak gelijk krijgt, komt bovenaan te staan.",
  },
];

const OUTRO =
  "Je krijgt deze e-mail één keer, omdat je je met dit adres op de wachtlijst van volleyrumours.be zette. Na deze e-mail verwijderen we de wachtlijst, je adres dus ook. Je krijgt van ons geen andere e-mails, tenzij je een account maakt.";

export function launchEmail() {
  const html = layout({
    title: SUBJECT,
    preheader: PREHEADER,
    heading: "VolleyRumours is live",
    body: [
      paragraph(
        "Je schreef je in om als eerste te horen wanneer we live gaan. Vanaf vandaag is het zover: volleyrumours.be staat open voor iedereen.",
      ),
      features(FEATURES),
      paragraph(
        "Maak je account in een minuut, met je e-mailadres of met Google.",
      ),
      button("Maak je account", SIGN_UP_URL),
      paragraph(
        `Ken je een club die nog een speler of trainer zoekt? Stuur ze ${link("de zoekertjes", ZOEKERTJES_URL)} door. Hoe meer ploegen en spelers erop staan, hoe beter het werkt.`,
      ),
      note(OUTRO),
    ].join("\n              "),
  });

  const text = [
    "VolleyRumours is live",
    "",
    "Je schreef je in om als eerste te horen wanneer we live gaan. Vanaf vandaag is het zover: volleyrumours.be staat open voor iedereen.",
    "",
    ...FEATURES.flatMap(({ title, text }) => [`${title}: ${text}`, ""]),
    "Maak je account in een minuut, met je e-mailadres of met Google:",
    SIGN_UP_URL,
    "",
    "Ken je een club die nog een speler of trainer zoekt? Stuur ze de zoekertjes door:",
    ZOEKERTJES_URL,
    "",
    "---",
    OUTRO,
    "",
    `VolleyRumours: ${HOME_URL}`,
  ].join("\n");

  return { subject: SUBJECT, html, text };
}
