---
name: vibecoder-review
description: Security triage of the whole volley-rumour codebase (Next.js server actions + Supabase RLS), OWASP-style - exposed secrets, auth bypasses, missing RLS/grants, IDOR, injection, uploads, test backdoors. Use when asked for a security review, audit or health check of the codebase (not of one diff; for the pending diff use the built-in /security-review).
---

# Vibecoder Security Review (volley-rumour)

Adapted from logicx24's `vibecoder-review` gist
(https://gist.github.com/logicx24/2a491f29bf662d3e04fe1713b1757729) to this
repo's stack. Same eight checks and report; the examples and searches target
Next.js 16 server actions and Supabase.

**Philosophy:** assume much of the code was written quickly, with AI help.
Look for places where convenience beat security. This is triage that finds
easy exploits, not a formal audit.

## Ground rules (from CLAUDE.md, not optional)

- **Read code; never probe production.** No requests, logins or SQL against
  volleyrumours.be, Vercel previews (they use the production database, D-010)
  or the linked Supabase project. No load tests.
- To prove a finding, use the local stack: `npm run db:start`, then
  `npm run db:reset`. Seeded accounts log in with `test-wachtwoord`
  (`e2e/fixtures.ts`). Check RLS with a pgTAP test (`supabase/tests/database/`,
  `npm run db:test`) or a local production build on :3100.
  Afterwards: `npm run db:stop` and free :3100.
- Don't fix during the review. Report first. Each fix is its own issue and
  PR, and a schema fix is a migration that keeps `main` working (D-043).
- A finding that exposes personal data or minors is critical, whatever its
  technical severity.

## Where the security boundary is

The security boundary is **Postgres RLS and grants**, not the UI or the
TypeScript. The browser holds the anon key and a user JWT and can call
PostgREST (`/rest/v1/<table>`, `/rest/v1/rpc/<fn>`) directly, bypassing every
check in `app/`. So for each table and function, ask: what can an
`authenticated` user do with a hand-written REST call?

Entry points to map:
- **Server actions:** `app/actions/*.ts` (`"use server"`). Every exported
  function is a public POST endpoint, and its arguments come from the
  attacker, however the form looks.
- **Route handlers:** `find app -name route.ts` (today only
  `app/auth/callback/route.ts`).
- **Proxy/session:** `proxy.ts`, `lib/supabase/proxy.ts`, `lib/coming-soon.ts`.
- **Database surface:** `supabase/migrations/*.sql`: tables, policies,
  grants, `SECURITY DEFINER` functions, triggers, the storage bucket.
- **Pages that bypass RLS:** anything calling `createAdminClient()`.

## Core checks

### 1. Secrets and keys

```bash
git ls-files | grep -iE '\.env|secret|credential'      # committed env files
git grep -nE 'sk_live|sk-proj|re_[A-Za-z0-9]{10,}|service_role|SUPABASE_SERVICE_ROLE_KEY|SMTP_PASSWORD|BEGIN (RSA|PRIVATE)'
git grep -n 'eyJhbGci'                                  # inline JWTs
git log -p --all -S 'SERVICE_ROLE' --oneline | head      # secrets in history
```

Flag:
- `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASSWORD` or any non-`NEXT_PUBLIC_`
  secret read in a file that is, or is imported by, a `"use client"` module.
  Anything named `NEXT_PUBLIC_*` is shipped to the browser; it must never
  hold a secret.
- `createAdminClient` imported (directly or indirectly) by client code.
- Real keys in `.env.example`, docs, tests or git history.

After `npm run build`, grep `.next/static` for `service_role`, `SMTP` and
`re_` to prove nothing leaked into the bundle.

### 2. Auth and accounts

Read: `app/actions/auth.ts`, `lib/supabase/session.ts`, `lib/staff.ts`,
`app/admin/layout.tsx`, `app/auth/callback/route.ts`, `lib/supabase/recovery.ts`.

Flag:
- A server action that takes a `userId`, `authorId`, `role` or `isStaff`
  argument and trusts it. The user comes from `supabase.auth.getUser()`.
- Authorization done with `getSessionUser()` in a **server action** (it
  only reads the JWT; CLAUDE.md requires `getUser()` there).
- An admin action that doesn't start with `requireStaff()`, or an admin-only
  action (suspensions, verified badge, roles: D-016) whose database function
  doesn't check `public.is_admin()`.
- Staff checks in the UI only (a hidden button) with no matching check in
  the action or function.
- Open redirects: `next`/`redirect` parameters in the auth callback or login
  passed to `redirect()` without checking they are relative paths.
- Password reset or recovery flows that sign a user in without a valid token.
- Writable `profiles` columns a user must not change (`role`, scores,
  `verified`, suspension fields): check the column-level grants.

### 3. User data and privacy (IDOR via RLS)

For each table in the migrations:

```bash
grep -nE 'CREATE TABLE|ENABLE ROW LEVEL SECURITY|CREATE POLICY|GRANT .* TO (anon|authenticated)' supabase/migrations/*.sql
```

Flag:
- A table without `ENABLE ROW LEVEL SECURITY`, or with a `USING (true)`
  policy on data that isn't public.
- `anon` grants on tables holding personal data (messages, conversations,
  reports, takedowns, waitlist, staff_actions, error_events, blocks).
- Policies on `conversations`/`messages` that don't check both
  `initiator_id` and `recipient_id`.
- Pending or rejected rumours readable by anyone but their author and staff.
- `select("*")` on `profiles` (CLAUDE.md: `role` is hidden, #111), or a
  query that returns e-mail addresses, IPs or hashes to the browser.
- `createAdminClient()` used to read on behalf of a user without its own
  ownership check first.
- Unguessable tokens (takedown status `/verwijderverzoek/status/[token]`):
  enough entropy, compared server-side, not enumerable.

**Mental attack:** sign in as seed user A and use their JWT on
`/rest/v1/<table>?select=*` and `/rest/v1/rpc/<fn>` to read or change B's rows.
Prove it with pgTAP (`set local role authenticated` +
`request.jwt.claims`), on the local stack only.

### 4. Test vs production

```bash
git grep -nE 'NODE_ENV|VERCEL_ENV|E2E|test-wachtwoord|bypass|debug' -- app lib proxy.ts
```

Flag:
- Code paths that skip auth, coming-soon or captcha/honeypot when an env
  flag or header is set, and could be set in production.
- `supabase/seed.sql` accounts or passwords referenced outside `seed.sql`,
  `e2e/` and `supabase/tests/`.
- Error responses that return raw Postgres messages, stack traces or SQL to
  the browser instead of going through `extractErrorMessage()`.
- Logging of passwords, tokens, message bodies or e-mails
  (`lib/error-monitoring.ts`, `console.*`).

### 5. File uploads (avatars)

Read: `supabase/migrations/20261018181718_avatar_uploads.sql`,
`app/actions/profile.ts`, `lib/avatar.ts`.

Flag:
- Bucket without `file_size_limit` or `allowed_mime_types`, or SVG/HTML
  allowed (stored XSS on the storage domain).
- Storage policies that let a user write or delete outside their own folder
  (`(storage.foldername(name))[1] = auth.uid()::text` or equivalent).
- File names taken from the upload instead of generated server-side.
- MIME type checked only by extension or only in the browser.

### 6. Dependencies

```bash
npm audit --omit=dev
npm outdated
```

Flag security advisories that are reachable in this app, a Next/React
version behind on a security patch, and any package that looks typosquatted
or abandoned. npm only (D-007): no pnpm/yarn lockfiles.

### 7. Basic hygiene

Flag:
- No rate limit or abuse control on unauthenticated writes: waitlist,
  contact, takedown, reports, sign-up and login (check `lib/ip-hash.ts` and
  the honeypot usage).
- Missing security headers (`next.config.*` `headers()`: CSP,
  `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`). Vercel adds HSTS;
  it does not add the others.
- Server actions that change data on a GET route or in a page render.
- Cookies set by hand without `httpOnly`, `secure`, `sameSite`.

### 8. Injection and code execution

```bash
git grep -nE 'dangerouslySetInnerHTML|innerHTML|eval\(|new Function|child_process|exec\(' -- app lib components emails
git grep -nE '\.or\(`|\.filter\(`|\.textSearch\(`|ilike.*\$\{' -- app lib    # user input in PostgREST filters
grep -nE 'EXECUTE |format\(' supabase/migrations/*.sql                         # dynamic SQL
```

Flag:
- User input interpolated into a PostgREST `or()`/`filter()` string
  (a filter-injection that widens the query; commas and parentheses in a
  search term must be escaped or rejected).
- `dangerouslySetInnerHTML` with anything user-written (rumour text, ad
  descriptions, messages, profile bios). JSON-LD with `JSON.stringify` is
  fine only if `<` is escaped.
- User input in e-mail HTML (`emails/`, `lib/email.ts`,
  `lib/notifications.ts`) without escaping, or in e-mail headers.
- Dynamic SQL (`EXECUTE`, `format()` without `%I`/`%L`) in a function.
- `href`s built from user input (official source URLs on rumours, profile
  links) without restricting the scheme to `http(s)` (`javascript:` XSS).

### SECURITY DEFINER functions (this repo's biggest surface)

There are about 70 `SECURITY DEFINER` occurrences across the migrations. For each one:

```bash
grep -nE -A3 'SECURITY DEFINER' supabase/migrations/*.sql | grep -nE 'FUNCTION|search_path'
grep -nE 'REVOKE .* EXECUTE|GRANT EXECUTE' supabase/migrations/*.sql
```

Flag:
- No `SET search_path = ''`, or unqualified table/function names.
- `EXECUTE` still granted to `anon`/`authenticated` (the default for
  `PUBLIC`) on a function they shouldn't call, especially
  `log_staff_action()` and anything that writes on behalf of staff.
- A staff or admin function that doesn't check `is_staff()`/`is_admin()`
  itself, or that skips its `log_staff_action()` entry (CLAUDE.md: the
  same function writes both).
- A function that takes a user ID argument instead of using `auth.uid()`.
- A new user-writable table without the `check_account_not_suspended`
  trigger.

## Workflow

1. **Recon (15 min):** read `CLAUDE.md`, `docs/supabase.md`, list
   `app/actions/`, migrations and route handlers. Note which tables hold
   personal data.
2. **Secrets (10 min):** check 1, including the built bundle if a build exists.
3. **Auth (20 min):** check 2, every export in `app/actions/`.
4. **Data access (25 min):** check 3 and the SECURITY DEFINER pass.
5. **Injection (15 min):** check 8.
6. **Uploads and dependencies (10 min):** checks 5 and 6.
7. **Hygiene (5 min):** checks 4 and 7.
8. **Verify:** for each critical/high finding, reproduce on the local stack
   or write the failing pgTAP test. Mark the rest "unverified".
9. **Report.**

## Report format

Write the report in English to the scratchpad, or publish it as a private
artifact if the owner wants to share it. Never in a public issue or PR while
the hole is open.

```markdown
# Vibecoder Security Review: volley-rumour @ <short sha>

**Date:** YYYY-MM-DD

## Summary
X critical, Y high, Z medium. Stack: Next.js 16 server actions, Supabase RLS.

## Findings

### [CRITICAL] <title>
**Location:** `supabase/migrations/<file>.sql:<line>` / `app/actions/<file>.ts:<line>`
**Issue:** what is wrong, with the code.
**Impact:** who can do what to whom (name the data: messages, e-mails, minors).
**Attack:** the request an attacker sends (REST call, action arguments).
**Verified:** yes (pgTAP test / local repro) | no
**Fix:** concrete, in this repo's patterns (policy, grant, `requireStaff()`, ...).

## Quick wins
1. ...

## Checked and fine
Short list of areas that passed, so the next review can skip them.
```

Severity: **critical** = another user's personal data, account takeover or
staff powers without being staff; **high** = writing what you shouldn't,
stored XSS, a leaked server secret; **medium** = abuse without rate limits,
missing headers, information leaks; **low** = hardening.

## False positives in this repo

Don't flag:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` in browser code. It is public by design;
  RLS is the boundary. (Flag it only if RLS is missing.)
- `test-wachtwoord` and the accounts in `supabase/seed.sql`, `e2e/` and
  `supabase/tests/`. They exist only in the local stack.
- `createAdminClient()` in server-only code that checked authorisation first
  (`app/actions/auth.ts` account deletion, `lib/notifications.ts`,
  `lib/error-monitoring.ts`). Verify the check, then move on.
- Public reads of published zoekertjes, approved rumours and public profile
  fields. They are meant to be public.
- Coming-soon redirects: that's a launch gate, not a security control.
- Advisories in dev-only dependencies (Playwright, ESLint).

Do verify:
- That a policy that looks right is actually granted (no grant means 42501,
  which is safe; a broad grant with a weak policy is not).
- That the production schema matches the migrations. Ask the owner to run
  `npx supabase db push --dry-run`; don't run it yourself.

## Success criteria

A useful review gives specific findings with file:line, an attack and a
fix in this repo's patterns, and verification for the serious ones. If it
finds nothing, say what was checked; don't pad the report.
