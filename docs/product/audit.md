# Gap audit — volleyrumours.be

- **Date:** 2026-10-13
- **Code audited:** `main` @ `13dc455` (includes the Datadog RUM work, PRs #29 and #30, so it is live in production)
- **Measured against:** [journeys.md](journeys.md) and [decisions.md](decisions.md)
- **Method:** read-only trace of each acceptance criterion through the code. No
  database access: anything that depends on RLS, column defaults or remote
  config is marked **VERIFY** and is carried into the schema step.

**Status legend**

| Status | Meaning                                                                   |
| ------ | ------------------------------------------------------------------------- |
| WORKS   | Meets the criterion as far as code can show                              |
| PARTIAL | Exists but is incomplete or only meets part of the criterion             |
| MISSING | Not implemented                                                          |
| BROKEN  | Implemented but fails, or contradicts the criterion or a decision        |
| VERIFY  | Outcome depends on Supabase state that is not in the repo                |

---

## 1. Build and tooling results

Run with **npm**, not pnpm: `package-lock.json` is the maintained lockfile
(updated 2026-03-13 together with `package.json`), `pnpm-lock.yaml` is a stale
v0 artefact from 2026-01-23 without the Datadog dependencies, and the existing
`node_modules` was npm-installed. No `.env` files are present, so everything
ran without Supabase credentials, which is what CI will face.

These are the results on 2026-10-13. All of them have since been fixed: see X-10.

| Step                     | Result       | Notes                                                                                                                                              |
| ------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                 | ✅ Pass      | 201 packages. `npm audit`: 9 vulnerabilities (1 critical, 7 high, 1 moderate)                                                                         |
| `npx tsc --noEmit`       | ✅ Pass      | 0 errors. `ignoreBuildErrors: true` in [next.config.mjs](../../next.config.mjs) is therefore not hiding anything today and can be removed          |
| `npm run build`          | ✅ Pass      | Builds without env vars. **All 19 routes are dynamic (ƒ)**, including `/privacy`, `/voorwaarden` and `/leaderboard`, see finding X-9             |
| `npm run lint`           | ❌ Fail      | `'eslint' is not recognized`: the script runs `eslint .`, but ESLint isn't a dependency and there's no ESLint config                            |
| Tests                    | ❌ None      | No test runner, no test files                                                                                                                      |
| CI                       | ❌ None      | No `.github/workflows/`                                                                                                                            |

**`npm audit` highlights:**
- **`next@16.0.10`: critical.** 8 advisories, including proxy/middleware bypass, RSC cache poisoning and SSRF in rewrites. The fix is a Next 16 patch upgrade. The proxy here only refreshes sessions and gates nothing, which limits the bypass impact, but it should still be patched.
- Transitive (fixed with `npm audit fix`): `postcss`, `lodash`, `nanoid`, `browserslist`, `baseline-browser-mapping`.

---

## 2. Summary

| Journey | Title                                    | Overall     | Top gap                                                                     |
| ------- | ---------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| J-01    | Find a matching zoekertje                | **WORKS**   | Dutch 404 (#90); filters and pages in the URL (#85), logged-out contact fixed (#86), search crash fixed (#59) |
| J-02    | Read Transfer Talk / transfers           | **WORKS**   | Paginated on the server, tab counts and transfers cached (#96). Track record on cards (#88), transfer tabs fixed (#70, #82) |
| J-03    | Create an account                        | **WORKS**   | 16+ and terms gate for every account (#75, D-031); Dutch field errors and the confirmation link returns to the origin page (#89); "Confirm email" on in production (A4) |
| J-04    | Post "speler zoekt team"                 | **WORKS**   | Server action, gender stored, login first, public notice (#71); expiry date set and shown (#84) |
| J-05    | Manage own zoekertjes                    | **WORKS**   | "Mijn zoekertjes": edit, gevonden, delete (#72); expired status and renewal (#84) |
| J-06    | Coach contacts a club                    | **WORKS**   | Email to a recipient who is away, without the content (#98, D-025); Realtime scoped and tested (#74) |
| J-07    | Block / report                           | **WORKS**   | Block, unblock and report work (#73, #87); archiving is per user (#91) |
| J-08    | Club recruits player/trainer             | **WORKS**   | Gender and diploma stored and shown (#71); ads closed as gevonden (#72)   |
| J-09    | Submit a sourced rumour                  | **WORKS**   | Pending, source, declarations and cap done (#65, #67); emailed on approval or rejection (#98); edit while pending (#192) |
| J-10    | Own rumours, track record, voting        | **WORKS**   | Track record and all own rumours on the profile (#88, D-005); voting fixed (#78); withdraw own rumour (#192, D-042) |
| J-11    | Account and personal data                | **WORKS**   | Deletion is one transaction and deletes zoekertjes (#76, D-021, D-029); password reset fixed in #58; profile pictures uploaded to Storage (#92) |
| J-12    | Takedown request by named person         | **WORKS**   | #68: form without login, staff inbox, status link (D-014); removal also deletes the rumour's transfer (#151, D-033). Outcome on the status page and one decision email with a second link (#181, D-039) |
| J-13    | Pre-moderation queue                     | **WORKS**   | Queue with the author's track record, approve/reject and audit log work (#66, #88); the author is emailed (#98) |
| J-14    | Resolve a rumour                         | **WORKS**   | Confirm, deny, expire, bulk expire and transfer edits work (#70); each decision updates the author's track record (#88) |
| J-15    | Reports, takedowns, sanctions            | **WORKS**   | Inbox, suspensions, badge and roles work (#69, #80, D-015, D-016); outcomes shown on screen, not emailed (D-037) |

**Count:** 15 WORKS · 0 PARTIAL · 0 BROKEN · 0 MISSING.

---

## 3. Cross-cutting findings (ranked)

These are the issues that cut across journeys. Each becomes one or more backlog
items.

| #   | Severity     | Finding                                                                                                                                                                                                                                                                                                                                                                 | Evidence |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| X-1 | **Fixed** (#65) | **Rumours about named people go live with no moderation.** `createRumour` inserts without a status, so the database default is used (probably `rumour`, i.e. live). Contradicts D-002 and the Terms ("geverifieerde moderators").                                                                                                                                       | [rumour.ts:47-58](../../app/actions/rumour.ts#L47-L58), [voorwaarden:90](../../app/voorwaarden/page.tsx#L90) |
| X-2 | **Fixed** (#57) | **Transfer Talk and the homepage crash after any account deletion.** `deleteAccount` sets `rumours.creator_id = null`; `RumourCard` and `RumourDetailModal` read `rumour.creator.username` without a null check → TypeError on `/geruchten` and `/` (the homepage on the server). Fixed: both show "Verwijderd account" and hide the trust score; covered by a Playwright test with a seeded creatorless rumour.                                                                                                    | [auth.ts:168-172](../../app/actions/auth.ts#L168-L172), [rumour-card.tsx:353](../../components/rumour-card.tsx#L353), [rumour-detail-modal.tsx:225](../../components/rumour-detail-modal.tsx#L225) |
| X-3 | **Fixed** (#65) | **`confirmRumour` has no authorisation check.** Any logged-in user who reaches it creates a transfer using the **service-role key** and awards +5 trust. It is unreachable today only because nothing references it. `getFirstRumourToConfirm` confirms whatever rumour is newest.                                                                                       | [rumour.ts:73-155](../../app/actions/rumour.ts#L73-L155), [rumour.ts:157-174](../../app/actions/rumour.ts#L157-L174) |
| X-4 | **Fixed** (#129, #78) | **Vote integrity.** (a) Counts are read-modify-written in the app, so concurrent votes are lost. (b) A voter's session writes `rumours.votes_*` and **another user's** `profiles.trust_score`, which only works if RLS lets any user update any rumour or profile (VERIFY). (c) Homepage cards get no `onVote`, so votes look saved but aren't (fixed in #129). Fixed in #78: the `on_vote_change` trigger counts in the database, locking the rumour row so concurrent votes all count, and recounts on delete; votes are readable only by their voter.                        | [vote_integrity migration](../../supabase/migrations/20261016224117_vote_integrity.sql), [vote.ts](../../app/actions/vote.ts) |
| X-5 | **Fixed** (#74) | **Message privacy rests entirely on unverified RLS.** Fixed: the chat subscribes per conversation and the badge to `recipient_id=eq.<me>` (set by a database trigger), both filtered on the server; no payload is logged; a Playwright test shows a third user gets no events, even with no filter or a spoofed one. Both Realtime subscriptions listen to *all* `messages` changes with no filter and filter in the browser. The header logs every payload to the console.                                                                                                                                                          | [chat-interface.tsx:102-109](../../components/chat-interface.tsx#L102-L109), [user-menu.tsx:66-76](../../components/user-menu.tsx#L66-L76) |
| X-6 | **Fixed** (#65, #66, #68, #69, #72, #79, #80, #87) | **Promised safety features don't exist.** ~~No moderation, report, takedown, edit or delete paths for rumours or zoekertjes, although the Terms promise removal, warnings and suspensions.~~ Rumours are pre-moderated in a queue (#65, #66, D-002, D-012); anyone can request a takedown without an account (#68, D-014); "Melden" on rumours, zoekertjes and conversations goes to one staff inbox (#69, #79, #87, D-015); admins suspend accounts, read-only enforced by the database (#80, D-016); posters edit, close and delete their own zoekertjes (#72). Authors withdraw their own pending or lopend rumour and edit it while pending (#192, D-042). The terms were rewritten to the built behaviour in #94 (D-038); a warning is an email from info@, not a feature. | [voorwaarden/page.tsx](../../app/voorwaarden/page.tsx), [admin/meldingen/page.tsx](../../app/admin/meldingen/page.tsx), [reports.spec.ts](../../e2e/reports.spec.ts), [takedown.spec.ts](../../e2e/takedown.spec.ts), [users.spec.ts](../../e2e/users.spec.ts) |
| X-7 | **Fixed** (#75, #76, #77) | **Privacy and compliance gaps.** ~~No age or terms confirmation at sign-up (D-003)~~ — gate for every account in #75 (D-031). ~~Datadog RUM records 20% of sessions on replay, including private chats, and isn't in the privacy policy~~ — removed in #77 (D-023). ~~Zoekertjes keep the poster's real name in `title` after account deletion~~ — deleted with the account in #76 (D-021). Every processor and the retention per kind of data are on the privacy page (#77), which was reviewed against the GDPR in #94.                                                                                                     | [sign-up/page.tsx:72-83](../../app/auth/sign-up/page.tsx#L72-L83), [datadog-rum-provider.tsx:18](../../components/datadog-rum-provider.tsx#L18), [auth.ts:174-182](../../app/actions/auth.ts#L174-L182) |
| X-8 | **Fixed** (#70, #82) | **Schema drift between code paths.** Fixed for transfers: `category` is the type everywhere (database, `resolve_rumour()`, tabs, cards), and the transfer card's contact button, the only caller writing `transfer_talk`, is gone (D-004). `transfers.category` (written) vs `transfer_type` (read). `ad_type` was written as `transfer_talk` but checked as `"transfer"`; since #152 `classified` is the only ad type (database constraint, action, inbox), and the contact check covers every conversation. Validated fields (zoekertje `geslacht`) are never stored; rumour gender and divisions are stored since #67. The unused `createClassifiedSchema` didn't match the real types (removed in #61).                                         | [rumour.ts:111-118](../../app/actions/rumour.ts#L111-L118), [transfers/page.tsx:25](../../app/transfers/page.tsx#L25), [messages.ts:345](../../app/actions/messages.ts#L345) |
| X-9 | **Fixed** (#96; static pages declined in #167, D-040) | **No caching anywhere.** The layout header calls `getCurrentUser()`, which reads cookies, so every route renders dynamically and the `revalidate` exports have no effect. `/geruchten` runs 4 unpaginated full-table queries per request; the inbox runs one query per conversation (N+1). The untracked `k6/` stress test against production was removed in #60; load testing moved to #97, then was dropped for page speed in the browser (#199, D-045). #200 renders the rumour and zoekertje cards on the server, with one Realtime channel per page for the vote counts and the dialogs loaded on demand. #96 pages Transfer Talk and `/transfers` on the server, caches public data (tab counts, transfer lists, homepage counts) through a cookie-less client with tags the staff actions expire, and loads the inbox in a fixed number of queries. Pages still render per request: static info pages need Cache Components, which would turn 404s and redirects inside pages into 200s, so they stay off (#167, D-040). | [header.tsx:21](../../components/header.tsx#L21), [geruchten/page.tsx:43-46](../../app/geruchten/page.tsx#L43-L46), [messages.ts:291-306](../../app/actions/messages.ts#L291-L306) |
| X-10 | **Fixed** (#31, #38, #39, #56) | **Tooling.** ~~Lint broken, no tests, no CI, two lockfiles, `@supabase/supabase-js: "latest"`, critical Next advisories, package name `my-v0-project`.~~ CI (#31), packages and advisories (#38) and ESLint (#39) are fixed. Tests since #56: CI runs typecheck, lint, format check and build, then pgTAP and Playwright against the local Supabase stack on every PR and on `main`. | [package.json](../../package.json), [ci.yml](../../.github/workflows/ci.yml), [e2e/](../../e2e/), [supabase/tests/database/](../../supabase/tests/database/) |
| X-11 | **Fixed** (#36, D-009) | **Coming-soon mode only hides the homepage.** `NEXT_PUBLIC_COMING_SOON` is checked in `app/page.tsx` alone; every other route (`/geruchten/nieuw`, `/zoekertjes/nieuw`, `/auth/sign-up`, …) is live in production for anyone with the URL. That makes X-1 and X-2 public today, and means every merge to `main` is a public release. Preview deployments also share the production database. | [page.tsx:86](../../app/page.tsx#L86), [proxy.ts](../../proxy.ts) |

---

## 4. Journey detail

### J-01 — Visitor finds a matching zoekertje · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Active ads, newest first, featured marked, paginated, not expired | **FIXED** (#85) | [zoekertjes/page.tsx](../../app/zoekertjes/page.tsx), [zoekertjes-filters.spec.ts](../../e2e/zoekertjes-filters.spec.ts) | The database filters, sorts and pages (12 per page, `?pagina=`); a page past the end goes back to page 1. Ads featured right now head page 1 and are left out of the paged list. Expired ads are hidden by RLS and the query, and an ad is featured only until `featured_until` (#84, [zoekertjes-expiry.spec.ts](../../e2e/zoekertjes-expiry.spec.ts)) |
| Filter by type, province, division, position; reflected in URL | **FIXED** (#85) | [lib/classifieds-filters.ts](../../lib/classifieds-filters.ts), [classifieds-list.tsx](../../components/classifieds-list.tsx), [zoekertjes-filters.spec.ts](../../e2e/zoekertjes-filters.spec.ts) | `type`, `provincie`, `reeks`, `positie`, `q` and `sort` in the URL; unknown values are ignored. Type pills and page buttons are links. Divisions come from the one shared list (`RUMOUR_DIVISIONS`, incl. `promo4_heren`); positions and diplomas show Dutch labels |
| No error on empty description / anonymised author | **FIXED** (#59) | [classifieds-list.tsx:113](../../components/classifieds-list.tsx#L113), [zoekertjes-search.spec.ts](../../e2e/zoekertjes-search.spec.ts) | Search skips a `null` description and matches on title; a missing author shows as "Onbekend". Covered by a Playwright test with a seeded ad without description |
| Detail page shows fields and username, never contact details | WORKS | [zoekertjes/[id]/page.tsx:26-59](../../app/zoekertjes/[id]/page.tsx#L26-L59) | The `contact_email` column is gone (#83, D-022, D-030); other users and visitors only read online ads, and a new conversation must be with the poster of an online ad (`validate_conversation_ad`, VR011) |
| Logged-out "Contact opnemen" → login → back | **FIXED** (#86) | [classified-detail-contact.tsx](../../components/classified-detail-contact.tsx), [zoekertje-detail.spec.ts](../../e2e/zoekertje-detail.spec.ts) | Logged-out visitors get a link to `/auth/login?next=/zoekertjes/<id>` (works before hydration); after login they are back on the ad and the message form opens there |
| Removed ad URL → Dutch "niet beschikbaar" page | **FIXED** (#90) | [zoekertjes/[id]/not-found.tsx](../../app/zoekertjes/[id]/not-found.tsx), [app/not-found.tsx](../../app/not-found.tsx), [not-found.spec.ts](../../e2e/not-found.spec.ts) | A gone, expired or unknown ad shows "Zoekertje niet beschikbaar" with links back (404); any other unknown URL shows "Pagina niet gevonden". A crashing page shows "Er ging iets mis" (`app/error.tsx`) |

### J-02 — Visitor reads Transfer Talk and transfers · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Only moderator-approved rumours visible | **WORKS** | [geruchten/page.tsx:12-30](../../app/geruchten/page.tsx#L12-L30), [rumour.ts:47-58](../../app/actions/rumour.ts#L47-L58) | Fixed in #65: RLS hides pending and rejected rumours; Transfer Talk lists approved statuses only. Moderators approve in the queue (#66) |
| Card shows neutral belief %, author track record, no good/evil labels | **FIXED** (#88) | [rumour-card.tsx](../../components/rumour-card.tsx), [track-record.spec.ts](../../e2e/track-record.spec.ts) | "63% van de stemmers denkt dat dit klopt" (or "Nog geen stemmen") in neutral colours, and the author's "5 van 6 bevestigd", on the card and in the detail view. The karma labels and trust points are gone (D-005) |
| Card renders for anonymised authors | **FIXED** (#57) | [rumour-card.tsx](../../components/rumour-card.tsx), [geruchten-deleted-creator.spec.ts](../../e2e/geruchten-deleted-creator.spec.ts) | Shows "Verwijderd account" without a trust score, in the card and the detail modal (X-2) |
| Source type and link shown | **WORKS** | [rumour-card.tsx](../../components/rumour-card.tsx), [rumour-sources.spec.ts](../../e2e/rumour-sources.spec.ts) | #67: "Bron: …" and the link on the card and in the detail view. A resolved rumour also links the official source the moderator used (#70) |
| "Melden" link on each card | **WORKS** | [rumour-card.tsx](../../components/rumour-card.tsx), [report-dialog.tsx](../../components/report-dialog.tsx), [reports.spec.ts](../../e2e/reports.spec.ts) | #79: "Melden" on every card and in the detail view; logged-out visitors go to login and back. The dialog also offers the takedown form (J-12) |
| Transfer tabs show the right items with correct labels | **WORKS** | [transfers/page.tsx](../../app/transfers/page.tsx), [lib/transfers.ts](../../lib/transfers.ts), [rumour-resolution.spec.ts](../../e2e/rumour-resolution.spec.ts) | #70, #82: one set of types (`category`), tabs Spelers / Trainers / Gestopt, Dutch labels, the confirmation date and the official source. Before, the page queried columns that don't exist and showed nothing |
| No "Contact <author>" on transfers (D-004) | **WORKS** | [transfer-card.tsx](../../components/transfer-card.tsx) | #82: one card for the homepage and `/transfers`, without a contact button |
| Pagination, <1 s p95 | **FIXED** (#96) | [geruchten/page.tsx](../../app/geruchten/page.tsx), [transfers/page.tsx](../../app/transfers/page.tsx), [lib/public-data.ts](../../lib/public-data.ts), [pagination.spec.ts](../../e2e/pagination.spec.ts) | 24 per page with `?pagina=` (and `?type=` for the transfer tabs, now links); tab counts and transfer lists cached for every visitor and expired by staff actions. Measured on a local production build with 500 rumours and 500 transfers: p95 under 60 ms per list page. No database load test (D-045); page speed in the browser is #199 |

### J-03 — Visitor creates an account · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Sign-up blocked without 16+ and terms confirmation | **WORKS** | [sign-up/page.tsx](../../app/auth/sign-up/page.tsx), [terms-checkboxes.tsx](../../components/terms-checkboxes.tsx), [terms-gate.spec.ts](../../e2e/terms-gate.spec.ts) | #75: two unticked, required checkboxes; the browser refuses the form without both, and the handler checks again |
| Google first-time users pass the same gate | **WORKS** | [lib/supabase/proxy.ts](../../lib/supabase/proxy.ts), [welkom/page.tsx](../../app/welkom/page.tsx), [terms-gate.spec.ts](../../e2e/terms-gate.spec.ts) | #75: the proxy sends every logged-in user without an acceptance of the current terms to `/welkom` (only info, auth and takedown pages stay open), then back to where they were going. Provider-agnostic, so it also asks accounts from before the gate once (D-031). Tested with a password account; Google OAuth can't run locally |
| Email confirmation logs in and returns to origin page | **WORKS** | [auth.ts](../../app/actions/auth.ts), [callback/route.ts](../../app/auth/callback/route.ts), [sign-up.spec.ts](../../e2e/sign-up.spec.ts) | #89: sign-up is a server action; the link goes through `/auth/callback?flow=signup&next=…`, logs in and lands on the origin page. Opened in another browser it asks to log in (address confirmed) and keeps `next`; a used or expired link says so. Local Supabase now requires confirmation like production, and the test follows the link from Mailpit |
| Taken/invalid username → Dutch field error | **WORKS** | [schemas.ts](../../lib/schemas.ts), [refuse_taken_username.sql](../../supabase/migrations/20261018172443_refuse_taken_username.sql), [signup_username.test.sql](../../supabase/tests/database/signup_username.test.sql), [sign-up.spec.ts](../../e2e/sign-up.spec.ts) | #89: 3–30 letters, digits and `_`, stored lowercase; "Deze gebruikersnaam bestaat al" under the field (any case); the trigger refuses a taken or invalid name (VR012) instead of adding a suffix. Supabase errors mapped to Dutch; one password minimum of 8 (sign-up, reset, change, `config.toml`) |
| Consent timestamp and terms version stored | **WORKS** | [terms_acceptance.sql](../../supabase/migrations/20261018141947_terms_acceptance.sql), [terms_acceptance.test.sql](../../supabase/tests/database/terms_acceptance.test.sql) | #75: `terms_acceptances` (user, version, time); the database sets version and time, users can't write rows. Email sign-up records it through the sign-up trigger, `/welkom` through `accept_terms()` |
| No account enumeration | **WORKS** | [auth.ts](../../app/actions/auth.ts) | #89: an already registered address gets the same "Controleer je e-mail" as a new one. "Confirm email" is on in the production dashboard (owner confirmed 2026-10-19, A4); usernames are public anyway. Login already avoids enumeration |

### J-04 — Player posts "speler zoekt team" · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Logged-out → redirect to login and back | **WORKS** | [zoekertjes/nieuw/page.tsx](../../app/zoekertjes/nieuw/page.tsx), [zoekertje-create.spec.ts](../../e2e/zoekertje-create.spec.ts) | Fixed in #71: the page sends logged-out visitors to `/auth/login?next=/zoekertjes/nieuw` before they fill anything in |
| Senior divisions only | **WORKS** | [classifieds-utils.ts](../../lib/classifieds-utils.ts), [classified_gender_and_diploma.sql](../../supabase/migrations/20261015093039_classified_gender_and_diploma.sql) | Same list as rumours (`promo4_heren` now labelled); checked by the server action and, for new or changed rows, by the database (#71) |
| Server-side validation, Dutch messages, all fields stored | **WORKS** | [classifieds.ts](../../app/actions/classifieds.ts), [schemas.ts](../../lib/schemas.ts) | Fixed in #71: `createClassified` validates with `createClassifiedSchema` (Dutch messages); gender and diploma have their own columns and are shown on the ad (D-019) |
| Lands on new ad's detail page with toast | **WORKS** | [classified-form.tsx](../../components/classified-form.tsx) | Fixed in #71: "Je zoekertje staat online" on the new ad |
| Expiry date set and shown | **WORKS** | [zoekertjes_privacy_and_expiry.sql](../../supabase/migrations/20261018102058_zoekertjes_privacy_and_expiry.sql), [zoekertjes/[id]/page.tsx](../../app/zoekertjes/[id]/page.tsx) | #84: the database sets `expires_at` (next 31 August, at least 30 days, D-024); users can't change it. "Online tot …" on the ad and in "Mijn zoekertjes" |
| Notice that name and club will be public | **WORKS** | [classified-form.tsx](../../components/classified-form.tsx) | Fixed in #71: "Je zoekertje is openbaar: …" above the submit button |

### J-05 — Player manages own zoekertjes · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| "Mijn zoekertjes" with status | **WORKS** | [zoekertjes/mijn/page.tsx](../../app/zoekertjes/mijn/page.tsx), [zoekertjes-mijn.spec.ts](../../e2e/zoekertjes-mijn.spec.ts) | #72: `/zoekertjes/mijn`, linked from the profile, lists every ad as Online, Gevonden, Verlopen or "Verwijderd door een moderator". #84: an expired ad has "Verlengen", which puts it back online by the same rule (`renew_classified()`) |
| Edit | **WORKS** | [classifieds.ts](../../app/actions/classifieds.ts), [bewerken/page.tsx](../../app/zoekertjes/[id]/bewerken/page.tsx) | #72: `updateClassified` uses the create schema; the change shows at once in the list and on the detail page. The type stays fixed (owners can't update it); an ad a moderator removed can't be edited |
| Mark "gevonden" (deactivate) | **WORKS** | [my-classified-actions.tsx](../../components/my-classified-actions.tsx) | #72: leaves the list and returns 404 for others; the owner still sees it and can put it back online. Conversations stay |
| Delete with confirmation | **WORKS** | [my-classified-actions.tsx](../../components/my-classified-actions.tsx) | #72: confirmation dialog; conversations stay and show "Verwijderd zoekertje"; reports about the ad go with it (D-015). Suspended users can delete but not edit (D-016) |
| Non-owners refused by RLS and server | **WORKS** | [classified_owner_updates migration](../../supabase/migrations/20261015112454_classified_owner_updates.sql), [classifieds_owner.test.sql](../../supabase/tests/database/classifieds_owner.test.sql) | #72: every action filters on the user; RLS limits UPDATE and DELETE to the owner (pgTAP); the edit page returns 404 to others |

### J-06 — Coach contacts a club · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Existing conversation → open it; else modal | WORKS | [classified-detail-contact.tsx:25-40](../../components/classified-detail-contact.tsx#L25-L40), [messages.ts:49-81](../../app/actions/messages.ts#L49-L81) | Logged out: login first and back to the ad (#86) |
| No contact button on own ad | WORKS | [zoekertjes/[id]/page.tsx:165](../../app/zoekertjes/[id]/page.tsx#L165) | |
| Real-time delivery; ad title and link in conversation | WORKS | [chat-interface.tsx:98-150](../../components/chat-interface.tsx#L98-L150), [[conversationId]/page.tsx:64-71](../../app/messages/[conversationId]/page.tsx#L64-L71) | Works for zoekertjes; transfer conversations would look in the wrong table (X-8), which is moot under D-004 |
| Email notification to offline recipient | **WORKS** | [email_notifications migration](../../supabase/migrations/20261018200436_email_notifications.sql), [notifications.ts](../../lib/notifications.ts), [notifications.spec.ts](../../e2e/notifications.spec.ts) | #98 (D-025, D-032): "Je hebt een nieuw bericht" with a link, never the text or the sender. One email per run of unread messages; none while the recipient was active in the conversation in the last 10 minutes. Off on the profile |
| Inbox ordering, unread counts, header badge | WORKS | [messages.ts:244-362](../../app/actions/messages.ts#L244-L362), [user-menu.tsx](../../components/user-menu.tsx), [realtime-scope.spec.ts](../../e2e/realtime-scope.spec.ts) | Inbox: a fixed number of queries, the last message embedded per conversation (#96). Badge: one count on `recipient_id`, live through a filtered subscription (#74) |
| Non-participants can never read, incl. Realtime | **WORKS** | [messages_recipient migration](../../supabase/migrations/20261015135308_messages_recipient.sql), [realtime-scope.spec.ts](../../e2e/realtime-scope.spec.ts) | #74: both subscriptions are filtered on the server, and RLS keeps a third user's events out even when they subscribe without a filter or with someone else's (tested) |

### J-07 — Coach blocks or reports · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Block stops new messages and conversations | **WORKS** | [block_users migration](../../supabase/migrations/20261015080113_block_users.sql), [page.tsx](../../app/messages/[conversationId]/page.tsx), [blocks.spec.ts](../../e2e/blocks.spec.ts) | #73: "Blokkeren" in the conversation with a confirmation. A database trigger refuses messages and new conversations in both directions (`VR008`), so no code path can skip it; the other user sees "Je kan deze gebruiker geen berichten sturen". Earlier messages stay readable (D-018) |
| Report conversation → moderator report | **WORKS** | [messages/[conversationId]/page.tsx](../../app/messages/[conversationId]/page.tsx), [reports.ts](../../app/actions/reports.ts), [reports.spec.ts](../../e2e/reports.spec.ts) | #87: "Melden" in the conversation, with a reason and optionally blocking the other user; confirmation shown; lands in `/admin/meldingen` (D-015) |
| Unblock from profile | **WORKS** | [blocked-users-card.tsx](../../app/profile/blocked-users-card.tsx), [messages.ts:400](../../app/actions/messages.ts#L400) | #73: "Geblokkeerde gebruikers" on the profile page with "Deblokkeren"; also from the conversation |
| Archive only for me | **WORKS** | [conversation_archives migration](../../supabase/migrations/20261016123232_conversation_archives.sql), [archive-conversation-button.tsx](../../components/archive-conversation-button.tsx), [messages-archive.spec.ts](../../e2e/messages-archive.spec.ts) | #91: archive and unarchive from the inbox, with an "Archief" tab. One `conversation_archives` row per user replaces the shared `is_archived` flag, and RLS limits each user to their own rows. A new incoming message brings the conversation back to the inbox |

### J-08 — Club recruits player/trainer · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Team gender, division, province, position/diploma stored and shown | **WORKS** | [classifieds.ts](../../app/actions/classifieds.ts), [zoekertjes/[id]/page.tsx](../../app/zoekertjes/[id]/page.tsx) | Fixed in #71: "Dames/Heren" matches the division, optional minimum diploma for teams (D-019); positions and diplomas shown with their labels |
| One conversation per candidate, labelled with ad | WORKS | [messages.ts:117-152](../../app/actions/messages.ts#L117-L152) | |
| Close the ad, conversations remain | **WORKS** | [my-classified-actions.tsx](../../components/my-classified-actions.tsx) | #72: "Gevonden" in "Mijn zoekertjes"; see J-05 |
| Verified badge on ads | WORKS | [classifieds-list.tsx:455-457](../../components/classifieds-list.tsx#L455-L457) | Badge is granted manually in the database (no admin UI) |

### J-09 — Contributor submits a sourced rumour · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Senior divisions; source type required + optional URL | **WORKS** | [schemas.ts](../../lib/schemas.ts), [rumour_sources_and_pending_cap.sql](../../supabase/migrations/20261014145732_rumour_sources_and_pending_cap.sql) | Fixed in #67: four fixed source types (D-013), optional http(s) link, senior divisions checked in the database; source shown on the card and in the queue |
| Good-faith / senior-person declaration | **WORKS** | [geruchten/nieuw/page.tsx](../../app/geruchten/nieuw/page.tsx) | Fixed in #67: both required in the form, the server action and the database |
| Stored as pending, invisible, "wordt nagekeken" message | **WORKS** | [rumour.ts:47-70](../../app/actions/rumour.ts#L47-L70), [geruchten/nieuw/page.tsx:128](../../app/geruchten/nieuw/page.tsx#L128) | Fixed in #65: stored as pending, author sees "Je gerucht wordt nagekeken" |
| All filled fields stored | **WORKS** | [rumour.ts](../../app/actions/rumour.ts) | Fixed in #67: gender, current and destination division are stored |
| Max N pending per user | **WORKS** | [rumour_sources_and_pending_cap.sql](../../supabase/migrations/20261014145732_rumour_sources_and_pending_cap.sql) | Fixed in #67: 5 per contributor, enforced by `check_new_rumour()` (D-013) |
| Notified on approve/reject | **WORKS** | [moderation.ts](../../app/actions/moderation.ts), [notifications.spec.ts](../../e2e/notifications.spec.ts) | #98: an email on approval or rejection, without the rumour; the reason is on the profile (#66). Off on the profile |
| Login required | **WORKS** | [geruchten/nieuw/page.tsx](../../app/geruchten/nieuw/page.tsx), [login/page.tsx](../../app/auth/login/page.tsx) | Fixed in #67: login returns to the form (`?next=`, also through Google) |
| Edit while pending | **WORKS** (#192) | [withdraw_own_rumour migration](../../supabase/migrations/20261020130343_withdraw_own_rumour.sql), [geruchten/[id]/bewerken](../../app/geruchten/[id]/bewerken/page.tsx), [rumour-withdraw.spec.ts](../../e2e/rumour-withdraw.spec.ts) | "Bewerken" on the profile reuses the submit form. An UPDATE policy limits edits to the author's own pending rumours, and `check_rumour_edit()` repeats the submission checks; suspended users can't edit (D-042) |

### J-10 — Own rumours, track record, voting · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| See status of each of my rumours | **FIXED** (#88) | [profile-view.tsx](../../app/profile/profile-view.tsx), [track-record.spec.ts](../../e2e/track-record.spec.ts) | "Mijn geruchten" on the profile lists all of them with every status (wordt nagekeken, afgewezen + reden, lopend, bevestigd, ontkracht, niet bevestigd, verwijderd, ingetrokken) |
| Track record = confirmed vs denied | **FIXED** (#88) | [track_record migration](../../supabase/migrations/20261017115222_contributor_track_record.sql), [track_record.test.sql](../../supabase/tests/database/track_record.test.sql) | `profiles.rumours_confirmed` and `rumours_denied`, recounted by a trigger on rumours whenever a status or author changes: the one place it's calculated. Expired, pending, rejected and removed rumours don't count. Shown on the profile, on cards and in the moderation queue; "Betrouwbare bronnen" (`trusted_sources()`) lists contributors with at least 5 resolved rumours, most accurate first. Trust points, tiers and achievements are gone |
| Vote once, change vote, correct under concurrency | **FIXED** (#78) | [vote_integrity migration](../../supabase/migrations/20261016224117_vote_integrity.sql), [vote.ts](../../app/actions/vote.ts), [votes.spec.ts](../../e2e/votes.spec.ts) | The `on_vote_change` trigger counts in the database. It locks the rumour row first, so concurrent votes all count, and it recounts when a vote is deleted (account deletion). Votes are private: users read only their own. Pages load the user's votes in one query (#129). A visitor who votes gets "Log in om te stemmen" with a button to the login page, which returns to the page |
| Can't vote on own rumour | **FIXED** (#78) | [vote_integrity migration](../../supabase/migrations/20261016224117_vote_integrity.sql), [rumour-card.tsx](../../components/rumour-card.tsx) | `check_vote_allowed` refuses it (`VR009`); the card disables the buttons and says why |
| Votes don't change reputation | **FIXED** (#88) | [track_record migration](../../supabase/migrations/20261017115222_contributor_track_record.sql), [vote_integrity.test.sql](../../supabase/tests/database/vote_integrity.test.sql) | The vote trigger counts on the rumour only; `trust_score` and `total_votes_received` are dropped |
| Voting closed when not live | **FIXED** (#78) | [vote_integrity migration](../../supabase/migrations/20261016224117_vote_integrity.sql), [rumour-card.tsx](../../components/rumour-card.tsx) | Only lopende rumours take votes, new or changed (`VR010`); confirmed and denied cards show "Stemmen kan alleen op lopende geruchten" |
| Withdraw my pending or lopend rumour | **WORKS** (#192) | [withdraw_own_rumour migration](../../supabase/migrations/20261020130343_withdraw_own_rumour.sql), [my-rumour-actions.tsx](../../components/my-rumour-actions.tsx), [withdraw_own_rumour.test.sql](../../supabase/tests/database/withdraw_own_rumour.test.sql) | "Intrekken" with a confirmation; `withdraw_rumour()` sets status `withdrawn` (author only, from pending or lopend). Hidden by RLS like removed; open reports and takedowns stay in the inbox, marked as withdrawn; text wiped after 12 months (`wipe_withdrawn_rumours()`, nightly since #202, D-046) (D-042) |

### J-11 — Account and personal data · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Password reset link → set new password | **FIXED** (#58) | [update-password/page.tsx](../../app/auth/update-password/page.tsx), [password-reset.spec.ts](../../e2e/password-reset.spec.ts) | The link opens "Nieuw wachtwoord instellen"; only a session from a reset link may set a password there, and an expired or used link gets a Dutch message. The link works in the browser that requested it (PKCE) |
| Google-only account can add a password | **FIXED** (#58) | [auth.ts](../../app/actions/auth.ts) (`sendPasswordSetupLink`), [password-reset.spec.ts](../../e2e/password-reset.spec.ts) | Through the same reset link, from "Wachtwoord vergeten?" or the profile's "Stuur me een link". Covered by a seeded Google-only account (password login after; Google login itself isn't testable locally) |
| Avatar upload with type/size limits | **FIXED** (#92) | [avatar_uploads migration](../../supabase/migrations/20261018181718_avatar_uploads.sql), [profile.ts](../../app/actions/profile.ts) (`uploadAvatar`), [avatar.spec.ts](../../e2e/avatar.spec.ts) | JPG, PNG or WebP up to 5 MB, checked by reading the file; the server re-encodes it to a 400x400 WebP without metadata (no location). Stored in the public `avatars` bucket, in a folder only its owner can write; profiles store a path, never a URL (a CHECK keeps it in the own folder), so no outside image can track visitors. Existing URLs and Google pictures cleared. Deleting the account removes the file |
| Account deletion removes or anonymises per spec | **FIXED** (#76) | [delete_own_account migration](../../supabase/migrations/20261018095649_delete_own_account.sql), [account-deletion.spec.ts](../../e2e/account-deletion.spec.ts) | Profile, zoekertjes (D-021), votes, blocks, conversations with their messages and unpublished rumours are deleted; published rumours and reports stay without the user (D-029); a hashed entry in the deletion log |
| No half-deleted state on failure | **FIXED** (#76) | [delete_own_account.test.sql](../../supabase/tests/database/delete_own_account.test.sql) | One database function, one transaction; pgTAP fails its last step and checks that nothing was deleted |
| Privacy page lists all processors | **FIXED** (#77) | [privacy/page.tsx](../../app/privacy/page.tsx), [privacy.spec.ts](../../e2e/privacy.spec.ts) | Supabase, Vercel (hosting, Web Analytics, Speed Insights), Resend and Google, with retention per kind of data; Datadog removed (D-023); a test checks the site loads nothing from other hosts |
| Profile edit (username) | WORKS | [profile.ts:6-38](../../app/actions/profile.ts#L6-L38) | Minimal validation (2+ characters, no uniqueness message) |

### J-12 — Takedown request by named person · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| File without login, bot-protected | **WORKS** (#68) | [verwijderverzoek/page.tsx](../../app/verwijderverzoek/page.tsx), [takedown.ts](../../app/actions/takedown.ts), `submit_takedown_request()` | From the rumour detail view, the footer and the privacy page; honeypot plus 5 per IP and 3 per email per day |
| Rumour hidden immediately pending review | **CHANGED** (D-014) | — | The owner decided the rumour stays visible until a moderator decides |
| Acknowledgement with reference | **WORKS** (#68) | [takedown-form.tsx](../../app/verwijderverzoek/takedown-form.tsx) | Reference and private status link on screen; staff are emailed (#181). The contact form stores messages for staff since #81 (D-017) |
| Outcome communicated | **WORKS** (#68) | [status page](../../app/verwijderverzoek/status/[token]/page.tsx), `remove_rumour_for_takedown()`, `reject_takedown_request()` | The status link shows the decision and the moderator's note; the requester gets one email with a second link (#181, D-039) |
| Requests visible only to moderators, retention defined | **WORKS** (#68) | [admin/meldingen](../../app/admin/meldingen/page.tsx), `anonymise_expired_takedown_requests()` | RLS: staff only, hashes never readable. Personal fields wiped after 12 months (D-014), nightly since #202 (D-046) |
| Removal takes the person off the site | **WORKS** (#151) | `delete_transfer_of_removed_rumour()`, [removed_rumour_transfer.test.sql](../../supabase/tests/database/removed_rumour_transfer.test.sql), [takedown.spec.ts](../../e2e/takedown.spec.ts) | Removing a confirmed rumour (takedown or report) also deletes its transfer from `/transfers` and the homepage, logged as "Transfer verwijderd" (D-033) |

### J-13 — Pre-moderation queue · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Non-staff get 404/403 on `/admin` and admin actions | **WORKS** | [admin/layout.tsx](../../app/admin/layout.tsx), [staff.ts](../../lib/staff.ts) | #63: the layout 404s for non-staff; admin actions use `requireStaff()`, and the moderation functions check `is_staff()` again |
| Pending list oldest first with track record | **WORKS** | [admin/wachtrij/page.tsx](../../app/admin/wachtrij/page.tsx), [track-record.spec.ts](../../e2e/track-record.spec.ts) | #66: oldest first; #88: "speler_jana · 1 van 1 bevestigd" next to each author (D-005). Sources since #67 |
| Approve → live, author notified | **WORKS** | [moderation.ts](../../app/actions/moderation.ts), `approve_rumour()` | #66: approved rumours go live and the author's profile shows "Lopend". #98: the author is emailed (unless they turned emails off) |
| Reject with reason | **WORKS** | `reject_rumour()`, [profile-view.tsx](../../app/profile/profile-view.tsx) | #66: fixed list of reasons (note required for "Andere"); the author sees the reason on their profile |
| Audit log | **WORKS** | `log_staff_action()`, [admin/logboek](../../app/admin/logboek/page.tsx) | #64, #66: approve and reject log in the same transaction as the decision |

### J-14 — Resolve a rumour · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Confirm with source → typed transfer linked to rumour | **WORKS** | [rumour_resolution migration](../../supabase/migrations/20261017110217_rumour_resolution.sql), [admin/geruchten](../../app/admin/geruchten/page.tsx), [rumour-resolution.spec.ts](../../e2e/rumour-resolution.spec.ts) | #70: `resolve_rumour()` is staff-only (D-020), needs an http(s) source and a type that fits the rumour (preselected from its gender), and makes the transfer with the clubs, division and date in the same transaction as the log entry |
| No duplicate transfer on re-confirm | **WORKS** | [rumour_resolution.test.sql](../../supabase/tests/database/rumour_resolution.test.sql) | Only lopende rumours can be resolved (row lock), and `source_rumour_id` is unique |
| Deny / expire, close voting, update track record | **WORKS** | `resolve_rumour()`, [track_record migration](../../supabase/migrations/20261017115222_contributor_track_record.sql), [track-record.spec.ts](../../e2e/track-record.spec.ts) | Status changes, voting closes (#78), the author sees it on their profile and Transfer Talk filters "Niet bevestigd". A confirmation or denial updates the author's track record at once (#88); expiring is neutral |
| Bulk "niet bevestigd" at window close | **WORKS** | `expire_open_rumours()`, [expire-all.tsx](../../app/admin/geruchten/expire-all.tsx) | One button with a confirmation; one log entry per rumour |
| Add transfer directly | **WORKS** | `create_transfer()`, [admin/transfers](../../app/admin/transfers/page.tsx) | Needs an official source; dated in Belgian time |
| Correct or remove a transfer, audited | **WORKS** | `update_transfer()`, `delete_transfer()` | The log keeps what the transfer said before. Removing a rumour's transfer makes the rumour lopend again, so a wrong confirmation can be redone |
| Reopen a wrongly denied or expired rumour, audited | **WORKS** | [reopen_rumour migration](../../supabase/migrations/20261019083251_reopen_rumour.sql), [reopen_rumour.test.sql](../../supabase/tests/database/reopen_rumour.test.sql), [rumour-resolution.spec.ts](../../e2e/rumour-resolution.spec.ts) | #150: "Afgesloten" tab on `/admin/geruchten`; `reopen_rumour()` is staff-only, needs a reason, makes the rumour lopend and logs "Gerucht heropend" with the decision it undid; the track record follows through its trigger and voting opens again |

### J-15 — Reports, takedowns, sanctions · WORKS

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Open reports list incl. takedowns | **WORKS** | [admin/meldingen/page.tsx](../../app/admin/meldingen/page.tsx) | #69: one list, takedown requests first ("Voorrang"), then reports oldest first, with type, reason, reporter and the content |
| Read reported conversation via report only, logged | **WORKS** | [user_reports migration](../../supabase/migrations/20261014174640_user_reports.sql), [reports.test.sql](../../supabase/tests/database/reports.test.sql) | `get_reported_conversation()`: staff only, open reports only, every read logged as "Gemeld gesprek gelezen". No staff policy on messages |
| Remove content from all views, notify author | **WORKS** | [user_reports migration](../../supabase/migrations/20261014174640_user_reports.sql), [profile-view.tsx](../../app/profile/profile-view.tsx) | Rumours get status `removed`, zoekertjes `removed_at` (RLS hides both); the author sees "Verwijderd" and the moderator's note on their profile. No email (D-037) |
| Suspend user (read-only) | **WORKS** | [user_sanctions migration](../../supabase/migrations/20261014193846_user_sanctions.sql), [user_sanctions.test.sql](../../supabase/tests/database/user_sanctions.test.sql), [users.spec.ts](../../e2e/users.spec.ts) | #80: admins suspend until a date or indefinitely, with a reason; the database refuses the user's posts, votes, messages and profile edits (`VR005`); the user sees a notice on every page (D-016) |
| Audit log, reporter informed | **WORKS** | [staff_actions](../../supabase/migrations/20261014174640_user_reports.sql) | Every decision and conversation read is logged. The reporter gets a confirmation only (D-015, D-037) |
| Contact form reaches staff | **WORKS** | [contact_messages migration](../../supabase/migrations/20261015072309_contact_messages.sql), [/admin/contact](../../app/admin/contact/page.tsx), [contact.spec.ts](../../e2e/contact.spec.ts) | #81: messages stored (honeypot, daily limits), read and marked handled by staff, logged; wiped 12 months after handling (D-017). Staff are emailed about every new message (#181) |
| Grant/revoke verified badge and moderator role | **WORKS** | [/admin/gebruikers](../../app/admin/gebruikers/page.tsx), [user_sanctions migration](../../supabase/migrations/20261014193846_user_sanctions.sql) | #80: admins only, logged; moderators see the status. The admin role is set by the owner in SQL (D-016) |

---

## 5. To verify against the database (input for the schema step)

These can't be answered from code; each one determines whether a finding above
is a real hole or merely fragile.

1. RLS on `rumours`: can an authenticated user `UPDATE` any rumour? `vote.ts` needs this for `votes_*`. If yes, anyone can rewrite any rumour's text.
2. RLS on `profiles`: can a user update **another** user's `trust_score` (`vote.ts:158`)? Which columns are writable by the owner (e.g. `is_verified_source`, `trust_score` on their own row)?
3. RLS on `classifieds`: insert restricted to `user_id = auth.uid()`; can users set `is_featured` themselves?
4. RLS on `messages` / `conversations`: participant-only SELECT (this also governs Realtime); INSERT only as `sender_id = auth.uid()` into own conversations.
5. RLS on `blocked_users`, `reported_conversations`, `rumour_votes`, `waitlist_subscribers` (insert-only for anon?).
6. Default value and allowed values of `rumours.status`; is there a check constraint or enum?
7. `transfers`: actual columns (`category` vs `transfer_type`, `transfer_date`, `is_official`, `creator_id`), values in use, and whether `source_rumour_id` is unique.
8. `increment_trust_score` and `get_interest_count`: SECURITY DEFINER? `EXECUTE` granted to whom? Can any user call `increment_trust_score` directly to raise their own score?
9. Realtime publication membership (`rumours`, `messages`).
10. Auth settings: confirm-email on, redirect allow-list, Google provider, password min length (UI says 6 on sign-up, 8 on change).
11. Storage buckets and policies (avatars?). The `avatars` bucket and its policies now come from a migration (#92).
12. Whether `is_google_only_account` still exists in production.

---

## 6. Dead code and leftovers

- ~~Never called: `getRumourData`, `getProfileStats`, `getFirstRumourToConfirm`; `createClassifiedSchema`, `loginSchema`, `signUpSchema`, `updateProfileSchema`, `changePasswordSchema`, `contactSchema`, `createVoteSchema`, `blockUserSchema` in `lib/schemas.ts`~~ — removed in #61, with the unused `confirmRumourSchema`.
- ~~Unused components: `classified-card-interactive.tsx`, `classified-card.tsx`~~ — removed in #61.
- ~~`/protected` redirect in `lib/supabase/proxy.ts` refers to a route that doesn't exist (Supabase template leftover)~~ — removed in #61. Also removed: `ignoreBuildErrors` in `next.config.mjs` and every unused import and variable.
- ~~`datadogRUM-init.js` at the repo root duplicated the provider with placeholder values~~ — removed in #60, with `FEATURES.md`, the v0 README and the `generator: "v0.app"` metadata.
- ~~`pnpm-lock.yaml` is stale~~ — removed in #38.
