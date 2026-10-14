import { randomUUID } from "node:crypto";
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
  // Same Datadog block as the `page` fixture.
  for (const context of [janaContext, clubContext]) {
    await context.route(/datadoghq\.eu/, (route) => route.abort());
  }

  await loginAs(club, "club");
  await club.goto(conversationUrl);
  await expect(club.getByText(seed.conversation.firstMessage)).toBeVisible();
  // Wait until both chats listen to Realtime; earlier events are not replayed.
  await expect(club.locator('[data-realtime="ready"]')).toBeAttached();

  await loginAs(jana, "jana");
  await jana.goto(conversationUrl);
  await expect(jana.locator('[data-realtime="ready"]')).toBeAttached();
  const text = `Testbericht ${randomUUID()}`;
  await jana.getByPlaceholder("Type je bericht...").fill(text);
  await jana.getByRole("button", { name: "Verstuur bericht" }).click();

  // Club has the conversation open: the message appears without a reload,
  // and opening it marks it read, which Jana sees as a read receipt.
  await expect(club.getByText(text)).toBeVisible();
  const janaMessage = jana.getByText(text).locator("xpath=../..");
  await expect(janaMessage.getByRole("img", { name: "Gelezen" })).toBeVisible();

  await janaContext.close();
  await clubContext.close();
});
