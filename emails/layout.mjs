// The one email layout (#251, #253): the Supabase Auth templates
// (supabase/templates/build.mjs) and the launch email (emails/launch.mjs)
// are built from these pieces, so every email looks the same.
//
// The site's light theme: colours from app/globals.css, the header logo.
// Email clients ignore <style> blocks and flexbox, so everything is tables
// and inline styles.

export const SITE = "https://volleyrumours.be";

// Light-theme tokens from app/globals.css.
export const C = {
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

export const FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const paragraph = (html) =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${C.secondaryForeground};">${html}</p>`;

export const button = (
  label,
  href,
) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
                <tr>
                  <td style="border-radius:10px;background-color:${C.primary};">
                    <a href="${href}" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:${C.primaryForeground};text-decoration:none;border-radius:10px;">${label}</a>
                  </td>
                </tr>
              </table>`;

export const fallback = (href) =>
  `<p style="margin:0 0 4px;font-size:13px;line-height:20px;color:${C.mutedForeground};">Werkt de knop niet? Kopieer deze link in je browser:</p>
              <p style="margin:0 0 24px;font-size:13px;line-height:20px;word-break:break-all;"><a href="${href}" style="color:${C.primaryText};text-decoration:underline;">${href}</a></p>`;

export const code = (
  token,
) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 24px;">
                <tr>
                  <td align="center" style="padding:18px 16px;background-color:${C.featureBg};border:1px solid ${C.featureBorder};border-radius:10px;font-family:${FONT};font-size:28px;font-weight:700;letter-spacing:6px;line-height:36px;color:${C.foreground};">${token}</td>
                </tr>
              </table>`;

/** A panel of short items, each a title and a line, like the site's feature cards. */
export const features = (
  items,
) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 24px;background-color:${C.featureBg};border:1px solid ${C.featureBorder};border-radius:10px;">
${items
  .map(
    ({ title, text }, i) => `                <tr>
                  <td style="padding:${i === 0 ? 18 : 0}px 20px ${i === items.length - 1 ? 18 : 14}px;font-family:${FONT};">
                    <p style="margin:0 0 2px;font-size:15px;font-weight:600;line-height:22px;color:${C.foreground};">${title}</p>
                    <p style="margin:0;font-size:14px;line-height:21px;color:${C.secondaryForeground};">${text}</p>
                  </td>
                </tr>`,
  )
  .join("\n")}
              </table>`;

export const note = (html) =>
  `<p style="margin:0;padding-top:20px;border-top:1px solid ${C.border};font-size:13px;line-height:20px;color:${C.mutedForeground};">${html}</p>`;

export const link = (label, href) =>
  `<a href="${href}" style="color:${C.primaryText};text-decoration:underline;">${label}</a>`;

/** The whole email: logo, a card with the heading and body, the footer. */
export function layout({ title, preheader, heading, body }) {
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
