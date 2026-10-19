import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import { isComingSoon, isOpenDuringComingSoon } from "@/lib/coming-soon";
import { SITE_URL } from "@/lib/site-url";

// #99: public pages and online zoekertjes. Rumours are left out: their pages
// are noindex so a player's name isn't searchable next to a rumour (D-035).
// Read on request, so a removed or expired ad drops out at once.
export const dynamic = "force-dynamic";

const PUBLIC_PATHS = [
  "/",
  "/zoekertjes",
  "/geruchten",
  "/transfers",
  "/betrouwbare-bronnen",
  "/over-ons",
  "/contact",
  "/privacy",
  "/voorwaarden",
  "/verwijderverzoek",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = PUBLIC_PATHS.filter(
    (path) => !isComingSoon() || isOpenDuringComingSoon(path),
  ).map((path) => ({ url: `${SITE_URL}${path}` }));
  if (isComingSoon()) return pages;

  // The public client reads as a visitor, so RLS already hides offline ads;
  // the filters say so explicitly.
  const { data, error } = await createPublicClient()
    .from("classifieds")
    .select("id, updated_at")
    .eq("is_active", true)
    .is("removed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) console.error("Error loading zoekertjes for the sitemap:", error);

  return [
    ...pages,
    ...(data ?? []).map((ad) => ({
      url: `${SITE_URL}/zoekertjes/${ad.id}`,
      lastModified: ad.updated_at ?? undefined,
    })),
  ];
}
