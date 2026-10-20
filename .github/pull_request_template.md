<!-- Title: Conventional Commit style, e.g. "fix(search): handle empty description". It becomes the squash commit. -->

Closes #

## What changed

## Acceptance criteria evidence
<!-- One line per criterion from the issue: how you verified it (test, screenshot, preview URL). -->
- [ ]

## Definition of Done
- [ ] Acceptance criteria met, with evidence above
- [ ] CI green (typecheck, lint, format, build, e2e)
- [ ] Playwright test in `e2e/` covers the key flow
- [ ] Schema changes committed as migrations in `supabase/migrations/` — or none
- [ ] The code on `main` still works against the migration, and the undo SQL is in the notes (D-043) — or no migration
- [ ] UI copy is Dutch
- [ ] Privacy, moderation and minors impact considered — or none
- [ ] Change checked: Vercel preview by hand, or a local production build and smoke test

## Notes for review
<!-- Risks, follow-ups, anything to apply manually (env vars, migrations). A migration is pushed by the owner before merge (D-043). Previews use the production database (D-010) — look, don't write. -->
