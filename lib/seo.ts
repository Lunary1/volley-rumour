import type { Metadata } from "next";

// Search and share metadata (#99). A page's openGraph replaces the root
// layout's instead of merging with it, so public pages build theirs here.

/** Open Graph fields every page shares. */
export const BASE_OPEN_GRAPH = {
  type: "website",
  siteName: "VolleyRumours",
  locale: "nl_BE",
} as const;

/** For pages that only make sense for one user or for staff. */
export const NO_INDEX: Metadata["robots"] = { index: false, follow: false };

/**
 * Title, description, canonical URL and Open Graph tags for a public page.
 * `path` is the canonical path without query string, e.g. "/zoekertjes".
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      ...BASE_OPEN_GRAPH,
      title,
      description,
      url: path,
      // Replacing the root openGraph drops its image too. A segment with its
      // own opengraph-image file still gets that one: files win.
      images: SITE_IMAGE,
    },
  };
}

/** app/opengraph-image.tsx, the share image for the whole site. */
export const SITE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "VolleyRumours: Belgische volleybal transfers en zoekertjes",
};

/** Shortens text for a meta description, on a word boundary. */
export function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${space > max / 2 ? cut.slice(0, space) : cut}…`;
}
