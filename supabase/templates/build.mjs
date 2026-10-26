// Builds the Supabase Auth email templates in this folder (#251).
//
//   node supabase/templates/build.mjs
//
// The layout is shared with the other emails (emails/layout.mjs). Supabase
// fills the {{ .X }} placeholders (Go templates). Change the copy here, rebuild, and commit the
// generated .html files too: config.toml points the local stack at them, and
// the owner pastes them into the dashboard for production (docs/supabase.md).
// The subjects are repeated in config.toml; keep them in sync.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  C,
  SITE,
  button,
  code,
  fallback,
  layout,
  note,
  paragraph,
} from "../../emails/layout.mjs";

const LINK = "{{ .ConfirmationURL }}";

// Keys match Supabase's template names ([auth.email.template.<key>]).
export const TEMPLATES = {
  confirmation: {
    subject: "Bevestig je e-mailadres voor VolleyRumours",
    heading: "Bevestig je e-mailadres",
    preheader: "Nog één klik en je account op VolleyRumours is klaar.",
    body: [
      paragraph(
        "Welkom bij VolleyRumours. Bevestig je e-mailadres, dan is je account klaar.",
      ),
      paragraph(
        "Daarna plaats je zoekertjes, reageer je op ploegen, spelers en trainers, en deel je transfergeruchten.",
      ),
      button("E-mailadres bevestigen", LINK),
      fallback(LINK),
      note(
        "Maakte je geen account aan op VolleyRumours? Dan mag je deze e-mail negeren.",
      ),
    ],
  },
  recovery: {
    subject: "Kies een nieuw wachtwoord voor VolleyRumours",
    heading: "Kies een nieuw wachtwoord",
    preheader:
      "Je vroeg een nieuw wachtwoord aan voor je account op VolleyRumours.",
    body: [
      paragraph(
        "Je vroeg een nieuw wachtwoord aan voor je account op VolleyRumours. Met de knop hieronder kies je er een.",
      ),
      button("Nieuw wachtwoord kiezen", LINK),
      fallback(LINK),
      note(
        "Vroeg je dit niet aan? Dan mag je deze e-mail negeren: je wachtwoord blijft hetzelfde. De link werkt maar één keer.",
      ),
    ],
  },
  magic_link: {
    subject: "Je inloglink voor VolleyRumours",
    heading: "Inloggen bij VolleyRumours",
    preheader: "Je inloglink en code voor VolleyRumours.",
    body: [
      paragraph("Log in met de knop hieronder. De link werkt maar één keer."),
      button("Inloggen", LINK),
      paragraph("Of vul deze code in:"),
      code("{{ .Token }}"),
      fallback(LINK),
      note("Wilde je niet inloggen? Dan mag je deze e-mail negeren."),
    ],
  },
  email_change: {
    subject: "Bevestig je nieuwe e-mailadres voor VolleyRumours",
    heading: "Bevestig je nieuwe e-mailadres",
    preheader: "Bevestig de wijziging van je e-mailadres op VolleyRumours.",
    body: [
      paragraph(
        'Je wil het e-mailadres van je account op VolleyRumours wijzigen van <strong style="color:' +
          C.foreground +
          ';">{{ .Email }}</strong> naar <strong style="color:' +
          C.foreground +
          ';">{{ .NewEmail }}</strong>.',
      ),
      button("Wijziging bevestigen", LINK),
      fallback(LINK),
      note(
        `Wijzigde je dit niet? Negeer deze e-mail en laat het ons weten via <a href="${SITE}/contact" style="color:${C.primaryText};text-decoration:underline;">het contactformulier</a>.`,
      ),
    ],
  },
  invite: {
    subject: "Je bent uitgenodigd op VolleyRumours",
    heading: "Je bent uitgenodigd",
    preheader: "Maak je account op VolleyRumours.",
    body: [
      paragraph(
        "Je bent uitgenodigd om een account te maken op VolleyRumours, de community voor Belgische volleybaltransfers en zoekertjes.",
      ),
      button("Uitnodiging aanvaarden", LINK),
      fallback(LINK),
      note(
        "Verwachtte je deze uitnodiging niet? Dan mag je deze e-mail negeren.",
      ),
    ],
  },
  reauthentication: {
    subject: "Je bevestigingscode voor VolleyRumours",
    heading: "Bevestig dat jij het bent",
    preheader: "Je bevestigingscode voor VolleyRumours.",
    body: [
      paragraph("Vul deze code in op VolleyRumours om verder te gaan:"),
      code("{{ .Token }}"),
      note(
        "Vroeg je geen code aan? Negeer deze e-mail en kies voor de zekerheid een nieuw wachtwoord.",
      ),
    ],
  },
};

const here = dirname(fileURLToPath(import.meta.url));
for (const [key, t] of Object.entries(TEMPLATES)) {
  const html = layout({
    title: t.subject,
    preheader: t.preheader,
    heading: t.heading,
    body: t.body.join("\n              "),
  });
  writeFileSync(join(here, `${key}.html`), html);
}
console.log(
  Object.entries(TEMPLATES)
    .map(([key, t]) => `${key}.html  "${t.subject}"`)
    .join("\n"),
);
