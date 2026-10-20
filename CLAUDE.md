# CLAUDE.md

Instructions for anyone — human or AI agent — changing this repository. This is
the **only** instruction file; Copilot and other tools are pointed here.

## What this is

**volleyrumours.be** — a Dutch-language community site for Belgian volleyball:
classifieds (*zoekertjes*) are the core value, moderated transfer rumours
(*geruchten*) are the acquisition engine. Product intent lives in `docs/product/`:

| File | Purpose |
| --- | --- |
| `docs/product/journeys.md` | 15 user journeys (J-01 … J-15) with acceptance criteria |
| `docs/product/decisions.md` | Decision log (D-xxx) and open decisions (O-xxx) |
| `docs/product/audit.md` | Gap audit of every journey against the code |
| `docs/product/moderation.md` | Moderator handbook: response times, rota, onboarding, templates |
| `docs/product/legal-review.md` | Self-review of terms, privacy and takedown copy against GDPR, DSA and Belgian law; questions for a lawyer |

When product intent is unclear, ask the owner — don't guess. Record the answer
in `docs/product/decisions.md`.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Supabase
(Postgres + RLS, Auth with email/password and Google OAuth, Realtime) ·
shadcn/ui (new-york) on Radix · Tailwind 4 · React Hook Form + Zod · Vercel
(Web Analytics, Speed Insights). Package manager: **npm only** (D-007) — never
pnpm or yarn.

