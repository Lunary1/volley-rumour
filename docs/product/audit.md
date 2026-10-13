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
| J-01    | Find a matching zoekertje                | **PARTIAL** | Search crashes on ads without a description; logged-out contact dead-ends   |
| J-02    | Read Transfer Talk / transfers           | **BROKEN**  | Unmoderated rumours are public; page crashes on anonymised rumours          |
| J-03    | Create an account                        | **PARTIAL** | No 16+ / terms confirmation; raw English errors                             |
| J-04    | Post "speler zoekt team"                 | **PARTIAL** | Browser-side insert without server validation; gender silently dropped      |
| J-05    | Manage own zoekertjes                    | **MISSING** | No edit, deactivate or delete anywhere                                      |
| J-06    | Coach contacts a club                    | **PARTIAL** | No notifications; message privacy rests entirely on unverified RLS         |
| J-07    | Block / report                           | **MISSING** | Server actions exist, no UI; block isn't enforced when sending              |
| J-08    | Club recruits player/trainer             | **PARTIAL** | Team gender dropped; no diploma field; can't close an ad                    |
| J-09    | Submit a sourced rumour                  | **PARTIAL** | Goes live instantly (no pending state); no source field                     |
| J-10    | Own rumours, track record, voting        | **PARTIAL** | Vote counts are race-prone; homepage votes aren't saved                     |
| J-11    | Account and personal data                | **BROKEN**  | Password reset lands on a non-existent page                                 |
| J-12    | Takedown request by named person         | **MISSING** | No path at all; contact form "report" is only `console.log`                 |
| J-13    | Pre-moderation queue                     | **MISSING** | No staff role, no admin area                                                |
| J-14    | Resolve a rumour                         | **MISSING** | `confirmRumour` exists but has no auth check and no caller                  |
| J-15    | Reports, takedowns, sanctions            | **MISSING** | Reports can be written to the database but nobody can read them            |

**Count:** 0 WORKS · 7 PARTIAL · 2 BROKEN · 6 MISSING.

---

## 3. Cross-cutting findings (ranked)

These are the issues that cut across journeys. Each becomes one or more backlog
items.

