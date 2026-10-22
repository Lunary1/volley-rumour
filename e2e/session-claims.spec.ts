import type { Page } from "@playwright/test";
import { test, expect, loginAs, seedUsers } from "./fixtures";

// The proxy and the page render read the user from the session's JWT with
// getClaims() (#212): verified against the project's public signing key, so a
// logged-in page makes no call to Supabase Auth. These tests pin down what
// getUser() used to guarantee: an expired session is refreshed, and a token
// that doesn't carry the project's signature counts for nothing.

const TOM_ID = "a0000000-0000-4000-8000-000000000002";
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

type Session = { access_token: string; expires_at: number };

/** The Supabase session stored in the page's cookies (maybe in chunks). */
async function readSession(page: Page): Promise<Session> {
  const chunks = (await page.context().cookies())
    .filter((cookie) => AUTH_COOKIE.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  const value = chunks.map((cookie) => cookie.value).join("");
  return JSON.parse(
    Buffer.from(value.replace(/^base64-/, ""), "base64url").toString(),
  );
}

/** Replaces the session cookies with one cookie holding `session`. */
async function writeSession(page: Page, session: Session) {
  const context = page.context();
  const cookies = (await context.cookies()).filter((cookie) =>
    AUTH_COOKIE.test(cookie.name),
  );
  const name = cookies[0].name.replace(/\.\d+$/, "");
  await context.clearCookies({ name: AUTH_COOKIE });
  await context.addCookies([
    {
      ...cookies[0],
      name,
      value:
        "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"),
    },
  ]);
}

test("the proxy refreshes an expired session and the user stays logged in", async ({
  page,
}) => {
  await loginAs(page, "jana");
  const session = await readSession(page);
  await writeSession(page, { ...session, expires_at: 1 });

  const response = await page.goto("/over-ons");
  // The server's own response carries the new session, not a later refresh
  // by the browser's Supabase client.
  const setCookies = (await response!.headersArray()).filter(
    ({ name }) => name.toLowerCase() === "set-cookie",
  );
  expect(setCookies.some(({ value }) => /^sb-.+-auth-token/.test(value))).toBe(
    true,
  );
  await expect(
    page.getByRole("banner").getByText(seedUsers.jana.username),
  ).toBeVisible();
  const refreshed = await readSession(page);
  expect(refreshed.access_token).not.toBe(session.access_token);
  expect(refreshed.expires_at * 1000).toBeGreaterThan(Date.now());
});

test("a token with someone else's id but not the project's signature counts as logged out", async ({
  page,
}) => {
  await loginAs(page, "jana");
  const session = await readSession(page);
  const [header, payload, signature] = session.access_token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  const forged = Buffer.from(
    JSON.stringify({ ...claims, sub: TOM_ID }),
  ).toString("base64url");
  await writeSession(page, {
    ...session,
    access_token: `${header}.${forged}.${signature}`,
  });

  await page.goto("/over-ons");
  const banner = page.getByRole("banner");
  await expect(banner.getByRole("link", { name: "Inloggen" })).toBeVisible();
  await expect(banner.getByText(seedUsers.tom.username)).toHaveCount(0);
  await expect(banner.getByText(seedUsers.jana.username)).toHaveCount(0);
});
