import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Page } from "@playwright/test";
import { SEED_PASSWORD, test, expect } from "./fixtures";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// Profile pictures are uploaded to our own Storage, not linked (issue #92,
// J-11). Who may write which file is tested in pgTAP
// (avatar_uploads.test.sql). Each test has its own throwaway account,
// because the header shows the picture.

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const publicPrefix = `${SUPABASE_URL}/storage/v1/object/public/avatars/`;

async function throwawayUser(page: Page, name: string) {
  const stamp = Date.now();
  const email = `${name}-${stamp}@example.test`;
  const username = `${name}_${stamp}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { username, age_confirmed: true, terms_accepted: true },
  });
  expect(error).toBeNull();

  await page.goto("/auth/login");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(SEED_PASSWORD);
  await page
    .locator("form")
    .getByRole("button", { name: "Inloggen", exact: true })
    .click();
  await page.waitForURL("/");
  return data.user!.id;
}

async function openEditDialog(page: Page) {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Bewerk profiel" }).click();
  return page.getByRole("dialog", { name: "Bewerk profiel" });
}

// A large photo with camera and location data, as a phone makes it.
function phonePhoto() {
  return sharp({
    create: { width: 1200, height: 900, channels: 3, background: "#c0392b" },
  })
    .jpeg()
    .withExif({
      IFD0: { Make: "Testfoon", Model: "VR-1" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "50/1 51/1 0/1" },
    })
    .toBuffer();
}

test("a user uploads, replaces and removes their profile picture", async ({
  page,
}) => {
  const userId = await throwawayUser(page, "fotograaf");
  try {
    const dialog = await openEditDialog(page);
    // The old free-text URL field is gone.
    await expect(dialog.getByPlaceholder("https://...")).toHaveCount(0);

    const photo = await phonePhoto();
    const original = await sharp(photo).metadata();
    expect(original.exif).toBeDefined();

    await dialog.getByLabel("Foto kiezen").setInputFiles({
      name: "vakantie.jpg",
      mimeType: "image/jpeg",
      buffer: photo,
    });
    await expect(page.getByText("Je profielfoto is bijgewerkt.")).toBeVisible();

    const preview = dialog.getByRole("img", { name: "Je profielfoto" });
    await expect(preview).toHaveAttribute(
      "src",
      new RegExp(`^${publicPrefix}${userId}/[0-9a-f-]{36}\\.webp$`),
    );
    const firstUrl = (await preview.getAttribute("src"))!;

    // Stored as a 400x400 WebP without the camera or location data.
    const response = await page.request.get(firstUrl);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toBe("image/webp");
    const stored = await sharp(await response.body()).metadata();
    expect(stored.format).toBe("webp");
    expect([stored.width, stored.height]).toEqual([400, 400]);
    expect(stored.exif).toBeUndefined();

    // The header shows it after a reload as well.
    await page.reload();
    await expect(
      page.getByRole("banner").locator(`img[src="${firstUrl}"]`),
    ).toBeVisible();

    // A new picture replaces the old file.
    const replaced = await openEditDialog(page);
    await replaced.getByLabel("Foto kiezen").setInputFiles({
      name: "nieuw.png",
      mimeType: "image/png",
      buffer: await sharp({
        create: { width: 300, height: 500, channels: 4, background: "#2980b9" },
      })
        .png()
        .toBuffer(),
    });
    await expect(page.getByText("Je profielfoto is bijgewerkt.")).toBeVisible();
    await expect(
      replaced.getByRole("img", { name: "Je profielfoto" }),
    ).not.toHaveAttribute("src", firstUrl);
    expect((await page.request.get(firstUrl)).ok()).toBe(false);

    const { data: files } = await admin.storage.from("avatars").list(userId);
    expect(files).toHaveLength(1);

    // Removing it brings back the initials and deletes the file.
    await replaced.getByRole("button", { name: "Foto verwijderen" }).click();
    await expect(page.getByText("Je profielfoto is verwijderd.")).toBeVisible();
    await expect(
      replaced.getByRole("img", { name: "Je profielfoto" }),
    ).toHaveCount(0);
    const { data: left } = await admin.storage.from("avatars").list(userId);
    expect(left).toHaveLength(0);
    const { data: profile } = await admin
      .from("profiles")
      .select("avatar_path")
      .eq("id", userId)
      .single();
    expect(profile?.avatar_path).toBeNull();
  } finally {
    const { data: files } = await admin.storage.from("avatars").list(userId);
    if (files?.length) {
      await admin.storage
        .from("avatars")
        .remove(files.map((f) => `${userId}/${f.name}`));
    }
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
});

test("only real JPG, PNG or WebP pictures up to 5 MB are taken", async ({
  page,
}) => {
  const userId = await throwawayUser(page, "weigeraar");
  try {
    const dialog = await openEditDialog(page);
    const picker = dialog.getByLabel("Foto kiezen");

    // A text file that claims to be a JPG.
    await picker.setInputFiles({
      name: "foto.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("geen foto"),
    });
    await expect(
      page.getByText("Deze foto kon niet gelezen worden. Kies een andere."),
    ).toBeVisible();

    // A GIF.
    await picker.setInputFiles({
      name: "bewegend.gif",
      mimeType: "image/gif",
      buffer: await sharp({
        create: { width: 10, height: 10, channels: 3, background: "#000" },
      })
        .gif()
        .toBuffer(),
    });
    await expect(
      page.getByText("Kies een foto in JPG, PNG of WebP."),
    ).toBeVisible();

    // Too large.
    await picker.setInputFiles({
      name: "groot.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });
    await expect(
      page.getByText("Je foto mag maximaal 5 MB groot zijn."),
    ).toBeVisible();

    const { data: files } = await admin.storage.from("avatars").list(userId);
    expect(files).toHaveLength(0);
  } finally {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
});
