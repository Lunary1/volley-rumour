import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Load data on the server or derive it while rendering; set state in
      // an effect only from a callback (timer, subscription, promise).
      "react-hooks/set-state-in-effect": "error",
      // A leading underscore marks a name as intentionally unused, e.g. the
      // next/font loaders in app/layout.tsx, which register @font-face as a
      // side effect and must be assigned to a const.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
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
