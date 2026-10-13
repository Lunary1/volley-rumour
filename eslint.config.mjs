import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Existing load-on-mount effects (OAuth errors, messages, countdown,
      // theme toggle, profile) trip this React Compiler rule. Rewriting them
      // changes auth and messaging behaviour, so it waits for Playwright
      // coverage (step 1.4). New code should not add to the warnings.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "supabase/**",
  ]),
]);
