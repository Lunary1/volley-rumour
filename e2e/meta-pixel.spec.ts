import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  E2E_SERVER_ENV,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./local-supabase.mjs";

// The Meta Pixel behind the cookie banner (#288, D-054): nothing of Meta's
// loads before "Accepteren", refusing is one click, and the footer reopens
// the choice. Meta's script is stubbed: it records every call in
// window.__metaCalls instead of sending it.

const PIXEL_ID = E2E_SERVER_ENV.NEXT_PUBLIC_META_PIXEL_ID;
const META_HOST = /(^|\.)(facebook\.net|facebook\.com)$/;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// No choice made yet, unlike every other spec.
test.use({ storageState: { cookies: [], origins: [] } });

declare global {
  interface Window {
    __metaCalls?: unknown[][];
  }
}

/** Stubs Meta's hosts and returns every request the page made to them. */
async function stubMeta(page: Page) {
  const requests: string[] = [];
  await page.route(
    (url) => META_HOST.test(url.hostname),
    (route) => {
      requests.push(route.request().url());
      return route.fulfill({
        contentType: "application/javascript",
        body: `
          window.__metaCalls = window.__metaCalls || [];
          window.fbq.callMethod = (...args) => window.__metaCalls.push(args);
          window.fbq.queue.forEach((args) => window.__metaCalls.push(args));
          window.fbq.queue = [];
        `,
      });
    },
  );
  return requests;
}

function metaCalls(page: Page) {
  return page.evaluate(() => window.__metaCalls ?? []);
}

async function countTracked(page: Page, event: string) {
  return (await metaCalls(page)).filter(
    ([method, name]) => method === "track" && name === event,
  ).length;
}

function banner(page: Page) {
  return page.getByRole("region", { name: "Cookies" });
}

test("nothing of Meta's loads before a choice, or after refusing", async ({
  page,
}) => {
  const requests = await stubMeta(page);
  await page.goto("/privacy");

  await expect(banner(page)).toBeVisible();
  await expect(
    banner(page).getByRole("link", { name: "privacybeleid" }),
  ).toHaveAttribute("href", "/privacy#cookies");

  await banner(page).getByRole("button", { name: "Weigeren" }).click();
  await expect(banner(page)).toBeHidden();

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(banner(page)).toBeHidden();
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => typeof window.fbq)).toBe("undefined");
});

test("accepting loads the Pixel, which counts page views and a waitlist sign-up", async ({
  page,
}) => {
  const requests = await stubMeta(page);
  const email = `pixel-${Date.now()}@example.test`;
  await page.goto("/e2e-binnenkort");

  // The server sets the choice again, so Safari keeps it six months.
  const saved = page.waitForResponse("**/cookie-keuze");
  await banner(page).getByRole("button", { name: "Accepteren" }).click();
  await expect(banner(page)).toBeHidden();
  const response = await saved;
  expect(response.status()).toBe(204);
  expect(await response.headerValue("set-cookie")).toMatch(
    /vr_cookie_consent=granted;.*Max-Age=15724800/,
  );
  await expect.poll(() => countTracked(page, "PageView")).toBe(1);
  expect(await metaCalls(page)).toContainEqual(["init", PIXEL_ID]);
  expect(requests[0]).toContain("connect.facebook.net/en_US/fbevents.js");

  try {
    await page.getByPlaceholder("jouw@email.be").fill(email);
    await page.getByRole("button", { name: "Inschrijven" }).click();
    await expect(
      page.getByText("Bedankt! Je hoort van ons bij de lancering."),
    ).toBeVisible();
    await expect.poll(() => countTracked(page, "Lead")).toBe(1);
  } finally {
    await admin.from("waitlist_subscribers").delete().eq("email", email);
  }

  // No advanced matching: the email address never reaches Meta.
  expect(JSON.stringify(await metaCalls(page))).not.toContain(email);

  // A page change in the browser is a page view too.
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Privacy" })
    .click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect.poll(() => countTracked(page, "PageView")).toBe(2);
});

test("the footer reopens the choice, and refusing then stops the Pixel", async ({
  page,
  context,
}) => {
  await stubMeta(page);
  await page.goto("/privacy");
  await banner(page).getByRole("button", { name: "Accepteren" }).click();
  await expect.poll(() => countTracked(page, "PageView")).toBe(1);
  // What Meta's real script would have set.
  await page.evaluate(() => {
    document.cookie = "_fbp=fb.1.1.1; Path=/";
  });

  await page
    .getByRole("contentinfo")
    .getByRole("button", { name: "Cookie-instellingen" })
    .click();
  await banner(page).getByRole("button", { name: "Weigeren" }).click();
  await expect(banner(page)).toBeHidden();

  expect(await metaCalls(page)).toContainEqual(["consent", "revoke"]);
  const cookies = await context.cookies();
  expect(cookies.map((c) => c.name)).not.toContain("_fbp");
  expect(cookies.find((c) => c.name === "vr_cookie_consent")?.value).toBe(
    "denied",
  );

  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Voorwaarden" })
    .click();
  await expect(page).toHaveURL(/\/voorwaarden$/);
  await page.waitForLoadState("networkidle");
  expect(await countTracked(page, "PageView")).toBe(1);
});

