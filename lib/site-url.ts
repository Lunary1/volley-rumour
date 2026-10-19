/**
 * The canonical site URL, without a trailing slash, for links that leave the
 * site: emails, share links, the sitemap and Open Graph tags (#99).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://volleyrumours.be"
).replace(/\/$/, "");
