import { createClient } from "@supabase/supabase-js";
import { expect, loginAs, test } from "./fixtures";
import { waitForEmails } from "./mailpit";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./local-supabase.mjs";

// Error monitoring (issue #186, D-041): a server error and a browser error
// each end up on /admin/fouten and email the alerts mailbox. Grouping, alert
// timing and the caps are tested in pgTAP (error_events.test.sql). The errors
// come from the test-only page app/e2e-fout.

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const ALERTS = "info@volleyrumours.be";

// The test errors are deleted before and after, so every run starts with new
// errors that are due an alert, and leaves the hourly alert cap alone.
async function deleteTestErrors() {
  await admin.from("error_events").delete().like("message", "E2E-testfout%");
}
// Serial, in one worker: another worker's cleanup would delete this one's rows.
test.describe.configure({ mode: "serial" });
test.beforeAll(deleteTestErrors);
test.afterAll(deleteTestErrors);

async function recordedError(message: string) {
  let row: { source: string; kind: string; route: string } | null = null;
  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("error_events")
          .select("source, kind, route")
          .eq("message", message)
          .maybeSingle();
        row = data;
        return row;
      },
      { message: `"${message}" not recorded`, timeout: 15_000 },
    )
    .toBeTruthy();
  return row!;
}

test("a server error is recorded, alerted and listed for staff", async ({
  page,
}) => {
  const since = new Date();
  await page.goto("/e2e-fout?soort=server");
  await expect(
    page.getByRole("heading", { name: "Er ging iets mis" }),
  ).toBeVisible();

  expect(await recordedError("E2E-testfout op de server")).toEqual({
    source: "server",
    kind: "render",
    route: "/e2e-fout",
  });

  const emails = await waitForEmails(ALERTS, since);
  const alert = emails.find((e) => e.Text.includes("/e2e-fout (pagina)"));
  expect(alert?.Subject).toBe("Fout op VolleyRumours");
  // Content-free: the message itself is only on the admin page.
  expect(alert?.Text).not.toContain("E2E-testfout");
  expect(alert?.Text).toContain("/admin/fouten");

  await loginAs(page, "moderator");
  await page.goto("/admin/fouten");
  const row = page.getByRole("row", { name: /E2E-testfout op de server/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("/e2e-fout");
  await expect(row).toContainText("Pagina");
});

test("a browser error is recorded from the error page", async ({ page }) => {
  await page.goto("/e2e-fout");
  await page.getByRole("button", { name: "Fout veroorzaken" }).click();
  await expect(
    page.getByRole("heading", { name: "Er ging iets mis" }),
  ).toBeVisible();

  expect(await recordedError("E2E-testfout in de browser")).toEqual({
    source: "client",
    kind: "client",
    route: "/e2e-fout",
  });
});