A new service that receives personal data (analytics, email, error tracking)
is listed on the privacy page (`app/privacy/page.tsx`) in the same PR (#77).

## Commands

| Purpose | Command |
| --- | --- |
| Install | `npm ci` |
| Dev server | `npm run dev` (needs a `.env.local`, see below) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` (ESLint 9, `eslint-config-next`; warnings allowed, errors fail CI) |
| Format | `npm run format` (Prettier, writes) / `npm run format:check` (CI) |
| Build | `npm run build` |
| E2E tests | `npm run test:e2e` — builds the app against the local stack and runs Playwright on :3100 (needs `npm run db:start`; once: `npx playwright install chromium`) |
| E2E, build once | `npm run test:e2e:server` builds the app the same way and serves it on :3100 until you stop it. In another terminal, rerun specs without rebuilding: `E2E_REUSE_SERVER=1 npx playwright test e2e/<name>.spec.ts`. Restart it after changing app code |
| Local database | `npm run db:start` / `npm run db:stop` (needs Docker). Starts the services the tests use, like CI; `npm run db:start:studio` adds Studio. **Stop it when you're not testing** — it uses a lot of RAM |
| Rebuild local DB from migrations + seed | `npm run db:reset` |
| Database tests (pgTAP) | `npm run db:test` |
| New migration | `npm run db:new -- <snake_case_name>` |

## Database and migrations

`supabase/migrations/` is the source of truth for the schema. It starts from
`20261013120000_baseline.sql`, a snapshot of production; everything after it is
a normal migration.

- **Never change the schema in the Supabase dashboard or via MCP.** Every change
  is a migration file, reviewed in a PR like any other code.
- Create files with `npm run db:new -- add_rumour_sources` (timestamped name).
  Never edit a migration that has been applied; add a new one.
- Test locally: `npm run db:reset` must apply every migration cleanly.
- RLS is the security boundary. New tables enable RLS and ship their policies
  and grants in the same migration. Prefer column-level grants for anything a
  user must not change (roles, scores, statuses, flags).
- A new table or sequence gets **no** grants by default (#196, like production
  since Supabase's change of 2026-10-30). Grant explicitly to each role that
  needs it, `service_role` included when the admin client touches the table;
  without a grant the API answers `42501 permission denied`.
- `profiles` has column-level SELECT: `role` is hidden from the API (#111), so
  never `select("*")` on it. A new column is unreadable until a migration adds
  it to the grant.
- SECURITY DEFINER functions: set `search_path = ''`, qualify every name, and
  revoke `EXECUTE` from `anon`/`authenticated` unless they must call it.
- **Every migration keeps the code on `main` working** (D-043), because a Vercel
  rollback brings back older code but never undoes a migration. Adding is
  safe: tables, nullable or defaulted columns, functions. To remove or rename
  something the app uses, or to tighten a rule it relies on, split it: first a
  PR that stops using it, then a later PR with the migration (expand first,
  contract later). The PR notes give the SQL that would undo the migration.
- **Production is migrated by the owner, before merge** (D-043): once CI is
  green, the owner runs `npx supabase db push` from the up-to-date PR branch,
  then the PR merges. Agents never push migrations or run SQL against the
  linked project. A pushed migration's file must reach `main`: if the PR is
  dropped, merge the file anyway, or a migration that undoes it.
- `supabase/seed.sql` holds fake data for local development and tests only.
  Every seeded account logs in with `test-wachtwoord`; the accounts are listed
  at the top of the file and in `e2e/fixtures.ts`. Keep the two in sync.

## Branching and release

`main` **is production**: every merge deploys to volleyrumours.be via Vercel.
Coming-soon mode (D-009) closes every route except the homepage and info pages,
but those pages, the Supabase API and the waitlist are live. Treat every merge
as a release.

```
feature/42-password-reset ──PR──┐
fix/57-search-crash       ──PR──┼──► main ──► Production (volleyrumours.be)
chore/61-eslint           ──PR──┘   protected · CI required · squash only
        │
        └─ every PR gets a Vercel preview deployment
```

1. **Pick an issue** from the GitHub Project board. No issue, no branch.
2. **Branch from an up-to-date `main`**: `<type>/<issue>-<slug>`, where type is
   `feature`, `fix`, `chore` or `docs` (e.g. `fix/57-search-crash`). Keep
   branches short-lived — days, not weeks. Rebase on `main` if it moves.
3. **Commit** in Conventional Commit style: `feat(rumours): …`, `fix(auth): …`,
   `chore(deps): …`, `docs(product): …`.
4. **Open a PR** using the template. Title in Conventional Commit style (it
   becomes the squash commit). Link the issue with `Closes #42`.
5. **Gate**: CI green, Definition of Done ticked, the change checked. Vercel
   previews sit behind Vercel's login, so an agent checks with a local
   production build and smoke test instead, and says so in the PR.
6. **Squash merge**, then delete the branch. The author merges their own PR
   once the gate passes, agents included (owner's call, 2026-10-13).

Rules:
- Never push directly to `main`, never force-push `main`. Branch protection
  enforces this, including for admins.
- Hotfixes follow the same flow on a `fix/` branch — the gate is the safety net.
- **Rollback**: promote the previous deployment in Vercel (Instant Rollback),
  then fix forward or revert the PR through a new PR. Steps, closing the site
  again and database fixes: `docs/rollback.md`.
- **Preview deployments use the production Supabase database** (D-010). Use
  previews to look, not to write: no test data, no destructive flows, no
  migrations. Test anything that writes data against the local stack
  (`npm run db:start`).

## Definition of Done

- [ ] Acceptance criteria of the issue are met, with evidence per criterion.
- [ ] Typecheck, lint, format check and build pass (CI green).
- [ ] A Playwright test in `e2e/` covers the key flow of the change.
- [ ] Schema changes are committed as Supabase migrations in `supabase/migrations/`,
      and the code on `main` still works against them (D-043).
- [ ] UI copy is Dutch.
- [ ] Privacy, moderation and minors impact considered.
- [ ] Change checked: Vercel preview by hand, or (agents) a local production
      build and smoke test.

## Code conventions

### Server vs client
- Pages are async Server Components that fetch data directly.
- Mutations go through **Server Actions** in `app/actions/<domain>.ts`
  (`"use server"`). Don't insert or update from the browser.
- Add `"use client"` only for forms, interactivity and Realtime subscriptions.
- A client form with `onSubmit` and named fields renders its submit button
  `disabled={!useIsClient()}` (`@/lib/use-is-client`). Otherwise a click before
  hydration submits it natively as a GET, with the fields in the URL (#127).
  Forms with `action={fn}` are safe: React blocks and replays that submit.
- Call `revalidatePath()` for affected routes after a mutation.

### Server Action shape
Return `ActionResponse<T>` from `@/lib/response`:

```ts
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return errorResponse("Je moet ingelogd zijn");
// validate input with zod, do the work, revalidatePath(...)
return successResponse(data);
```

Use `errorResponseFromError()` / `extractErrorMessage()` to map Supabase errors
to Dutch messages. On the client, `handleServerActionResponse()` from
`@/lib/client-utils` shows the toast.

### Supabase clients
- Server: `createClient()` from `@/lib/supabase/server` — create it **inside**
  each function, never at module scope (Fluid compute).
- Browser: `createClient()` from `@/lib/supabase/client`.
- Admin: `createAdminClient()` bypasses RLS with `SUPABASE_SERVICE_ROLE_KEY`.
  Server-only, use sparingly, and check authorisation yourself first.
- Security lives in RLS. Any new table or policy change ships as a migration.

### Staff and moderation
- Staff = `profiles.role` `moderator` or `admin` (D-006); the database decides
  with `public.is_staff()`. Admin pages live under `app/admin/`, whose layout
  returns 404 for non-staff. Admin server actions start with
  `const staff = await requireStaff(); if (!staff.ok) return staff.response;`
  (`@/lib/staff`).
- Every staff action writes an audit log entry with
  `public.log_staff_action()`, **in the same database function as the action
  itself**, so an action never happens without its entry. That function isn't
  callable through the API; moderation actions are SECURITY DEFINER functions
  that call it. The log is append-only and kept 2 years (D-011).
- Suspensions, the verified badge and the moderator role are admin-only
  (D-016): their functions check `public.is_admin()`. Admins themselves are
  set by the owner in SQL.
- Suspended users are read-only. The `check_account_not_suspended` trigger
  refuses their writes with SQLSTATE `VR005`, which `extractErrorMessage()`
  turns into Dutch. **A new table users write to gets that trigger** in its
  migration, unless suspended users may keep doing it (reports, blocks).

### Conversations
Conversations are bidirectional (`initiator_id`, `recipient_id`, linked by
`ad_id` + `ad_type`). Always query both directions with `or(and(…),and(…))`.
Blocks (D-018) are enforced by the `check_not_blocked` trigger, which refuses
messages and new conversations across a block with SQLSTATE `VR008`. RLS only
shows a block to its blocker; use `public.is_blocked_with()` for the other
direction.

### Language and UI
- All user-facing text is **Dutch**: labels, errors, toasts, validation
  messages, emails. Dates via `date-fns` with `import { nl } from "date-fns/locale"`.
- Use `@/` imports, `cn()` from `@/lib/utils`, shadcn components in `components/ui/`.
- Support light (default) and dark themes.

### Formatting
- Prettier with its default style; run `npm run format` before you commit.
  Markdown is not formatted (`.prettierignore`), because Prettier pads every
  table and one new row would rewrite it.
- Git stores LF. `.prettierrc` sets `"endOfLine": "auto"`, so working copies
  with `core.autocrlf=true` (Windows) keep CRLF on disk.
- A commit that only reformats goes in `.git-blame-ignore-revs`. Locally:
  `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

## Environment variables

Put local values in `.env.local` (git-ignored). Never commit secrets.

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only — never in client code |
| `NEXT_PUBLIC_COMING_SOON` | `"true"` shows the coming-soon homepage and redirects every other route except the info pages to `/` (`lib/coming-soon.ts`) |
| `NEXT_PUBLIC_LAUNCH_DATE` | Countdown target |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for share links |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | OAuth redirect for local dev |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Notification emails (`lib/email.ts`): Resend's SMTP in production (`smtp.resend.com`, 465, user `resend`, an API key). Locally `127.0.0.1:54325` (the stack's Mailpit, see Mailpit at :54324). Without `SMTP_HOST` no email is sent |
| `ERROR_ALERT_EMAIL` | Optional. Where error alerts go (`lib/error-monitoring.ts`, D-041); defaults to `info@volleyrumours.be`. Only production builds record errors |

## Ground rules for agents

- Never run anything against the remote Supabase database without the owner's OK.
- Never run load or stress tests against production.
- Merge your own PR (squash) once the gate passes. Don't merge someone else's
  PR, close issues by hand or change repository settings — the owner does.
- Production database pushes (`npx supabase db push`) stay with the owner.
- Don't skip failing checks or hooks; fix the cause.
- Keep PRs to one issue. Unrelated cleanups get their own issue.
