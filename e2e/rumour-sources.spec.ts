import {
  expect,
  loginAs,
  pageFor,
  queueItem,
  seed,
  seedUsers,
  SEED_PASSWORD,
  submitRumour,
  test,
} from "./fixtures";

// Rumours name a source, carry the author's declarations, and one author can
// have at most 5 waiting for a moderator (issue #67, #54, D-013).

test("the form asks for a source and both declarations", async ({ page }) => {
  await loginAs(page, "jana");
  await page.goto("/geruchten/nieuw");
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Trainer Stopt" }).click();

  await expect(
    page.locator('select[name="sourceType"]'),
    "the source type is required",
  ).toHaveAttribute("required", "");
  await expect(page.getByLabel(/Link naar de bron/)).not.toHaveAttribute(
    "required",
  );
  await expect(page.getByLabel(/seniorspeler of -trainer/)).toHaveAttribute(
    "required",
    "",
  );
  await expect(page.getByLabel(/te goeder trouw/)).toHaveAttribute(
    "required",
    "",
  );
});

test("the source is on the queue card and, once approved, on Transfer Talk", async ({
  page,
  browser,
}) => {
  const lastName = `Bron${Date.now()}`;
  const playerName = `Toon ${lastName}`;
  const url = `https://example.test/artikel/${lastName}`;

  await loginAs(page, "tom");
  await submitRumour(page, lastName, {
    type: "Media (krant, website, sociale media)",
    url,
  });

  const moderator = await pageFor(browser, "moderator");
  await moderator.goto("/admin/wachtrij");
  const item = queueItem(moderator, playerName);
  await expect(item).toContainText("Media (krant, website, sociale media)");
  await expect(item.getByRole("link", { name: url })).toHaveAttribute(
    "href",
    url,
  );
  await expect(item).toContainText("Senior en te goeder trouw bevestigd");
  await item.getByRole("button", { name: "Goedkeuren" }).click();
  await expect(
    moderator.getByText(`Gerucht over ${playerName} goedgekeurd`),
  ).toBeVisible();

  await page.goto("/geruchten");
  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: playerName }) });
  await expect(card.getByText("Bron: Media")).toBeVisible();
  await card.getByRole("button", { name: "Bekijk meer" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("link", { name: "Bekijk bron" }),
  ).toHaveAttribute("href", url);
});

test("rumours from before sources still show, without one", async ({
  page,
}) => {
  await page.goto("/geruchten");
  const card = (name: string) =>
    page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole("heading", { name }) });

  await expect(
    card(seed.openRumour.playerName).getByText(
      `Bron: ${seed.openRumour.sourceLabel}`,
    ),
  ).toBeVisible();
  await expect(card(seed.rumourWithoutSource.playerName)).toBeVisible();
  await expect(
    card(seed.rumourWithoutSource.playerName).getByText(/^Bron:/),
  ).toHaveCount(0);
});

test("an author with 5 rumours waiting can't share another", async ({
  page,
}) => {
  await loginAs(page, "wachtrij");
  await page.goto("/geruchten/nieuw");
  await expect(page.getByRole("status")).toContainText(
    "Je hebt al 5 geruchten die op een moderator wachten",
  );
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Trainer Stopt" }).click();
  const share = page.getByRole("button", { name: "Gerucht Delen" });
  await expect(share).toBeDisabled();

  // The server refuses it too: the database enforces the cap.
  await page.getByLabel(/Achternaam/).fill(`Zesde${Date.now()}`);
  await page.getByLabel(/Voornaam/).fill("Toon");
  await page.getByLabel(/Huidige Club/).fill("VC Testdorp");
  await page.getByLabel(/Waar komt je gerucht vandaan/).click();
  await page.getByRole("option", { name: "Eigen waarneming" }).click();
  await page.getByLabel(/seniorspeler of -trainer/).check();
  await page.getByLabel(/te goeder trouw/).check();
  await share.evaluate((button: HTMLButtonElement) => {
    button.disabled = false;
  });
  await share.click();
  await expect(
    page.getByText("Je hebt al 5 geruchten die op een moderator wachten"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Je gerucht wordt nagekeken" }),
  ).toHaveCount(0);
});

test("a visitor who logs in from the form comes back to it", async ({
  page,
}) => {
  await page.goto("/geruchten/nieuw");
  await page.waitForURL(/\/auth\/login\?next=(%2F|\/)geruchten(%2F|\/)nieuw$/);

  await page.getByLabel("E-mailadres").fill(seedUsers.jana.email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(SEED_PASSWORD);
  await page
    .locator("form")
    .getByRole("button", { name: "Inloggen", exact: true })
    .click();

  await page.waitForURL("/geruchten/nieuw");
  await expect(page.getByText("Nieuw Gerucht")).toBeVisible();
});

test("the login page ignores a return address on another site", async ({
  page,
}) => {
  await page.goto("/auth/login?next=//example.com/");
  await page.getByLabel("E-mailadres").fill(seedUsers.jana.email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(SEED_PASSWORD);
  await page
    .locator("form")
    .getByRole("button", { name: "Inloggen", exact: true })
    .click();
  await page.waitForURL("/");
});
