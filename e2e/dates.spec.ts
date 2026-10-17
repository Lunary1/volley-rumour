import { test, expect, loginAs, seed } from "./fixtures";

// #142: dates are shown in Belgian time. The test server renders in UTC (like
// Vercel) and the browser runs in Europe/Brussels. The seeded message was sent
// at 23:30 UTC on 10 March, which is 00:30 on 11 March in Belgium: formatted
// in each side's own timezone, server and browser disagree on the day, React
// fails to hydrate (#418) and re-renders, which wiped typed messages.

test("a message sent late in the evening shows its Belgian date without a hydration error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await loginAs(page, "kandidaat");
  await page.goto(`/messages/${seed.lateConversation.id}`);
  await expect(page.getByText(seed.lateConversation.message)).toBeVisible();
  await expect(page.locator('[data-realtime="ready"]')).toBeAttached();

  expect(errors.filter((error) => /#418|hydrat/i.test(error))).toEqual([]);
  await expect(page.getByText("11 maart 2026", { exact: true })).toBeVisible();
  await expect(
    page.locator('time[title="11 mrt. 2026 00:30"]').first(),
  ).toBeAttached();
});
