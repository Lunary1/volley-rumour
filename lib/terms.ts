// Age and terms gate (#75, D-003): a logged-in user who hasn't confirmed 16+
// and accepted the current terms is sent to /welkom by the proxy, from every
// route except the ones below. The database knows the current version
// (`current_terms_version()`); the proxy asks `has_accepted_terms()`.

export const WELCOME_PATH = "/welkom";

// Holds the id of the user the proxy last saw accept, for this browser
// session, so it doesn't ask the database on every request. Logging in as
// someone else, or a new browser session, asks again.
export const TERMS_COOKIE = "vr_terms_ok";

// Reading the terms, logging in or out, resetting a password and asking for a
// takedown stay possible without accepting.
const OPEN_PATHS = new Set([
  WELCOME_PATH,
  "/privacy",
  "/voorwaarden",
  "/over-ons",
  "/contact",
]);
const OPEN_PREFIXES = ["/auth/", "/verwijderverzoek", "/_"];

export function isOpenWithoutTerms(pathname: string): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return (
    OPEN_PATHS.has(normalized) ||
    OPEN_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}
