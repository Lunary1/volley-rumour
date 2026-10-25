// Builds the Supabase Auth email templates in this folder (#251).
//
//   node supabase/templates/build.mjs
//
// One layout for all six, in the site's light theme (colours from
// app/globals.css). Email clients ignore <style> blocks and flexbox, so
// everything is tables and inline styles. Supabase fills the {{ .X }}
// placeholders (Go templates). Change the copy here, rebuild, and commit the
// generated .html files too: config.toml points the local stack at them, and
// the owner pastes them into the dashboard for production (docs/supabase.md).
// The subjects are repeated in config.toml; keep them in sync.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://volleyrumours.be";

// Light-theme tokens from app/globals.css.
const C = {
  background: "#f6f7f6",
  card: "#ffffff",
  foreground: "#111815",
  secondaryForeground: "#3f4944",
  mutedForeground: "#5c6661",
  border: "#dfe4e1",
  primary: "#0b6e4f",
  primaryForeground: "#ffffff",
  primaryText: "#0a6146",
  featureBg: "#f2f8f4",
  featureBorder: "#cde3d6",
};
const FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const paragraph = (html) =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${C.secondaryForeground};">${html}</p>`;

const button = (
  label,
  href,
) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
                <tr>
                  <td style="border-radius:10px;background-color:${C.primary};">
                    <a href="${href}" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:${C.primaryForeground};text-decoration:none;border-radius:10px;">${label}</a>
                  </td>
                </tr>
              </table>`;

const fallback = (href) =>
  `<p style="margin:0 0 4px;font-size:13px;line-height:20px;color:${C.mutedForeground};">Werkt de knop niet? Kopieer deze link in je browser:</p>
              <p style="margin:0 0 24px;font-size:13px;line-height:20px;word-break:break-all;"><a href="${href}" style="color:${C.primaryText};text-decoration:underline;">${href}</a></p>`;

const code = (
  token,
) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 24px;">
                <tr>
                  <td align="center" style="padding:18px 16px;background-color:${C.featureBg};border:1px solid ${C.featureBorder};border-radius:10px;font-family:${FONT};font-size:28px;font-weight:700;letter-spacing:6px;line-height:36px;color:${C.foreground};">${token}</td>
                </tr>
              </table>`;

const note = (html) =>
  `<p style="margin:0;padding-top:20px;border-top:1px solid ${C.border};font-size:13px;line-height:20px;color:${C.mutedForeground};">${html}</p>`;

function layout({ title, preheader, heading, body }) {
  return `<!DOCTYPE html>
<html lang="nl" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${C.background};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.background};">${preheader}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.background};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;font-family:${FONT};">
            <tr>
              <td style="padding:0 4px 20px;">
                <a href="${SITE}" style="text-decoration:none;"><img src="${SITE}/logo-text-header.png" width="148" height="30" alt="VolleyRumours" style="display:block;border:0;width:148px;height:30px;" /></a>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;background-color:${C.card};border:1px solid ${C.border};border-radius:16px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;line-height:30px;color:${C.foreground};">${heading.replaceAll("e-mail", "e&#8209;mail")}</h1>
              ${body}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 16px 0;font-size:12px;line-height:18px;color:${C.mutedForeground};">
                VolleyRumours &middot; De community voor Belgische volleybaltransfers en zoekertjes<br />
                <a href="${SITE}/privacy" style="color:${C.mutedForeground};text-decoration:underline;">Privacy</a>
                &nbsp;&middot;&nbsp;
                <a href="${SITE}/voorwaarden" style="color:${C.mutedForeground};text-decoration:underline;">Voorwaarden</a>
                &nbsp;&middot;&nbsp;
                <a href="${SITE}/contact" style="color:${C.mutedForeground};text-decoration:underline;">Contact</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

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
