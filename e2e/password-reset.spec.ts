import { randomUUID } from "crypto";
import type { Page } from "@playwright/test";
import { test, expect, loginAs, resetUsers, seedUsers } from "./fixtures";
import { getAuthLinkFromEmail } from "./mailpit";

// #58: the reset email used to land on a 404. Each run sets a new random
// password, so the tests don't depend on the account's current one.

async function requestResetEmail(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByRole("button", { name: "Wachtwoord vergeten?" }).click();
  await page.getByLabel("E-mailadres").fill(email);
  const sentAt = new Date(Date.now() - 1_000);
  await page.getByRole("button", { name: "Herstelmail versturen" }).click();
  await expect(
    page.getByText(
      "Als dit e-mailadres is geregistreerd, ontvang je een e-mail",
    ),
  ).toBeVisible();
  return getAuthLinkFromEmail(email, sentAt);
}

async function setPasswordFromLink(page: Page, link: string, username: string) {
  await page.goto(link);
  await page.waitForURL("/auth/update-password");
  await expect(
    page.getByText("Nieuw wachtwoord instellen", { exact: true }),
  ).toBeVisible();

  await page
    .getByLabel("Nieuw wachtwoord", { exact: true })
    .fill("lang-genoeg-1");
  await page.getByLabel("Bevestig nieuw wachtwoord").fill("iets-anders-2");
  await page.getByRole("button", { name: "Wachtwoord instellen" }).click();
  await expect(page.getByText("Wachtwoorden komen niet overeen")).toBeVisible();

  const password = `nieuw-${randomUUID()}`;
  await page.getByLabel("Nieuw wachtwoord", { exact: true }).fill(password);
  await page.getByLabel("Bevestig nieuw wachtwoord").fill(password);
  await page.getByRole("button", { name: "Wachtwoord instellen" }).click();
  await expect(page.getByText("Je wachtwoord is ingesteld.")).toBeVisible();
  await page.waitForURL("/");
  await expect(page.getByRole("banner").getByText(username)).toBeVisible();
  return password;
}

async function loginWithPassword(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Inloggen", exact: true })
    .click();
}

test("the reset link lets a user set a new password and log in with it", async ({
  page,
  context,
}) => {
  const { email, username } = resetUsers.reset;
  const link = await requestResetEmail(page, email);
  const password = await setPasswordFromLink(page, link, username);

  // The link works once.
  await context.clearCookies();
  await page.goto(link);
  await page.waitForURL("/auth/login");
  await expect(
    page.getByText("Je herstellink is ongeldig of verlopen."),
  ).toBeVisible();

  await loginWithPassword(page, email, password);
  await page.waitForURL("/");
  await expect(page.getByRole("banner").getByText(username)).toBeVisible();
});

test("a Google-only account adds a password through the reset link", async ({
  page,
  context,
}) => {
  const { email, username } = resetUsers.google;

  // No password yet, so password login fails like any wrong password.
  await loginWithPassword(page, email, "test-wachtwoord");
  await expect(
    page.getByText("Ongeldig e-mailadres of wachtwoord."),
  ).toBeVisible();

  const link = await requestResetEmail(page, email);
  const password = await setPasswordFromLink(page, link, username);

  await context.clearCookies();
  await loginWithPassword(page, email, password);
  await page.waitForURL("/");
  await expect(page.getByRole("banner").getByText(username)).toBeVisible();
});

test("the page refuses visitors without a reset link", async ({ page }) => {
  await page.goto("/auth/update-password");
  await expect(
    page.getByText("Herstellink ongeldig", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Nieuw wachtwoord", { exact: true }),
  ).toHaveCount(0);

  // A normal login is no reset link: it changes its password on the profile.
  await loginAs(page, "jana");
  await page.goto("/auth/update-password");
  await expect(
    page.getByText("Herstellink ongeldig", { exact: true }),
  ).toBeVisible();
});

test("the profile page sends a link to set a password", async ({ page }) => {
  await loginAs(page, "tom");
  await page.goto("/profile");
  const sentAt = new Date(Date.now() - 1_000);
  await page.getByRole("button", { name: "Stuur me een link" }).click();
  await expect(
    page.getByText(
      "Check je mailbox voor de link om je wachtwoord in te stellen.",
    ),
  ).toBeVisible();
  expect(await getAuthLinkFromEmail(seedUsers.tom.email, sentAt)).toContain(
    "type=recovery",
  );
});
