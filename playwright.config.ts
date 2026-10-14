import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build of the app wired to the
// local Supabase stack (`npm run db:start`, seeded by `npm run db:reset`).
// Never point them at a Vercel preview or production (D-010).

import {
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./e2e/local-supabase";

// A separate port, so a running `npm run dev` on :3000 is never reused.
// Every run rebuilds; set E2E_REUSE_SERVER=1 to reuse a server you started
// yourself with the same environment (a stale one gives confusing failures).
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
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
