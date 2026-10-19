// Coming-soon mode (D-009): while NEXT_PUBLIC_COMING_SOON is "true", only the
// homepage and the info pages it links to are reachable. Every other route is
// redirected to "/" by the proxy, and the header and footer hide their links.
// /auth/callback is excluded from the proxy matcher, so it stays reachable.

const OPEN_PATHS = new Set([
  "/",
  "/privacy",
  "/voorwaarden",
  "/over-ons",
  "/contact",
  // Search and share files (#99): the sitemap then lists only these pages.
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image",
]);

export function isComingSoon(): boolean {
  return process.env.NEXT_PUBLIC_COMING_SOON === "true";
}

export function isOpenDuringComingSoon(pathname: string): boolean {
  // Framework internals (e.g. /_next/*, /__nextjs_*) are never pages; app
  // routes can't start with "_" because those are private folders.
  if (pathname.startsWith("/_")) return true;

  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return OPEN_PATHS.has(normalized);
}
