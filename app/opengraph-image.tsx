import { OG_CONTENT_TYPE, OG_SIZE, brandImage } from "@/lib/og-image";
import { SITE_IMAGE } from "@/lib/seo";

// The share image for every page without its own (#99).

export const alt = SITE_IMAGE.alt;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return brandImage({
    eyebrow: "Belgisch volleybal",
    title: "Zoekertjes, transfers en Transfer Talk",
    subtitle: "Vind je club, speler of trainer",
  });
}
