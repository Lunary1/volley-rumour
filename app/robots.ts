import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// #99: crawlers may read the public pages. Account, staff and form pages are
// off limits; they also carry noindex. Rumour pages are crawlable but noindex
// (D-035), so a crawler sees that and drops them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/auth/",
        "/messages",
        "/profile",
        "/welkom",
        "/zoekertjes/mijn",
        "/zoekertjes/nieuw",
        "/zoekertjes/*/bewerken",
        "/geruchten/nieuw",
        "/verwijderverzoek/status/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
