import { randomUUID } from "node:crypto";
import { test, expect, loginAs, pageFor, seed, seedUsers } from "./fixtures";

// Blocking (#73, J-07): a block stops messages in both directions, checked by
// the database when sending, and is lifted from the profile page.

const { id, message } = seed.blockConversation;
const conversationUrl = `/messages/${id}`;
const jana = seedUsers.jana.username;

test("a block refuses messages until it is lifted from the profile", async ({
  page,
  browser,
}) => {
  // Jana has the conversation open with the message box before Tom blocks.
  const janaPage = await pageFor(browser, "jana");
  await janaPage.goto(conversationUrl);
  await expect(janaPage.getByText(message)).toBeVisible();
  const box = janaPage.getByPlaceholder("Typ je bericht...");
  await expect(box).toBeVisible();

  // Tom blocks Jana, after a confirmation. Cancelling blocks nothing.
  await loginAs(page, "tom");
  await page.goto(conversationUrl);
  await page.getByRole("button", { name: "Blokkeren", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `${jana} blokkeren?` });
  await expect(dialog).toContainText("geen berichten meer sturen");
  await dialog.getByRole("button", { name: "Annuleren" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByPlaceholder("Typ je bericht...")).toBeVisible();

  await page.getByRole("button", { name: "Blokkeren", exact: true }).click();
  await dialog.getByRole("button", { name: `Blokkeer ${jana}` }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("status").filter({ hasText: "Jullie kunnen elkaar" }),
  ).toContainText(`Je hebt ${jana} geblokkeerd.`);
  // The history stays, the message box goes.
  await expect(page.getByText(message)).toBeVisible();
  await expect(page.getByPlaceholder("Typ je bericht...")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Blokkeren", exact: true }),
  ).toHaveCount(0);

  // Jana's page still shows the box, but the server refuses the message.
  const refused = `Geweigerd ${randomUUID()}`;
  await box.fill(refused);
  await janaPage.getByRole("button", { name: "Verstuur bericht" }).click();
  await expect(
    janaPage.getByText("Je kan deze gebruiker geen berichten sturen").first(),
  ).toBeVisible();
  await janaPage.reload();
  await expect(
    janaPage.getByRole("status").filter({
      hasText: "Je kan deze gebruiker geen berichten sturen",
    }),
  ).toBeVisible();
  await expect(janaPage.getByText(refused)).toHaveCount(0);
  await expect(janaPage.getByPlaceholder("Typ je bericht...")).toHaveCount(0);

  // Tom lifts the block from his profile.
  await page.goto("/profile");
  await expect(page.getByText("Geblokkeerde gebruikers")).toBeVisible();
  // The report tests block vc_testdorp as Tom too, so the list may not be
  // empty: only Jana has to go.
  const unblock = page.getByRole("button", { name: `${jana} deblokkeren` });
  await unblock.click();
  await expect(unblock).toHaveCount(0);

  // Jana can write again.
  await janaPage.reload();
  const sent = `Weer welkom ${randomUUID()}`;
  await janaPage.getByPlaceholder("Typ je bericht...").fill(sent);
  await janaPage.getByRole("button", { name: "Verstuur bericht" }).click();
  await expect(janaPage.getByText(sent)).toBeVisible();
  await janaPage.reload();
  await expect(janaPage.getByText(sent)).toBeVisible();

  await janaPage.context().close();
});