test("a new account counts as a registration", async ({ page }) => {
  await stubMeta(page);
  const stamp = Date.now();
  const email = `pixel-account-${stamp}@example.test`;
  await page.goto("/auth/sign-up");
  await banner(page).getByRole("button", { name: "Accepteren" }).click();

  try {
    await page.getByLabel("Gebruikersnaam").fill(`pixel_${stamp}`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Wachtwoord").fill("test-wachtwoord");
    await page.getByLabel("Ik bevestig dat ik 16 jaar of ouder ben.").check();
    await page.getByLabel(/Ik aanvaard de voorwaarden/).check();
    await page
      .locator("form")
      .getByRole("button", { name: "Registreren" })
      .click();
    await expect(page.getByText("Controleer je e-mail")).toBeVisible();
    await expect.poll(() => countTracked(page, "CompleteRegistration")).toBe(1);
    expect(JSON.stringify(await metaCalls(page))).not.toContain(email);
  } finally {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = data.users.find((u) => u.email === email);
    if (user) await admin.auth.admin.deleteUser(user.id);
  }
});

// Ad blockers: Meta's script blocked, or fbq replaced by a stand-in that
// throws. The waitlist, sign-up and navigation must work the same.
test.describe("with an ad blocker", () => {
  test("Meta's script blocked: the waitlist and page changes still work", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(
      (url) => META_HOST.test(url.hostname),
      (route) => route.abort("blockedbyclient"),
    );
    const email = `pixel-blok-${Date.now()}@example.test`;
    await page.goto("/e2e-binnenkort");
    await banner(page).getByRole("button", { name: "Accepteren" }).click();

    try {
      await page.getByPlaceholder("jouw@email.be").fill(email);
      await page.getByRole("button", { name: "Inschrijven" }).click();
      await expect(
        page.getByText("Bedankt! Je hoort van ons bij de lancering."),
      ).toBeVisible();
    } finally {
      await admin.from("waitlist_subscribers").delete().eq("email", email);
    }

    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Privacy" })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Privacybeleid" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a stand-in fbq that throws doesn't stop a sign-up", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const broken = () => {
        throw new Error("blocked");
      };
      Object.assign(window, { fbq: broken, _fbq: broken });
    });
    const stamp = Date.now();
    const email = `pixel-stub-${stamp}@example.test`;
    await page.goto("/auth/sign-up");
    await banner(page).getByRole("button", { name: "Accepteren" }).click();

    try {
      await page.getByLabel("Gebruikersnaam").fill(`stub_${stamp}`);
      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Wachtwoord").fill("test-wachtwoord");
      await page.getByLabel("Ik bevestig dat ik 16 jaar of ouder ben.").check();
      await page.getByLabel(/Ik aanvaard de voorwaarden/).check();
      await page
        .locator("form")
        .getByRole("button", { name: "Registreren" })
        .click();
      await expect(page.getByText("Controleer je e-mail")).toBeVisible();
    } finally {
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const user = data.users.find((u) => u.email === email);
      if (user) await admin.auth.admin.deleteUser(user.id);
    }
    expect(errors).toEqual([]);
  });

  test("cookies blocked: the choice holds for the visit", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, "cookie", {
        get: () => "",
        set: () => {},
        configurable: true,
      });
    });
    await page.route("**/cookie-keuze", (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.goto("/privacy");
    await banner(page).getByRole("button", { name: "Weigeren" }).click();
    await expect(banner(page)).toBeHidden();

    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Voorwaarden" })
      .click();
    await expect(page).toHaveURL(/\/voorwaarden$/);
    await expect(banner(page)).toBeHidden();
  });
});

// The banner is in the server HTML, so it paints with the page instead of
// becoming a late LCP element on phones; for a stored choice, a script in
// <head> hides it before the first paint. Checked with the app's JavaScript
// blocked, so nothing hydrates.
test("the banner paints with the page, and never for a stored choice", async ({
  page,
  context,
}) => {
  await page.route("**/_next/static/chunks/*.js", (route) => route.abort());
  await page.goto("/privacy");
  await expect(banner(page)).toBeVisible();

  await context.addCookies([
    {
      name: "vr_cookie_consent",
      value: "denied",
      url: test.info().project.use.baseURL!,
    },
  ]);
  await page.goto("/privacy");
  await expect(page.locator("[data-cookie-banner]")).toHaveCount(1);
  await expect(banner(page)).toBeHidden();
});
