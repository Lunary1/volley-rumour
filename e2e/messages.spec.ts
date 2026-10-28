import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect, loginAs, seed, seedUsers } from "./fixtures";

// Messaging after the load-on-mount rewrite (#62): the list and the first
// messages are rendered on the server, new messages and read receipts arrive
// through Realtime.

const conversationUrl = `/messages/${seed.conversation.id}`;

test("messages list links to the conversation", async ({ page }) => {
  await loginAs(page, "jana");
  await page.goto("/messages");
  await expect(
    page.getByRole("heading", { level: 1, name: "Berichten" }),
  ).toBeVisible();

  await page.locator(`a[href="${conversationUrl}"]`).click();
  await expect(page).toHaveURL(conversationUrl);
  await expect(
    page.getByRole("heading", { level: 1, name: seedUsers.club.username }),
  ).toBeVisible();
  await expect(page.getByText(seed.conversation.firstMessage)).toBeVisible();
});

test("a message arrives live and the sender sees it was read", async ({
  browser,
}) => {
  // Two sessions that each log in: too slow for the default timeout when the
  // whole suite runs in parallel.
  test.slow();
  const janaContext = await browser.newContext();
  const clubContext = await browser.newContext();
  const jana = await janaContext.newPage();
  const club = await clubContext.newPage();

  await loginAs(club, "club");
  await club.goto(conversationUrl);
  await expect(club.getByText(seed.conversation.firstMessage)).toBeVisible();
  // Wait until both chats listen to Realtime; earlier events are not replayed.
  await expect(club.locator('[data-realtime="ready"]')).toBeAttached();

  await loginAs(jana, "jana");
  await jana.goto(conversationUrl);
  await expect(jana.locator('[data-realtime="ready"]')).toBeAttached();
  const text = `Testbericht ${randomUUID()}`;
  await jana.getByPlaceholder("Typ je bericht...").fill(text);
  await jana.getByRole("button", { name: "Verstuur bericht" }).click();

  // Club has the conversation open: the message appears without a reload,
  // and opening it marks it read, which Jana sees as a read receipt.
  await expect(club.getByText(text)).toBeVisible();
  const janaMessage = jana.getByText(text).locator("xpath=../..");
  await expect(janaMessage.getByRole("img", { name: "Gelezen" })).toBeVisible();

  await janaContext.close();
  await clubContext.close();
});

// #104: the conversation fits under the site header, so the message box is
// on screen without scrolling the page, also on a phone.
for (const [device, viewport] of [
  ["a phone", { width: 390, height: 844 }],
  ["a desktop", { width: 1280, height: 720 }],
] as const) {
  test(`the message box is on screen without scrolling on ${device}`, async ({
    page,
  }) => {
    // Log in first: loginAs waits for the username in the header, which a
    // phone hides behind the menu.
    await loginAs(page, "jana");
    await page.setViewportSize(viewport);
    await page.goto(conversationUrl);
    await expect(page.getByText(seed.conversation.firstMessage)).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 1, name: seedUsers.club.username }),
    ).toBeInViewport();
    await expect(page.getByPlaceholder("Typ je bericht...")).toBeInViewport({
      ratio: 1,
    });
    await expect(
      page.getByRole("button", { name: "Verstuur bericht" }),
    ).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
}

// #268: the actions put ids into PostgREST filter strings, so anything that
// isn't a UUID is refused before a query. A client can send any arguments, so
// the test rewrites the ones the page sends and reads the action's answer.
async function rewriteActionArgument(page: Page, index: number, value: string) {
  let answer: (body: string) => void;
  const body = new Promise<string>((resolve) => (answer = resolve));
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || !request.headers()["next-action"]) {
      return route.fallback();
    }
    const args = JSON.parse(request.postData() ?? "[]");
    args[index] = value;
    const response = await route.fetch({ postData: JSON.stringify(args) });
    answer(await response.text());
    await route.fulfill({ response });
  });
  return { body };
}

test("a conversation id that isn't a UUID is refused (#268)", async ({
  page,
}) => {
  await loginAs(page, "jana");
  const { body } = await rewriteActionArgument(
    page,
    0,
    `${seed.conversation.id},id.neq.x`,
  );

  await page.goto(conversationUrl);
  await page.getByPlaceholder("Typ je bericht...").fill("Hallo");
  await page.getByRole("button", { name: "Verstuur bericht" }).click();
  expect(await body).toContain("Ongeldig conversatie ID");
});

test("a recipient id that isn't a UUID is refused (#268)", async ({ page }) => {
  await loginAs(page, "tom");
  await page.goto(`/zoekertjes/${seed.activeAd.id}`);
  const { body } = await rewriteActionArgument(page, 1, "x),or(id.not.is.null");

  await page.getByRole("button", { name: "Contact opnemen" }).click();
  expect(await body).toContain("Ongeldige gebruiker");
});
