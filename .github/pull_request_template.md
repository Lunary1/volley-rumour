<!-- Title: Conventional Commit style, e.g. "fix(search): handle empty description". It becomes the squash commit. -->

Closes #

## What changed

## Acceptance criteria evidence
<!-- One line per criterion from the issue: how you verified it (test, screenshot, preview URL). -->
- [ ]

## Definition of Done
- [ ] Acceptance criteria met, with evidence above
- [ ] CI green (typecheck, lint, build)
- [ ] Playwright test covers the key flow (once the harness exists)
- [ ] Schema changes committed as migrations in `supabase/migrations/` — or none
- [ ] UI copy is Dutch
- [ ] Privacy, moderation and minors impact considered — or none
- [ ] Change checked: Vercel preview by hand, or a local production build and smoke test

## Notes for review
<!-- Risks, follow-ups, anything to apply manually (env vars, migrations). Previews use the production database (D-010) — look, don't write. -->
