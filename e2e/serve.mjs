// `npm run test:e2e:server`: builds the app for the e2e tests and serves it
// on :3100 until you stop it (Ctrl+C). Run specs against it as often as you
// like without rebuilding:
//
//   E2E_REUSE_SERVER=1 npx playwright test e2e/votes.spec.ts
//
// Restart it after changing app code; a stale build gives confusing failures.

import { spawn } from "node:child_process";
import {
  E2E_BASE_URL,
  E2E_SERVER_COMMAND,
  E2E_SERVER_ENV,
} from "./local-supabase.mjs";

console.log(
  `Building the app for the e2e tests; it will serve ${E2E_BASE_URL}`,
);

const server = spawn(E2E_SERVER_COMMAND, {
  env: { ...process.env, ...E2E_SERVER_ENV },
  shell: true,
  stdio: "inherit",
});
server.on("exit", (code) => process.exit(code ?? 0));