| #   | Severity     | Finding                                                                                                                                                                                                                                                                                                                                                                 | Evidence |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| X-1 | **Critical** | **Rumours about named people go live with no moderation.** `createRumour` inserts without a status, so the database default is used (probably `rumour`, i.e. live). Contradicts D-002 and the Terms ("geverifieerde moderators").                                                                                                                                       | [rumour.ts:47-58](../../app/actions/rumour.ts#L47-L58), [voorwaarden:90](../../app/voorwaarden/page.tsx#L90) |
| X-2 | **Critical** | **Transfer Talk and the homepage crash after any account deletion.** `deleteAccount` sets `rumours.creator_id = null`; `RumourCard` and `RumourDetailModal` read `rumour.creator.username` without a null check → client-side TypeError on `/geruchten` and `/`.                                                                                                    | [auth.ts:168-172](../../app/actions/auth.ts#L168-L172), [rumour-card.tsx:353](../../components/rumour-card.tsx#L353), [rumour-detail-modal.tsx:225](../../components/rumour-detail-modal.tsx#L225) |
| X-3 | **High**     | **`confirmRumour` has no authorisation check.** Any logged-in user who reaches it creates a transfer using the **service-role key** and awards +5 trust. It is unreachable today only because nothing references it. `getFirstRumourToConfirm` confirms whatever rumour is newest.                                                                                       | [rumour.ts:73-155](../../app/actions/rumour.ts#L73-L155), [rumour.ts:157-174](../../app/actions/rumour.ts#L157-L174) |
| X-4 | **High**     | **Vote integrity.** (a) Counts are read-modify-written in the app, so concurrent votes are lost. (b) A voter's session writes `rumours.votes_*` and **another user's** `profiles.trust_score`, which only works if RLS lets any user update any rumour or profile (VERIFY). (c) Homepage cards get no `onVote`, so votes look saved but aren't.                        | [vote.ts:62-163](../../app/actions/vote.ts#L62-L163), [page.tsx:215](../../app/page.tsx#L215), [rumour-card.tsx:158](../../components/rumour-card.tsx#L158) |
| X-5 | **High**     | **Message privacy rests entirely on unverified RLS.** Both Realtime subscriptions listen to *all* `messages` changes with no filter and filter in the browser. The header logs every payload to the console.                                                                                                                                                          | [chat-interface.tsx:102-109](../../components/chat-interface.tsx#L102-L109), [user-menu.tsx:66-76](../../components/user-menu.tsx#L66-L76) |
| X-6 | **High**     | **Promised safety features don't exist.** No moderation, report, takedown, edit or delete paths for rumours or zoekertjes, although the Terms promise removal, warnings and suspensions.                                                                                                                                                                              | [voorwaarden:208-225](../../app/voorwaarden/page.tsx#L208-L225) |
| X-7 | **High**     | **Privacy and compliance gaps.** No age or terms confirmation at sign-up (D-003). Datadog RUM records 20% of sessions on replay, including private chats, and isn't in the privacy policy. Zoekertjes keep the poster's real name in `title` after account deletion.                                                                                                     | [sign-up/page.tsx:72-83](../../app/auth/sign-up/page.tsx#L72-L83), [datadog-rum-provider.tsx:18](../../components/datadog-rum-provider.tsx#L18), [auth.ts:174-182](../../app/actions/auth.ts#L174-L182) |
| X-8 | **Medium**   | **Schema drift between code paths.** `transfers.category` (written) vs `transfer_type` (read). `ad_type` is written as `transfer_talk` but checked as `"transfer"`. Validated fields (rumour gender/divisions, zoekertje `geslacht`) are never stored. `createClassifiedSchema` doesn't match the real types and is unused.                                         | [rumour.ts:111-118](../../app/actions/rumour.ts#L111-L118), [transfers/page.tsx:25](../../app/transfers/page.tsx#L25), [messages.ts:345](../../app/actions/messages.ts#L345), [schemas.ts:124](../../lib/schemas.ts#L124) |
| X-9 | **Medium**   | **No caching anywhere.** The layout header calls `getCurrentUser()`, which reads cookies, so every route renders dynamically and the `revalidate` exports have no effect. `/geruchten` runs 4 unpaginated full-table queries per request; the inbox runs one query per conversation (N+1). Relevant to the k6 stress test against production. | [header.tsx:21](../../components/header.tsx#L21), [geruchten/page.tsx:43-46](../../app/geruchten/page.tsx#L43-L46), [messages.ts:291-306](../../app/actions/messages.ts#L291-L306) |
| X-10 | **Medium**  | **Tooling.** Lint broken, no tests, no CI, two lockfiles, `@supabase/supabase-js: "latest"`, critical Next advisories, package name `my-v0-project`.                                                                                                                                                                                                                  | [package.json](../../package.json) |
| X-11 | **High**    | **Coming-soon mode only hides the homepage.** `NEXT_PUBLIC_COMING_SOON` is checked in `app/page.tsx` alone; every other route (`/geruchten/nieuw`, `/zoekertjes/nieuw`, `/auth/sign-up`, …) is live in production for anyone with the URL. That makes X-1 and X-2 public today, and means every merge to `main` is a public release. Preview deployments also share the production database. | [page.tsx:86](../../app/page.tsx#L86), [proxy.ts](../../proxy.ts) |

---

## 4. Journey detail

### J-01 — Visitor finds a matching zoekertje · PARTIAL

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Active ads, newest first, featured marked, paginated, not expired | PARTIAL | [zoekertjes/page.tsx:8-31](../../app/zoekertjes/page.tsx#L8-L31), [classifieds-list.tsx:125-160](../../components/classifieds-list.tsx#L125-L160) | Sorting, featured section and 12-per-page work, but all rows are fetched and paginated in the browser; no expiry, and `featured_until` is ignored |
| Filter by type, province, division, position; reflected in URL | PARTIAL | [classifieds-list.tsx:83-121](../../components/classifieds-list.tsx#L83-L121) | Type and province only; filters live in component state, not the URL |
| No error on empty description / anonymised author | **BROKEN** | [classifieds-list.tsx:113](../../components/classifieds-list.tsx#L113) | `ad.description.toLowerCase()` throws when description is `null` (the form stores `null` for empty) and the title doesn't match the search |
| Detail page shows fields and username, never contact details | WORKS | [zoekertjes/[id]/page.tsx:26-59](../../app/zoekertjes/[id]/page.tsx#L26-L59) | `contact_email` isn't selected. Raw slugs are shown for position/diploma (e.g. `receptiehoek`, `trainer_b`) |
| Logged-out "Contact opnemen" → login → back | **BROKEN** | [classified-detail-contact.tsx:25-39](../../components/classified-detail-contact.tsx#L25-L39), [messages.ts:97-99](../../app/actions/messages.ts#L97-L99) | The modal opens anyway; the visitor writes a message and then gets a "Je moet ingelogd zijn" toast. No redirect |
| Removed ad URL → Dutch "niet beschikbaar" page | PARTIAL | [zoekertjes/[id]/page.tsx:82](../../app/zoekertjes/[id]/page.tsx#L82) | `notFound()` falls through to Next's default English 404; there's no `app/not-found.tsx` |

### J-02 — Visitor reads Transfer Talk and transfers · BROKEN

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Only moderator-approved rumours visible | **BROKEN** | [geruchten/page.tsx:12-30](../../app/geruchten/page.tsx#L12-L30), [rumour.ts:47-58](../../app/actions/rumour.ts#L47-L58) | No pending/approved concept; every submitted rumour is public (X-1) |
| Card shows neutral belief %, author track record, no good/evil labels | PARTIAL | [rumour-card.tsx:184-212](../../components/rumour-card.tsx#L184-L212) | Shows the "Evil/Corrupt/Heroic/Legendary" karma label and trust points instead of a track record (D-005, proposed) |
| Card renders for anonymised authors | **BROKEN** | [rumour-card.tsx:353](../../components/rumour-card.tsx#L353) | Crashes when `creator` is null (X-2) |
| Source type and link shown | MISSING | — | No source field exists |
| "Melden" link on each card | MISSING | — | No report path for rumours |
| Transfer tabs show the right items with correct labels | **BROKEN** | [transfers/page.tsx:25-39](../../app/transfers/page.tsx#L25-L39), [transfer-card-interactive.tsx:32-62](../../components/transfer-card-interactive.tsx#L32-L62), [rumour.ts:104-118](../../app/actions/rumour.ts#L104-L118) | The filters use `player/coach/retirement`, the labels expect `player_male/…`, and the confirm path writes `category`, not `transfer_type`. Either the tabs are empty or labels show "Onbekend". It also only ever maps to *male* types (VERIFY data) |
| No "Contact <author>" on transfers (D-004) | **BROKEN** | [transfer-card-interactive.tsx:158-171](../../components/transfer-card-interactive.tsx#L158-L171) | Button present; `creator_id` is never set by the confirm path |
| Pagination, <1 s p95 | PARTIAL | [geruchten/page.tsx:43-46](../../app/geruchten/page.tsx#L43-L46) | Transfers are capped at 50; rumours are unpaginated with 4 full queries per request (X-9) |

### J-03 — Visitor creates an account · PARTIAL

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Sign-up blocked without 16+ and terms confirmation | MISSING | [sign-up/page.tsx:191-246](../../app/auth/sign-up/page.tsx#L191-L246) | No checkboxes |
| Google first-time users pass the same gate | MISSING | [auth.ts:105-134](../../app/actions/auth.ts#L105-L134) | Google sign-up creates a full profile immediately via the trigger |
| Email confirmation logs in and returns to origin page | VERIFY | [sign-up/page.tsx:76-78](../../app/auth/sign-up/page.tsx#L76-L78) | `emailRedirectTo` is the site root, not `/auth/callback`; it relies on the browser client exchanging the PKCE code. Needs a manual test; it never returns to the origin page |
| Taken/invalid username → Dutch field error | PARTIAL | [handle_new_user_oauth.sql:31-34](../../supabase/migrations/20260219_handle_new_user_oauth.sql#L31-L34), [sign-up/page.tsx:88](../../app/auth/sign-up/page.tsx#L88) | A collision silently becomes `name_ab12`; other errors show Supabase's raw English message |
| Consent timestamp and terms version stored | MISSING | — | |
| No account enumeration | VERIFY | — | Depends on "Confirm email" being on in Supabase Auth (then `signUp` obfuscates existing users). Login already avoids enumeration ([auth.ts:40-45](../../app/actions/auth.ts#L40-L45)) |

### J-04 — Player posts "speler zoekt team" · PARTIAL

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Logged-out → redirect to login and back | **BROKEN** | [zoekertjes/nieuw/page.tsx:100-109](../../app/zoekertjes/nieuw/page.tsx#L100-L109) | No guard on load; the user fills in the whole form and only gets an error on submit |
| Senior divisions only | WORKS | [zoekertjes/nieuw/page.tsx:45-62](../../app/zoekertjes/nieuw/page.tsx#L45-L62) | Only Liga/Nationale/Promo. `promo4_heren` has no label in [classifieds-utils.ts:1-17](../../lib/classifieds-utils.ts#L1-L17) |
| Server-side validation, Dutch messages, all fields stored | **BROKEN** | [zoekertjes/nieuw/page.tsx:93-172](../../app/zoekertjes/nieuw/page.tsx#L93-L172) | The browser inserts directly into `classifieds` (RLS is the only guard, VERIFY); no server action or schema; `geslacht` is required but never stored |
| Lands on new ad's detail page with toast | PARTIAL | [zoekertjes/nieuw/page.tsx:174](../../app/zoekertjes/nieuw/page.tsx#L174) | Redirects to the list without confirmation |
| Expiry date set and shown | MISSING | — | |
| Notice that name and club will be public | MISSING | — | |

### J-05 — Player manages own zoekertjes · MISSING

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| "Mijn zoekertjes" with status | PARTIAL | [profile.ts:151-184](../../app/actions/profile.ts#L151-L184) | The profile shows the 5 most recent, each linking to the generic `/zoekertjes` list |
| Edit | MISSING | — | |
| Mark "gevonden" (deactivate) | MISSING | — | `is_active` is only ever set to `true` |
| Delete with confirmation | MISSING | — | |
| Non-owners refused by RLS and server | VERIFY | — | No server path exists; depends entirely on RLS |

### J-06 — Coach contacts a club · PARTIAL

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Existing conversation → open it; else modal | WORKS | [classified-detail-contact.tsx:25-40](../../components/classified-detail-contact.tsx#L25-L40), [messages.ts:49-81](../../app/actions/messages.ts#L49-L81) | Logged-in path only (see J-01) |
| No contact button on own ad | WORKS | [zoekertjes/[id]/page.tsx:165](../../app/zoekertjes/[id]/page.tsx#L165) | |
| Real-time delivery; ad title and link in conversation | WORKS | [chat-interface.tsx:98-150](../../components/chat-interface.tsx#L98-L150), [[conversationId]/page.tsx:64-71](../../app/messages/[conversationId]/page.tsx#L64-L71) | Works for zoekertjes; transfer conversations would look in the wrong table (X-8), which is moot under D-004 |
| Email notification to offline recipient | MISSING | — | No email sending exists anywhere |
| Inbox ordering, unread counts, header badge | WORKS | [messages.ts:244-362](../../app/actions/messages.ts#L244-L362), [user-menu.tsx:25-82](../../components/user-menu.tsx#L25-L82) | N+1 queries per conversation (X-9) |
| Non-participants can never read, incl. Realtime | VERIFY | [chat-interface.tsx:102-109](../../components/chat-interface.tsx#L102-L109) | The app checks participation in its own queries; Realtime is unfiltered and leans on RLS (X-5) |

### J-07 — Coach blocks or reports · MISSING

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Block stops new messages and conversations | **BROKEN** | [messages.ts:426-447](../../app/actions/messages.ts#L426-L447), [messages.ts:175-239](../../app/actions/messages.ts#L175-L239) | `blockUser` has no UI. `sendMessage` doesn't check blocks; only `createConversation` checks, and only one direction. The conversation page does hide the input when blocked ([page.tsx:189](../../app/messages/[conversationId]/page.tsx#L189)) |
| Report conversation → moderator report | PARTIAL | [messages.ts:520-548](../../app/actions/messages.ts#L520-L548) | The action writes `reported_conversations`, but there's no UI and no reader (J-15) |
| Unblock from profile | MISSING | [messages.ts:452-474](../../app/actions/messages.ts#L452-L474) | Action exists, no UI |
| Archive only for me | **BROKEN** | [messages.ts:504-507](../../app/actions/messages.ts#L504-L507) | `is_archived` sits on the shared conversation row, so it archives for both participants. No UI |

### J-08 — Club recruits player/trainer · PARTIAL

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Team gender, division, province, position/diploma stored and shown | **BROKEN** | [zoekertjes/nieuw/page.tsx:130-162](../../app/zoekertjes/nieuw/page.tsx#L130-L162) | "Dames/Heren" is required but never stored; "team zoekt trainer" has no diploma field; position is stored as a raw slug |
| One conversation per candidate, labelled with ad | WORKS | [messages.ts:117-152](../../app/actions/messages.ts#L117-L152) | |
| Close the ad, conversations remain | MISSING | — | See J-05 |
| Verified badge on ads | WORKS | [classifieds-list.tsx:455-457](../../components/classifieds-list.tsx#L455-L457) | Badge is granted manually in the database (no admin UI) |

### J-09 — Contributor submits a sourced rumour · PARTIAL

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Senior divisions; source type required + optional URL | PARTIAL | [geruchten/nieuw/page.tsx:28-45](../../app/geruchten/nieuw/page.tsx#L28-L45) | Senior divisions only (good); no source field (the description placeholder just suggests adding sources) |
| Good-faith / senior-person declaration | MISSING | — | |
| Stored as pending, invisible, "wordt nagekeken" message | **BROKEN** | [rumour.ts:47-70](../../app/actions/rumour.ts#L47-L70), [geruchten/nieuw/page.tsx:128](../../app/geruchten/nieuw/page.tsx#L128) | Published immediately; user is sent to the list (X-1) |
| All filled fields stored | **BROKEN** | [rumour.ts:47-56](../../app/actions/rumour.ts#L47-L56) | Gender, current division and destination division are validated, then discarded |
| Max N pending per user | MISSING | — | No rate limiting of any kind |
| Notified on approve/reject | MISSING | — | |
| Login required | PARTIAL | [geruchten/nieuw/page.tsx:85-106](../../app/geruchten/nieuw/page.tsx#L85-L106), [rumour.ts:15-21](../../app/actions/rumour.ts#L15-L21) | Client-side redirect plus server check (OK); doesn't return to the form after login |

### J-10 — Own rumours, track record, voting · PARTIAL

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| See status of each of my rumours | PARTIAL | [profile.ts:151-184](../../app/actions/profile.ts#L151-L184) | 5 most recent only; only the statuses `rumour/confirmed/denied` exist |
| Track record = confirmed vs denied | MISSING | [profile/page.tsx:50-130](../../app/profile/page.tsx#L50-L130) | Trust points plus derived achievements instead (D-005, proposed) |
| Vote once, change vote, correct under concurrency | **BROKEN** | [vote.ts:62-141](../../app/actions/vote.ts#L62-L141) | Once/change logic works; counts are read-modify-write in the app (X-4). Homepage votes aren't persisted ([page.tsx:215](../../app/page.tsx#L215)). Logged-out votes revert silently with no prompt to log in |
| Can't vote on own rumour | MISSING | [vote.ts:51-60](../../app/actions/vote.ts#L51-L60) | No check |
| Votes don't change reputation | **BROKEN** (vs D-005) | [vote.ts:147-163](../../app/actions/vote.ts#L147-L163) | +1 trust per first upvote, written from the voter's session to another user's profile (VERIFY RLS) |
| Voting closed when not live | MISSING | [rumour-card.tsx:313-347](../../components/rumour-card.tsx#L313-L347) | Vote buttons render for confirmed and denied rumours too |

### J-11 — Account and personal data · BROKEN

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Password reset link → set new password | **BROKEN** | [auth.ts:97-99](../../app/actions/auth.ts#L97-L99) | Redirects to `/auth/update-password`, which doesn't exist (404) |
| Google-only account can add a password | **BROKEN** | [profile.ts:58-66](../../app/actions/profile.ts#L58-L66) | The reset flow is broken, and "change password" requires a current password Google-only users don't have |
| Avatar upload with type/size limits | MISSING | [profile/page.tsx:227-231](../../app/profile/page.tsx#L227-L231) | Free-text avatar **URL** (an arbitrary external image URL) |
| Account deletion removes or anonymises per spec | PARTIAL | [auth.ts:145-268](../../app/actions/auth.ts#L145-L268) | Thorough, but zoekertjes keep the real name in `title` and stay public; afterwards the anonymised rumours crash the UI (X-2) |
| No half-deleted state on failure | **BROKEN** | [auth.ts:160-255](../../app/actions/auth.ts#L160-L255) | 11 sequential writes with early returns; e.g. if auth-user deletion fails, the profile is already gone |
| Privacy page lists all processors | PARTIAL | [privacy/page.tsx](../../app/privacy/page.tsx) | Mentions Supabase and Vercel Analytics; not Datadog RUM or session replay |
| Profile edit (username) | WORKS | [profile.ts:6-38](../../app/actions/profile.ts#L6-L38) | Minimal validation (2+ characters, no uniqueness message) |

### J-12 — Takedown request by named person · MISSING

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| File without login, bot-protected | MISSING | — | Nearest thing: contact form category "report" |
| Rumour hidden immediately pending review | MISSING | — | |
| Email acknowledgement with reference | **BROKEN** | [contact.ts:37-46](../../app/actions/contact.ts#L37-L46) | Contact form submissions are only `console.log`ged; nobody receives them, yet the user sees success |
| Outcome emailed | MISSING | — | |
| Requests visible only to moderators, retention defined | MISSING | — | |

### J-13 — Pre-moderation queue · MISSING

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Non-staff get 404/403 on `/admin` and admin actions | MISSING | — | No staff role anywhere in code (D-006) |
| Pending list oldest first with track record | MISSING | — | |
| Approve → live, author notified | MISSING | — | |
| Reject with reason | MISSING | — | |
| Audit log | MISSING | — | Only `deletion_audit_log` exists |

### J-14 — Resolve a rumour · MISSING

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Confirm with source → typed transfer linked to rumour | **BROKEN** | [rumour.ts:73-155](../../app/actions/rumour.ts#L73-L155) | No auth check (X-3); no source; male-only type mapping; `transfer_type` and `transfer_date` aren't set; no caller |
| No duplicate transfer on re-confirm | MISSING | [rumour.ts:111](../../app/actions/rumour.ts#L111) | Not guarded (unique `source_rumour_id`? VERIFY) |
| Deny / expire, close voting, update track record | MISSING | — | The `denied` filter exists on `/geruchten`, but nothing can set it |
| Bulk "niet bevestigd" at window close | MISSING | — | |
| Add transfer directly | MISSING | — | |
| Correct or remove a transfer, audited | MISSING | — | |

### J-15 — Reports, takedowns, sanctions · MISSING

| AC | Status | Evidence | Reason |
| -- | ------ | -------- | ------ |
| Open reports list incl. takedowns | MISSING | — | `reported_conversations` is written ([messages.ts:537](../../app/actions/messages.ts#L537)), never read |
| Read reported conversation via report only, logged | MISSING | — | |
| Remove content from all views, notify author | MISSING | — | |
| Suspend user (read-only) | MISSING | — | |
| Audit log, reporter informed | MISSING | — | |
| Grant/revoke verified badge and moderator role | MISSING | — | `is_verified_source` is set by hand in the database |

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
11. Storage buckets and policies (avatars?).
12. Whether `is_google_only_account` still exists in production.

---

## 6. Dead code and leftovers

- Never called: `getRumourData`, `getProfileStats`, `getFirstRumourToConfirm`; `createClassifiedSchema`, `loginSchema`, `signUpSchema`, `updateProfileSchema`, `changePasswordSchema`, `contactSchema`, `createVoteSchema`, `blockUserSchema` in [schemas.ts](../../lib/schemas.ts).
- Unused components: [classified-card-interactive.tsx](../../components/classified-card-interactive.tsx), [classified-card.tsx](../../components/classified-card.tsx).
- `/protected` redirect in [lib/supabase/proxy.ts:47-55](../../lib/supabase/proxy.ts#L47-L55) refers to a route that doesn't exist (Supabase template leftover).
- [datadogRUM-init.js](../../datadogRUM-init.js) at the repo root duplicates the provider with placeholder values.
- [pnpm-lock.yaml](../../pnpm-lock.yaml) is stale.
