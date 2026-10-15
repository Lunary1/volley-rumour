import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build of the app wired to the
// local Supabase stack (`npm run db:start`, seeded by `npm run db:reset`).
// Never point them at a Vercel preview or production (D-010).

import {
  E2E_BASE_URL,
  E2E_SERVER_COMMAND,
  E2E_SERVER_ENV,
} from "./e2e/local-supabase.mjs";

// Every run rebuilds. To build once and rerun specs, start the server with
// `npm run test:e2e:server` and set E2E_REUSE_SERVER=1 (e2e/serve.mjs).
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // CI stays on 2 workers. The 4-CPU runner also runs Supabase, the app and
  // the browsers: 3 workers took 264 s and 4 took 291 s with failures,
  // against a median of ~220 s on 2 (#132). Locally 4: Playwright's default
  // of half the cores (8 on 16) overloads the app and the Supabase stack, and
  // server actions time out in unrelated specs (#135).
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_BASE_URL,
    locale: "nl-BE",
    timezoneId: "Europe/Brussels",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: E2E_SERVER_COMMAND,
    url: E2E_BASE_URL,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
    env: E2E_SERVER_ENV,
  },
});
