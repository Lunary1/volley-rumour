import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build of the app wired to the
// local Supabase stack (`npm run db:start`, seeded by `npm run db:reset`).
// Never point them at a Vercel preview or production (D-010).

// Defaults are the fixed keys every local Supabase CLI stack uses.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const { hostname } = new URL(SUPABASE_URL);
if (hostname !== "127.0.0.1" && hostname !== "localhost") {
  throw new Error(
    `E2E tests only run against a local Supabase stack, not ${SUPABASE_URL}.`,
  );
}

// A separate port, so a running `npm run dev` on :3000 is never reused.
// Every run rebuilds; set E2E_REUSE_SERVER=1 to reuse a server you started
// yourself with the same environment (a stale one gives confusing failures).
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    locale: "nl-BE",
    timezoneId: "Europe/Brussels",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // NEXT_PUBLIC_* values are inlined at build time, so build with the
    // local values below. These override anything in a developer's .env.local.
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL: `${BASE_URL}/auth/callback`,
      NEXT_PUBLIC_COMING_SOON: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
