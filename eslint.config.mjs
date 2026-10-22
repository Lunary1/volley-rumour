import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const PALETTE =
  "(?:bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|decoration|divide)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-[0-9]";
const ARBITRARY = "[a-z]-[[][#0-9]";

/** Class strings that bypass the design tokens. */
function styleRestrictions(arbitrary) {
  const patterns = [
    [
      PALETTE,
      "Use a colour token (text-primary-text, bg-muted …), not a Tailwind palette colour.",
    ],
    ...(arbitrary
      ? [
          [
            ARBITRARY,
            "Use a token or a components/ui variant, not an arbitrary value.",
          ],
        ]
      : []),
  ];
  return patterns.flatMap(([pattern, message]) => [
    { selector: `Literal[value=/${pattern}/]`, message },
    { selector: `TemplateElement[value.raw=/${pattern}/]`, message },
  ]);
}

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
  {
    // Styling goes through the tokens in app/globals.css and the variants in
    // components/ui (#207): no Tailwind palette colours (text-blue-600) and,
    // outside components/ui, no arbitrary values (text-[13px], bg-[#fff]).
    // A warning until the existing ones are gone (#208), then an error.
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
    ],
    ignores: ["components/ui/**"],
    rules: {
      "no-restricted-syntax": ["warn", ...styleRestrictions(true)],
    },
  },
  {
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["warn", ...styleRestrictions(false)],
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
