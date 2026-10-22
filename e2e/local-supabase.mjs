// The local Supabase stack the e2e tests run against (`npm run db:start`),
// and the app server they test. Plain JavaScript, so `npm run
// test:e2e:server` (e2e/serve.mjs) can share it with playwright.config.ts.

// Defaults are the fixed keys every local Supabase CLI stack uses.
export const SUPABASE_URL =
  process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SUPABASE_ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const { hostname } = new URL(SUPABASE_URL);
if (hostname !== "127.0.0.1" && hostname !== "localhost") {
  throw new Error(
    `E2E tests only run against a local Supabase stack, not ${SUPABASE_URL}.`,
  );
}

// A separate port, so a running `npm run dev` on :3000 is never reused.
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

// Builds the app and starts it on E2E_PORT.
export const E2E_SERVER_COMMAND = `npm run build && npm run start -- --port ${E2E_PORT}`;

// NEXT_PUBLIC_* values are inlined at build time, so the app is built with
// these. They override anything in a developer's .env.local.
export const E2E_SERVER_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: E2E_BASE_URL,
  NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL: `${E2E_BASE_URL}/auth/callback`,
  NEXT_PUBLIC_COMING_SOON: "false",
  NEXT_TELEMETRY_DISABLED: "1",
  // Notification emails (#98) go to the stack's Mailpit, like auth emails.
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "54325",
  EMAIL_FROM: "VolleyRumours <noreply@volleyrumours.be>",
  // Opens the test-only error page (app/e2e-fout, #186).
  E2E_ERROR_PROBE: "1",
  // Opens the test-only coming-soon page (app/e2e-binnenkort, #229).
  E2E_COMING_SOON_PROBE: "1",
  // Render in UTC like Vercel and CI, also on a developer's machine in
  // Belgium; the browser runs in Europe/Brussels (#142).
  TZ: "UTC",
};
