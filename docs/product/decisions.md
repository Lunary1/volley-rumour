# Decision log — volleyrumours.be

Product and engineering decisions taken during the 2026 restart. Each entry has
the reasoning behind it so later changes can be argued against the original
intent. Status is one of **Accepted**, **Proposed** (needs owner sign-off) or
**Open** (still being thought through).

| ID    | Date       | Status   | Decision                                                          |
| ----- | ---------- | -------- | ----------------------------------------------------------------- |
| D-001 | 2026-10-13 | Accepted | One account type for launch; "verified" is a badge, not a role    |
| D-002 | 2026-10-13 | Accepted | Rumours are pre-moderated                                         |
| D-003 | 2026-10-13 | Accepted | Senior divisions only; users confirm they are 16+ at sign-up      |
| D-004 | 2026-10-13 | Accepted | In-app messaging is for zoekertjes only                           |
| D-005 | 2026-10-17 | Accepted | Replace popularity points with an accuracy-based track record     |
| D-006 | 2026-10-13 | Accepted | Moderation needs an admin role, separate from the user account type |
| D-007 | 2026-10-13 | Accepted | npm is the package manager; `pnpm-lock.yaml` is removed           |
| D-008 | 2026-10-13 | Accepted | GitHub Flow: protected `main` is production; PRs with CI, squash merge |
| D-009 | 2026-10-13 | Accepted | Coming-soon mode closes every route except the homepage and info pages |
| D-010 | 2026-10-13 | Accepted | Vercel previews keep using the production database; no separate preview project |
| D-011 | 2026-10-14 | Accepted | Staff audit log entries are kept 2 years, then deleted            |
| D-012 | 2026-10-14 | Accepted | Moderators may moderate their own rumours; the queue shows the username only |
| D-013 | 2026-10-14 | Accepted | Rumours name a public source; at most 5 waiting per contributor   |
| D-014 | 2026-10-14 | Accepted | Takedown requests: rumour stays up until a moderator decides; status link, no email; 12-month retention |
| D-015 | 2026-10-14 | Accepted | User reports: content stays up until decided; reporter gets a confirmation only; conversation reports close with an outcome |
| D-016 | 2026-10-14 | Accepted | Suspensions, the verified badge and the moderator role are admin-only; suspended users are read-only |
| D-017 | 2026-10-15 | Accepted | Contact messages: own staff page for moderators and admins; wiped 12 months after handling; abuse goes through Melden and takedowns |
| D-018 | 2026-10-15 | Accepted | Blocks are enforced by the database in both directions; history stays readable; messaging only, not logged |
| D-019 | 2026-10-15 | Accepted | Zoekertjes: "Dames/Heren" on every type, matching the division (no "Gemengd"); teams may state a minimum diploma |
| D-020 | 2026-10-17 | Accepted | Only moderators resolve a rumour, as confirmed (with an official source), denied or expired (was O-001) |
| D-021 | 2026-10-17 | Accepted | Deleting an account deletes its zoekertjes                        |
| D-022 | 2026-10-17 | Accepted | Visitors reach a zoekertje's poster through messaging only; contact emails are never shown |
| D-023 | 2026-10-17 | Accepted | Datadog is removed; no session replay or third-party RUM          |
| D-024 | 2026-10-17 | Accepted | Zoekertjes expire on 31 August (at least 30 days after posting); the owner can renew |
| D-025 | 2026-10-17 | Accepted | Minimal, content-free email notifications for messages and moderation outcomes, with an opt-out |
| D-026 | 2026-10-17 | Accepted | A new message brings an archived conversation back to the inbox      |
| D-027 | 2026-10-17 | Accepted | French and English are a nice-to-have, not a launch blocker; built with next-intl, Dutch the default |
| D-028 | 2026-10-18 | Accepted | Waitlist emails are used for the launch email only, then wiped    |
| D-029 | 2026-10-18 | Accepted | Account deletion also deletes unpublished rumours; zoekertjes left ownerless by earlier deletions are deleted |
| D-030 | 2026-10-18 | Accepted | Stored zoekertje contact emails are deleted; ads online at the expiry rollout run until 31 August 2027 |
| D-031 | 2026-10-18 | Accepted | 16+ and terms are accepted per terms version; anyone without the current one is asked on /welkom |
| D-032 | 2026-10-18 | Accepted | Notification emails go through Resend over SMTP, one per run of unread messages, never while the recipient is chatting |
| D-033 | 2026-10-19 | Accepted | Removing a rumour also deletes the transfer made when it was confirmed |
| D-034 | 2026-10-19 | Superseded by D-053 | Production stays public while the site is in development; coming-soon goes back on before launch |
| D-035 | 2026-10-19 | Accepted | Every approved rumour has its own shareable page, but rumour pages are never indexed by search engines |
| D-036 | 2026-10-19 | Accepted | Pending rumours are reviewed within 24 h; takedowns, reports and contact messages within 72 h; standard Dutch replies in the admin area |
| D-037 | 2026-10-19 | Accepted | Moderation outcomes stay on screen; only takedown requesters and staff get an email |
| D-038 | 2026-10-19 | Accepted | The operator stays anonymous while the site is free; name and address go on the site the day anything is paid |
| D-039 | 2026-10-20 | Accepted | The takedown decision email carries a second status link; staff moderation emails ignore the profile opt-out |
| D-040 | 2026-10-20 | Accepted | Cache Components stay off; every page keeps rendering per request with real 404 and redirect status codes |
| D-041 | 2026-10-20 | Accepted | Production errors are recorded in our own database and alerted to info@volleyrumours.be; no error-tracking service |
| D-042 | 2026-10-20 | Accepted | Authors withdraw their own pending or lopend rumour and edit it only while pending; messages stay undeletable |
| D-043 | 2026-10-20 | Accepted | Every migration keeps the code on `main` working; the owner pushes it before its PR merges |
| D-044 | 2026-10-20 | Accepted | Supabase moves to Pro a week before launch for daily backups; no PITR |
| D-045 | 2026-10-21 | Accepted | No database load test; launch performance work goes into page speed in the browser |
| D-046 | 2026-10-21 | Accepted | The retention functions run every night with pg_cron inside the database, not from a Vercel cron route |
| D-047 | 2026-10-21 | Accepted | Rumour vote counts are live: `rumours` joins the Realtime publication, one channel per page |
| D-048 | 2026-10-21 | Accepted | Vercel functions run in Paris (`cdg1`), next to the database, not in the default Washington region |
| D-049 | 2026-10-22 | Accepted | Pages read the logged-in user from the verified JWT (`getClaims()`), without a call to Supabase Auth; server actions and staff checks keep `getUser()` |
| D-052 | 2026-10-23 | Accepted | A rumour needs one checkbox, "Ik volg de regels voor geruchten", instead of two declarations |
| D-053 | 2026-10-26 | Accepted | Production shows the coming-soon page from 2026-10-22 until launch; replaces D-034 |

---

## D-001 — One account type for launch

**Context.** Personas (player, coach, club representative, rumour contributor)
exist in the product, but the code has a single `profiles` row per user and no
roles. Introducing account types means onboarding branches, verification flows
and permission checks.

**Decision.** Keep one account type. A person's persona is expressed by what they
post (e.g. a "team zoekt speler" zoekertje). Club representatives and trusted
sources can receive a manually granted **verified badge** (`is_verified_source`
already exists).

**Consequences.**
- No club-specific permissions at launch (e.g. club reps cannot confirm their
  own club's transfers — see D-020).
- Anyone can post a "team zoekt …" ad on behalf of any club. Mitigated by
  moderation and reporting; revisit if impersonation reports appear.

## D-002 — Rumours are pre-moderated

**Context.** Rumours name real people. Wrong or malicious rumours carry
defamation and GDPR risk, and senior teams can include 16–17 year olds.

**Decision.** Every new rumour starts as **pending** and is invisible to the
public until a moderator approves it. Rejected rumours stay visible only to
their author, with the reason.

**Consequences.**
- Needs a moderator queue, an admin role (D-006) and author notifications.
- Throughput depends on moderator availability — critical during the transfer
  window. A "trusted contributor fast-track" can be considered later, and only
  on top of an accuracy-based reputation (D-005), never on popularity.
- Rumour lifecycle becomes: `pending → approved (lopend) → confirmed | denied |
  expired`, plus `pending → rejected` and `* → removed` (takedown).

## D-003 — Senior divisions only; 16+ confirmation at sign-up

**Decision.**
- Rumours and zoekertjes may only reference senior divisions (Liga, Nationale,
  Promo). No youth categories exist in the division list, and none will be
  added.
- Sign-up (email and Google) requires an explicit, unticked-by-default
  confirmation: *"Ik bevestig dat ik 16 jaar of ouder ben."* Google sign-ups
  must pass the same gate before their profile becomes active.

**Reasoning.** 16 is the GDPR age of digital consent in Belgium, so users 16+
can consent to processing themselves. A self-declaration is the proportionate
measure for a community site; it is not age verification.

**Residual risk.** 16–17 year olds do play in senior teams, so "senior division"
does not guarantee the named person is an adult. Mitigations: a contributor
declaration on the rumour form, moderator check during pre-moderation, and a
takedown path for the named person (journey J-12).

## D-004 — Messaging only for zoekertjes

**Decision.** Conversations can only be started from a zoekertje. The
"Contact <creator>" button on confirmed transfers is removed; the `transfer_talk`
conversation type is retired.

**Reasoning.** Classifieds are the core value and the reason two people need to
talk. Contacting whoever posted a transfer has no clear purpose, invites
harassment of sources, and is broken anyway (transfers created from rumours have
no `creator_id`).

## D-005 — Reputation as an accuracy track record

**Question from owner.** Do we want gamification (points, leaderboard, karma)?
Being an "official rumour platform" is not the goal, but a reputation signal
helps readers weigh a rumour.

**Assessment of the current mechanics.**
- **+1 trust per upvote** rewards popularity, not accuracy. It is trivially
  gamed with a second account and it pushes people to post spicy rumours.
- **+5 per confirmed rumour, nothing for denied ones** rewards volume: posting
  ten guesses costs nothing and one hit pays out.
- **"Evil / Corrupt / Heroic / Legendary" karma labels** sit on cards about real,
  named players. Even though they describe the vote ratio, a card reading
  "Evil" next to a person's name is a reputational problem for that person.
- **Leaderboard by points** turns the site into a race to be first, which is the
  opposite of what pre-moderation is trying to achieve.

**Proposal.** Keep a reputation signal, but make it describe *accuracy*:
1. A contributor's public **track record**: "12 van 15 geruchten bevestigd" —
   counted only on moderator-resolved rumours (confirmed vs denied). Expired and
   rejected rumours do not count towards accuracy but are visible to moderators.
2. Show the track record next to the author on each rumour, together with a
   neutral community signal: "63% van de stemmers denkt dat dit klopt". No
   good/evil wording.
3. Votes remain a community belief signal. They **do not** award points.
4. The leaderboard becomes "Betrouwbare bronnen": ranked by accuracy with a
   minimum of 5 resolved rumours, so one lucky guess doesn't top the list.
5. Moderators see the track record in the pre-moderation queue; it informs, but
   does not replace, their judgement.

**Why this fits the "not an official platform" concern.** We never claim a
rumour is true; we show how often a *contributor* has been right in the past.
That is the same heuristic readers already apply informally, made explicit.

**Accepted by the owner on 2026-10-17** (#47), as proposed. Hybrid (the track
record public, points kept internally) and keeping the points were
considered and turned down.

**Consequences.**
- The trust points (`trust_score`, `total_votes_received`) and the karma
  labels go. #78 already moved the count into the database and stopped
  withdrawn votes from changing a tally; #88 removes the points and builds the
  track record and "Betrouwbare bronnen".
- Expired rumours ("Niet bevestigd") are neutral (owner, 2026-10-17): the
  track record counts confirmed against denied only, as in point 1.
- Resolution is moderator-only (D-020), so a track record can't be moved by
  votes or by the contributor.

**Built in #88** (2026-10-17). The database keeps the track record
(`profiles.rumours_confirmed` and `rumours_denied`, recounted by a trigger
on rumours) and lists "Betrouwbare bronnen" (`trusted_sources()`, at least 5
resolved, ranked by accuracy, then by how many were resolved). The points
columns, `xp`/`level` and the karma labels are gone; `/leaderboard` redirects
to `/betrouwbare-bronnen`. A rumour removed after a takedown or report no
longer counts, and removing a confirmed rumour's transfer undoes the
confirmation (#70).

## D-006 — Admin role for moderation

**Context.** D-001 keeps one *user* account type, but pre-moderation (D-002)
requires people who can approve, reject, remove and sanction.

**Decision.** Add a separate staff role (e.g. `profiles.role in ('user',
'moderator', 'admin')` or a `staff` table), enforced in RLS and server actions.
This does not change the user-facing account type.

## D-007 — npm is the package manager

**Context.** Both `package-lock.json` and `pnpm-lock.yaml` are committed. The
npm lockfile is the maintained one (updated 2026-03-13 with `package.json`,
contains the Datadog packages); the pnpm lockfile is an untouched v0 artefact
from 2026-01-23. Local `node_modules` was installed by npm, and the old agent
instructions also mandate npm.

**Decision.** Use npm (`npm ci` in CI). Delete `pnpm-lock.yaml` and add a
`packageManager` field to `package.json` so tools and Vercel agree.

**Why not switch to pnpm?** There's no concrete benefit for a single-app repo
of this size, and switching means regenerating the lockfile, which changes
the resolved dependency tree in the middle of a stabilisation effort.

**Update (2026-10-22, #223).** The `packageManager` field didn't reach
Vercel: the project, created from v0, overrode the commands with `bun install`
and `bun run build`. Bun converted the npm lockfile on every build, skipped
the nested `overrides` and blocked a postinstall script. `vercel.json` now
sets `npm ci` and `npm run build`, like CI, and overrides the dashboard.
Newer npm (12) runs a dependency's install scripts only when `allowScripts`
in `package.json` allows them. The only one we have is `unrs-resolver`'s
(ESLint's import resolver), which downloads its native binding if the
optional dependency is missing; `npm ci` installs that dependency, so the
script is denied.

## D-008 — Branching: protected `main` is production

**Context.** Vercel deploys `main` to volleyrumours.be on every push, and
`main` had no branch protection. Coming-soon mode only hides the homepage
(X-11), so every merge is effectively public. Development is done by one
person plus AI agents. Preview deployments use the production Supabase project.

**Decision.** GitHub Flow. Short-lived `<type>/<issue>-<slug>` branches
(`feature`, `fix`, `chore`, `docs`) from `main`; every change lands through a PR
with CI green, the Definition of Done ticked and the Vercel preview checked;
squash merge; branch deleted after merge. `main` is protected: PR required,
`checks` status required, branch up to date, linear history, no force-push or
deletion, enforced for admins. Rollback is Vercel Instant Rollback, then a fix
or revert through a PR. Details in `CLAUDE.md`.

**Why not a `develop`/staging branch?** It doubles every merge and drifts from
`main`, and a staging site that writes to the production database gives false
safety. The real gap is the database; a separate preview project was
considered and declined (D-010). Revisit a staging branch if batched
releases or a fixed staging URL for moderators become necessary.

## D-009 — Coming-soon mode closes every route

**Context.** `NEXT_PUBLIC_COMING_SOON` only replaced the homepage (X-11), so
every other page — posting rumours and zoekertjes, sign-up, messaging — was
live in production for anyone with the URL.

**Decision.** While the flag is `"true"`, the proxy lets through only `/`,
`/privacy`, `/voorwaarden`, `/over-ons` and `/contact` (the pages the
coming-soon page links to). `/auth/callback` is outside the proxy and unaffected.
Every other route gets a temporary (307) redirect to `/`, so visitors land on
the waitlist. The header and footer hide links to closed pages. There is **no
bypass** on production: the full site is reviewed locally or on Vercel
previews, where the flag is off. The open list lives in `lib/coming-soon.ts`.

**Why no bypass?** A secret link leaks, and an admin-only bypass needs login to
stay open plus a database lookup on every request. Neither is worth it before
launch.

**Limit.** This closes the website, not the Supabase API: with the public anon
key, someone can still call Supabase Auth sign-up directly. Disabling sign-ups
in the Supabase Auth settings until launch closes that gap (owner, dashboard).

## D-010 — Previews keep using the production database

**Context.** Vercel preview deployments use the production Supabase project
(D-008). The plan was a separate non-production project for previews in M1
(step 1.7): its own database built from `supabase/migrations/`, preview env
vars, auth redirect URLs.

**Decision.** No separate preview project. The owner accepts the risk for a
project of this size: one developer plus AI agents, a handful of real accounts,
and a second project to keep migrated and configured is overhead with little
return before launch.

**How the risk is contained.**
- Previews are for **looking**, not writing: no test data, no destructive
  flows (deleting ads, accounts, conversations), no migrations from a preview.
- Anything that writes data is tested locally against the Supabase stack in
  Docker (`npm run db:start`, seeded from `supabase/seed.sql`).
- Playwright (step 1.4) runs against that local stack, in CI and on laptops —
  never against a preview URL.
- Until launch, sign-ups are disabled in Supabase Auth, so a preview can't
  create accounts either.

**Revisit when** a second developer joins, moderators need a place to practise,
or end-to-end tests need a deployed environment.

## D-011 — Staff audit log retention: 2 years

**Context.** Every staff action (approve, reject, remove, resolve, suspend,
role change) is logged with who, what, when, target and reason (#64). Entries
hold user ids of staff and of the people or content they acted on, so GDPR
needs a retention period.

**Decision.** Keep entries 2 years, then delete them. Until then nobody can
edit or delete an entry, the service role included.
`public.purge_expired_staff_actions()` is the only delete path, and only for
expired rows.

**Why 2 years.** Long enough to back up a moderation decision when a dispute,
takedown or complaint comes back a season or two later; short enough to
justify as a legitimate interest.

**Consequences.** The purge runs every night since #202 (D-046); the first
entries expire in October 2028. The privacy page should mention the log and its retention
when it's updated (#77).

## D-012 — Moderation queue: who moderates and what they see

**Context.** The moderation queue (#66) needs two answers the policy left
open: may a moderator decide on their own rumour, and what does the queue show
about the author while the track record (D-005, #88) isn't built?

**Decision.**
- **Moderators may approve or reject their own rumours.** The audit log
  records who decided (#64), so it stays traceable. This works with a single
  moderator.
- **The queue shows the author's username only** until #88 brings the track
  record. No vote-based trust score, since D-005 isn't signed off. Since #88
  the queue shows the track record next to the username.
- **Rejection reasons are a fixed list** (Moderation Policy), stored as a code
  with an optional note; "Andere" requires the note. The author sees the
  reason and note on their profile. The audit log keeps the reason as the
  author read it.

**Consequences.** Revisit self-moderation when there are more moderators. The
queue gets the source field with #67 and the track record with #88.

## D-013 — Rumour sources and the pending cap

**Context.** J-09 asks for a source on every rumour, a good-faith and
senior-person declaration, and a cap on how many rumours one contributor can
have waiting (#54, #67).

**Decision.**
- **Source types are a fixed list of four**: "Eigen waarneming", "Speler of
  trainer zelf", "Club", "Media (krant, website, sociale media)". A source
  type is required; a link (http or https) is optional.
- **The source is public**: the rumour card shows "Bron: …", the detail view
  links to the URL. Moderators see both in the queue.
- **Two required declarations**: the rumour is about a senior player or
  trainer (D-003), and it is shared in good faith. Both are stored per rumour.
  Since D-052 one checkbox covers both.
- **At most 5 rumours waiting per contributor.** The database refuses a sixth
  until a moderator has handled one. The cap applies to staff too.
- Rumours from before this change keep no source; they stay visible and can
  still be voted on and moderated.

**Consequences.** Source links are user content: they open in a new tab with
`rel="nofollow ugc noopener noreferrer"`. Revisit the cap if active
contributors hit it during the transfer window.

## D-014 — Takedown requests

**Context.** J-12: the person a rumour is about (or their parent or
representative) must be able to ask for its removal without an account (#68).
Open questions were whether the rumour is hidden at once (#48, Q5), how the
requester hears back when the site sends no email yet (#53), bot protection,
and how long requests are kept.

**Decision** (owner, 2026-10-14).
- **The rumour stays visible until a moderator decides.** No automatic hiding:
  a request can't be used to suppress a true rumour. The moderator removes the
  rumour (default for a valid request) or rejects the request with a note.
- **Status link, no email.** The requester gets a reference (e.g. VR-7K3M9Q)
  and a private status link that shows the decision and the moderator's note.
  Staff see the email and can reply by hand. Automatic email comes with #53.
- **Bot protection without a third party:** a honeypot field and daily limits
  of 5 requests per IP address and 3 per email. The IP is stored only as an
  HMAC with a key that changes daily.
- **Retention: 12 months.** Name, email, explanation and IP hash are wiped 12
  months after the request; the reference, rumour and decision stay. The audit
  log keeps its own 2 years (D-011).
- The rumour's author sees "Verwijderd", not who asked.

**Consequences.** Because nothing is hidden automatically, response time
matters: set a review target with the moderator rota (#93). The anonymise
function runs every night since #202 (D-046). Copy is reviewed in #94.

## D-015 — User reports

**Context.** J-15, J-07, J-02: logged-in users must be able to report a
rumour, a zoekertje or a conversation, and moderators handle every report in
one inbox (#69, #79, #87). Open questions were the reasons offered, how the
reporter hears the outcome without email (#53), what a moderator can do with a
reported conversation, and whether reports hide content automatically.

**Decision** (owner, 2026-10-14).
- **Two fixed reason lists**, each ending in "Andere", which needs an
  explanation. Rumour or zoekertje: Onjuist of misleidend · Beledigend of
  haatdragend · Privé-informatie · Spam of oplichting · Mogelijk over een
  minderjarige · Andere. Conversation: Intimidatie of ongewenst gedrag ·
  Beledigend · Spam of oplichting · Ongepaste inhoud · Andere.
- **The reporter gets a confirmation only.** Outcomes are stored, so email
  (#53) can report them later.
- **A conversation report closes with an outcome**: "Geen actie" or
  "Maatregel genomen" with a note. Messages are never deleted; warnings and
  suspensions come with #80.
- **Reported content stays visible until a moderator decides**, as with
  takedowns (D-014): reporting can't be used to suppress content.

**Also decided while building** (agent calls, following D-014): one open
report per user per item; at most 10 reports per user per day; no reporting
your own content. A decision answers every open report about the same item,
and removing a rumour also answers open takedown requests about it. Staff
read a reported conversation only while its report is open, and every read is
logged. The author of removed content sees "Verwijderd" and the moderator's
optional note on their profile, not who reported it.

**Consequences.** As with takedowns, response time matters (#93). Blocking
in the same step (#87) writes the block, and the conversation page then hides
the chat for both, but sending isn't blocked server-side until #73.

## D-016 — Sanctions: suspensions, badge and moderator role

**Context.** J-15 and #80: staff must be able to suspend abusive accounts
(read-only, with a reason the user sees), grant and revoke the verified badge
(D-001) and the moderator role (D-006), without touching the database. Open
questions were who may do each, how long a suspension can last, and what a
suspended user may still do.

**Decision** (owner, 2026-10-14).
- **Admins only** suspend users, lift suspensions, grant or revoke the
  verified badge and change the moderator role. Moderators see users, their
  role, badge and suspension in `/admin/gebruikers`, but change nothing.
- **A suspension lasts until a date, or indefinitely** until an admin lifts
  it. The admin picks 7 days, 30 days, a date or "Onbepaalde tijd".
- **A suspended user can log in and read.** They can't post rumours or
  zoekertjes, edit zoekertjes, vote, start conversations, send messages or
  edit their profile. They can still report, block, delete their own
  zoekertjes and delete their account. Their existing content stays up unless
  it is removed separately.

**Also decided while building** (agent calls). The user sees the end date
and the reason on every page, with a link to the contact page. Staff can't
be suspended: take the moderator role away first. Admins can't change their
own role or suspension, and the admin role itself is set by the owner in SQL,
never through the site. A suspended user can't be made a moderator.
Suspending someone who is already suspended replaces the end date and reason.
Every change is logged; lifting and badge or role changes take an optional
note. The database refuses a suspended user's writes (SQLSTATE `VR005`), so
no page or action can forget the check.

**Consequences.** Deleting the account also deletes the suspension (the log
keeps the history), so a suspended user can delete their account and sign up
again with the same email address. Revisit if that happens. The suspended
user is not emailed (#53); they see the notice the next time they visit.

## D-017 — Contact messages

**Context.** #81: the contact form showed "Bedankt" but only logged the
submission on the server, so nobody received it. This happened on
production, where the contact page is open in coming-soon mode. The
suspension notice (D-016) and the privacy page ("Contacteer ons voor een
kopie van je gegevens") both send people there. Open questions were where
staff read the messages, how long they are kept and what the form's subjects
should be.

**Decision** (owner, 2026-10-15).
- **Own page, all staff.** Messages are handled at `/admin/contact`, next to
  Meldingen, by moderators and admins alike. Partnership and privacy
  questions stay apart from abuse reports.
- **Kept 12 months after handling.** Name, email, message, account link,
  internal note and IP hash are wiped 12 months after a staff member marks
  the message handled. Open messages are never wiped.
- **New subjects, abuse elsewhere.** "Vraag of feedback", "Mijn account of
  schorsing", "Privacy en mijn gegevens", "Samenwerking of pers", "Iets
  anders". "Rapporteer Misbruik" is gone: the page points to "Melden" on the
  content (J-15) and to the takedown form (J-12).

**Also decided while building** (agent calls, following D-014). No login is
needed. Bot protection is the same as for takedowns: a honeypot, and at most 5
messages per IP and 3 per email per day. For a logged-in sender, the
account is stored from the session, so staff can see who appeals a
suspension, and the email field is filled in. Suspended users can still send
messages: it is how they appeal (D-016). Staff answer by email, by hand,
then mark the message "Afgehandeld" with an optional internal note the
sender never sees; that is logged as "Contactbericht afgehandeld". There is
no reference or status link: the answer comes by email. In coming-soon mode
the pointer to "Melden" and the takedown form is hidden, because neither is
reachable then.

**Consequences.** Messages are not forwarded by email; staff have to look at
`/admin/contact`. Automatic notification comes with #53. The anonymisation
function runs every night since #202 (D-046), with the takedown one.

## D-018 — Blocking

**Context.** #73: `blockUser` existed without a UI, and nothing stopped a
blocked user from writing. The only check sat in `createConversation` and
could never fire, because RLS shows a block only to the user who made it.
J-07 already says what a block does; these are the calls made while building
it (agent calls, following D-014 and D-017).

**Decision** (2026-10-15).
- **The database enforces it.** A trigger on `messages` and `conversations`
  refuses inserts between two users when either one blocked the other
  (SQLSTATE `VR008`). No server action or API call can skip it.
- **Both directions.** The blocker can't message the blocked user either.
  Unblocking lifts it for both.
- **History stays.** Earlier messages stay readable for both users; only the
  message box is replaced by a notice. Reports can still quote them (D-015).
- **The blocked user sees a neutral notice.** "Je kan deze gebruiker geen
  berichten sturen", without saying who blocked whom, and gets no message
  when they're blocked. The blocker sees "Je hebt … geblokkeerd" with
  "Deblokkeren".
- **Messaging only.** A block doesn't hide the other user's zoekertjes,
  rumours or profile.
- **Not a moderation step.** Blocking isn't logged and staff don't see blocks.
  Suspended users may still block and unblock (D-016).
- **Confirm, then block.** "Blokkeren" in the conversation asks first; the
  "Melden" dialog can still block in the same step (#87). Unblocking is one
  click, from the profile page ("Geblokkeerde gebruikers") or the
  conversation.

**Consequences.** `blocked_users` is no longer readable or writable by
visitors, and a block can't be edited, only lifted. A blocked user can tell
they were blocked, as J-07 accepts.

## D-019 — Zoekertje gender and diploma

**Context.** #71: the create form asked for gender ("Geslacht" or
"Dames/Heren", with Heren/Dames/Gemengd) but never stored it, and kept the
trainer diploma in `position`. "Team zoekt trainer" had no diploma field,
although J-08 lets a team state one. Owner's calls, 2026-10-15.

**Decision** (2026-10-15).
- **"Dames/Heren" on every type, and it must match the division.** Every senior
  division is either heren or dames (D-003), so there is no "Gemengd". The
  form only offers the divisions of the chosen gender; the server and the
  database refuse a mismatch.
- **Teams may state a minimum diploma; trainers must state theirs.** "Minimaal
  diploma (optioneel)" on "team zoekt trainer", "Diploma" (required) on
  "trainer zoekt team". Both go in their own `trainer_diploma` column.

**Consequences.** New ads use senior divisions only, checked in the database
too. Older ads keep whatever they hold; their trainer diploma moved out of
`position`. J-08 no longer mentions "gemengd".

## D-020 — Only moderators resolve a rumour (was O-001)

**Question.** Who turns an approved rumour into a confirmed transfer, and who
marks it denied? (#46)

**Options considered.**
- **A. Moderators only**, requiring an official source URL (club, federation,
  press) for confirmation. Simplest; reuses the moderator role from D-006.
- **B. Moderators plus verified club representatives** for transfers involving
  their own club. Faster and more authoritative, but needs club-level
  verification, which D-001 deliberately avoids for launch.
- **C. Community threshold** (e.g. X% belief from Y voters). Rejected —
  popularity is not evidence and it is easy to manipulate.

**Related sub-question.** Rumours that are neither confirmed nor denied when the
transfer window closes: mark them **expired** ("Niet bevestigd") rather than
denied, so contributors are not penalised for unresolved rumours.

**Decision** (owner, 2026-10-17): **A, moderators only.**
- Staff (D-006) resolve a lopend rumour as **confirmed**, **denied** or
  **expired** ("Niet bevestigd"). Confirming needs an official source URL
  (club, federation or press). Every resolution is a staff action with an
  audit log entry (D-011), checked in the database.
- At the end of a transfer window, staff can mark all open rumours expired at
  once (#70).
- Expired rumours are neutral in the track record (D-005).
- B (verified club representatives) can be revisited after launch; it needs
  club-level verification, which D-001 leaves out.

**Consequences.** Unblocks #70 (resolution) and, with D-005, #88 (track
record). Voting already closes on resolved rumours (#78).

## D-021 — Deleting an account deletes its zoekertjes

**Context.** On account deletion (J-11), zoekertjes were kept and anonymised,
but titles and descriptions often contain the poster's real name, and free
text can't be scrubbed reliably (#49).

**Decision** (owner, 2026-10-17). **Delete them.** When an account is
deleted, its zoekertjes are deleted too.

**Consequences.** No personal data is left behind in ads. Conversations about
a deleted ad stay and show "Verwijderd zoekertje", as they already do when an
owner deletes an ad (#72). #76 implements this as part of making deletion
complete.

## D-022 — Messaging is the only way to reach a zoekertje's poster

**Context.** Every zoekertje's contact email was readable by anyone through
the API, also on inactive ads, so it could be scraped (R-7, #50).

**Decision** (owner, 2026-10-17). **Messaging only.** Other users and visitors
never see a poster's email address; they contact the poster through in-app
messaging (D-004), which has blocking (D-018) and reports (D-015). Revealing
the email after login was considered and turned down, because any account
could still harvest it.

**Consequences.** Contacting a poster needs an account. #83 closes the
column(s) to other users. Because there's no email fallback, posters depend
on noticing new messages, which D-025 covers.

## D-023 — Datadog is removed

**Context.** Datadog RUM recorded 20% of production sessions on replay,
including private chats, and the privacy page didn't mention it (X-7, #51).

**Decision** (owner, 2026-10-17). **Remove Datadog entirely**: no session
replay and no third-party RUM. Turning replay off and keeping RUM, or keeping
replay with masking, were considered.

**Consequences.** One processor fewer on the privacy page (#77). Production
errors are only visible through Vercel's logs and analytics. Removing the
provider, the packages and the test workarounds that block `datadoghq.eu` is
its own chore.

## D-024 — Zoekertjes expire at the end of the season

**Context.** J-01 and J-04 assume zoekertjes expire, so the list doesn't fill
up with stale ads (#52).

**Decision** (owner, 2026-10-17).
- **An ad expires on the next 31 August**, the end of the volleyball season.
- **It always runs at least 30 days** (agent call): an ad posted after
  1 August runs 30 days, so a summer ad doesn't expire within days.
- **The owner can renew** an expired ad, which sets a new expiry date by the
  same rule.

**Consequences.** #84 adds the expiry date, hides expired ads from the list
and search, and lets the owner renew from "Mijn zoekertjes". A fixed 90 days,
the earlier of both, and no expiry were considered.

## D-025 — Minimal email notifications

**Context.** No email was sent anywhere. With contact through messaging only
(D-022), a poster who isn't on the site would miss replies (#53).

**Decision** (owner, 2026-10-17). **Yes, minimal and content-free.**
- Emails for a new conversation or message ("Je hebt een nieuw bericht" with a
  link) and for a rumour's approval or rejection. Never the message text.
- Users can turn notifications off on their profile.
- Dutch templates.

**Consequences.** Adds an email provider, a new processor on the privacy page
(#77); which one is picked in #98. #98 builds the notifications.

## D-026 — A new message unarchives a conversation

**Context.** #91 made archiving per user and, as an agent call, brought an
archived conversation back to the inbox when a new message arrives (the
`unarchive_for_recipient` trigger). The owner asked for a recommendation
(Q14).

**Decision** (2026-10-17). **Keep it.** Archiving tidies the inbox; it isn't
a mute. Missing a reply about an ad costs more than a conversation coming
back, and users who don't want to hear from someone block them (D-018), which
stops the messages altogether.

**Consequences.** None; this is how #91 already works.

## D-027 — French and English, the simple way

**Context.** The competitor offers French (#55). The site is Dutch only, with
the copy hard-coded in components. The owner sees French, and maybe English,
as a nice-to-have and asked for the easiest common approach (2026-10-17).

**Decision.**
- **Nice-to-have, not a launch blocker.** Launch can go ahead in Dutch only.
- **next-intl, the usual library for the Next.js App Router.** UI strings move
  into one message file per language (`messages/nl.json`, `fr.json`,
  `en.json`); components read them with `useTranslations`/
  `getTranslations`. Dutch is the default and the fallback for a missing
  string.
- **First without language URLs** (agent call): the language comes from a
  language switch (stored in a cookie), or else from the browser's language,
  else Dutch. This leaves the routes and the coming-soon gate alone. Most
  multilingual sites use `/fr/...` paths so search engines index each
  language; next-intl can add that later without touching the strings.
- **Only the interface is translated.** Rumours, zoekertjes and messages stay
  in the language they were written in. Moderators judge French and English
  content too (D-002).
- Legal pages, emails (D-025) and validation messages are translated before a
  language is switched on.

**Consequences.** Extracting the Dutch strings comes first and is useful on
its own: it finds the English strings that leak into the UI (#90). Then
French and English are added as translations: #143 and #144 in M3.


## D-028 — Waitlist emails are wiped after the launch email

**Context.** The coming-soon homepage collects email addresses in
`waitlist_subscribers`, live in production, but the privacy page didn't
mention the waitlist and nothing said how long the addresses are kept (#77).

**Decision** (owner, 2026-10-18). **The waitlist is used for the launch email
only.** Once that email has gone out (#95), the list is deleted. Keeping it
until people unsubscribe, or for a fixed period after launch, were considered.

**Consequences.** The privacy page says so. Sending the launch email and
wiping the list are one task in #95; later announcements need people to opt
in again, for example through the notification settings (D-025).

## D-029 — Account deletion also deletes unpublished rumours and old orphaned zoekertjes

**Context.** Making account deletion all-or-nothing (#76) raised two cases
D-021 didn't cover. Accounts deleted before D-021 left their zoekertjes online
without an owner, often with the poster's name in the title. And a deleted
account's pending and rejected rumours were kept without an author, so a
pending one stayed in the moderation queue with nobody behind it.

**Decision** (owner, 2026-10-18).
- **Ownerless zoekertjes are deleted** by the #76 migration, in production
  too; from then on every zoekertje has an owner (`user_id` NOT NULL).
- **Rumours that never went public (pending, rejected) are deleted** with the
  account. Published ones (lopend, confirmed, denied, not confirmed, removed)
  stay without an author, as before.

**Consequences.** Conversations about a deleted zoekertje stay and show
"Verwijderd zoekertje"; reports about it go with it, while the staff log keeps
what moderators did. Rumours now outlive their author even when a user is
deleted outside the site (the foreign key is `ON DELETE SET NULL`). The privacy
page and the delete dialog say what goes and what stays.

## D-030 — Old contact emails are deleted; existing ads start a fresh season

**Context.** Applying D-022 and D-024 (#83, #84) left two questions about data
already in production. Zoekertjes posted before #71 still store the poster's
contact email, which nothing reads any more. And by the D-024 rule, every ad
posted before 1 September 2026 would count as expired the moment the expiry
date is added.

**Decision** (owner, 2026-10-18).
- **The contact emails are deleted**: the migration drops the
  `contact_email` column, so the stored addresses are gone for good. Hiding
  the column and keeping the data was considered.
- **Ads online at the rollout count as posted that day**: they run until
  31 August 2027. Applying the rule from each ad's posting date, which would
  hide older ads at once, was considered.

**Consequences.** Nobody, owners included, can see an old contact email, and
there's nothing left to leak. No ad disappears at launch; stale ads leave the
list when their posters mark them gevonden or delete them, or at the end of
the season.

## D-031 — The age and terms gate asks per terms version

**Context.** D-003 asks for a 16+ confirmation at sign-up and the same gate for
Google sign-ups. #75 adds the terms, the stored timestamp and version, and asks
existing accounts once.

**Decision** (agent call in #75, 2026-10-18; confirmed by the owner 2026-10-18: declaration only, a new version asks everyone again, wording left to the legal review #94).
- **One acceptance covers both**: the 16+ confirmation and the terms are two
  required checkboxes on one form, stored as one row per user and terms
  version, with the time.
- **The database owns the version** (`current_terms_version()`, the date on
  `/voorwaarden`). A new version is a migration, and asks everyone again on
  their next visit. The terms page says so, instead of "continued use means
  acceptance".
- **The gate is in the proxy, for every logged-in user**: without an
  acceptance of the current version, every page except the info pages, the
  auth pages and the takedown form sends them to `/welkom`, then back. That
  covers Google sign-ups and accounts from before #75 alike.
- **It is a declaration, not a security boundary**: the database doesn't
  refuse writes without an acceptance, and a failed check lets the request
  through. Someone who skips the form through the raw API has still not
  declared anything, and is asked on their first visit.

**Consequences.** Every existing production account is asked once after
launch. Coming-soon mode closes `/welkom` with the other routes, so the gate
waits for the launch. Changing the terms text without a new version doesn't
ask anyone again.

## D-032 — How notification emails are sent

**Context.** D-025 accepted minimal emails and left the provider and the
details to #98: "an offline recipient" needs a working definition, and the
emails need a sender.

**Decision** (agent calls in #98, flagged in the PR for the owner).
- **Resend, over SMTP.** Resend already sends the auth emails and is on the
  privacy page. SMTP (nodemailer) lets the local stack and CI send the same
  emails to Mailpit, so the tests read real emails. Production needs the
  `SMTP_*` and `EMAIL_FROM` variables in Vercel and a verified sending domain.
- **"Not online" means not active in that conversation.** The database
  (`message_notification_email()`) emails the recipient of a new message only
  when they have no other unread message in the conversation and didn't send
  or read a message there in the last 10 minutes. So one email covers a run of
  unread messages, and two people chatting live get none.
- **Content-free.** Message emails say only "Je hebt een nieuw bericht" with a
  link; rumour emails say approved or not published, without the rumour or the
  reason (that is on the profile). No sender names.
- **On by default, off on the profile.** A row in `email_opt_outs` turns all
  notification emails off. Suspended users may still change it.
- **Sent after the response** (`after()`): a slow or failing email never
  slows down or fails sending a message or a moderation decision.

**Consequences.** Takedown requesters (no account, D-014) and reporters
(D-015) still get no email; J-12 and J-15 keep their status links and
confirmations. A message to a recipient whose browser is open on another page
still sends an email: the site doesn't track presence.

## D-033 — Removing a rumour deletes its transfer

**Context.** Confirming a rumour makes a transfer (`transfers.source_rumour_id`,
D-020). When the rumour was later removed after a takedown request (D-014) or a
report (D-015), the transfer stayed on `/transfers` and the homepage (#151). A
takedown usually means the person asked to be taken off the site, so their name
stayed public.

**Decision** (owner, 2026-10-19). Removing a rumour always deletes its
transfer, in the same database function and transaction, also when the
transfer had an official source. The deletion is logged as its own "Transfer
verwijderd" entry with the transfer as it was. If the transfer is public fact
and only the rumour was the problem, staff add it again by hand on
`/admin/transfers`.

**Consequences.** The simple rule keeps the takedown promise without a
judgement call per removal. Transfers of rumours removed before the change are
deleted by the migration, without a log entry (the log needs a staff member as
actor).

## D-034 — Production stays public during development

**Context.** On 2026-10-19 `NEXT_PUBLIC_COMING_SOON` turned out not to be set
for Production in Vercel, so volleyrumours.be served the full site instead of
the coming-soon page (D-009).

**Decision** (owner, 2026-10-19). That is intended for now: the owner follows
progress on production, and there are no users yet. Coming-soon mode (D-009)
goes back on when development is done, and stays on until launch (#95).

**Consequences.** Supabase sign-ups are disabled in the dashboard until launch
(D-009), so nobody can create an account on production in the meantime.
Anything merged is visible on volleyrumours.be straight away.

**Superseded** by D-053 (2026-10-26): coming-soon mode went back on in
production on 2026-10-22.

## D-035 — Rumour pages can be shared, not found through search engines

**Context.** Rumours only opened in a pop-up, so a shared rumour linked to
`/geruchten` and showed no preview (#99). A page per rumour fixes sharing, but
an indexed page would put a player's name in search results next to an
unconfirmed rumour, and a removed rumour can linger in a search engine's cache
after a takedown (D-014).

**Decision** (owner, 2026-10-19). Every approved rumour gets its own page,
`/geruchten/<id>`, with a share image. Pending, rejected and removed rumours
return 404, for their author too. Rumour pages carry `noindex` and are left
out of the sitemap. Lists, zoekertjes, transfers and info pages are indexed.

**Consequences.** Share links show the player, the move and the status, never
the author. Search engines may still crawl a rumour page (robots.txt allows
it), so they see the `noindex`. Indexing confirmed rumours later is a new
decision.

## D-036 — Moderation response times, rota and standard replies

**Context.** The transfer window brings the most rumours, reports and takedown
requests (#93). Takedowns are reviewed before anything is hidden (D-014), so
the time to a decision matters, and moderators wrote every note from scratch.

**Decision** (owner, 2026-10-19). Pending rumours are reviewed within 24 h;
takedown requests, reports and contact messages are decided within 72 h. Until
launch the owner is the only moderator. Standard Dutch replies are built into
the admin area: a "Sjabloon invoegen" picker on every note the author,
requester or suspended user reads, and on the internal report notes. A
template's [placeholder] must be replaced before the note can be sent.

**Consequences.** The handbook (`docs/product/moderation.md`) holds the rota,
targets and onboarding. A second moderator is still needed before launch
(readiness checklist). Template wording changes go through a PR, like any copy.

## D-037 — Which moderation events send an email

**Context.** J-15 was the last journey not at WORKS, only because moderation
outcomes weren't emailed (#53). Each outcome is already shown where the person
looks: the author sees "Verwijderd" and the moderator's note on their profile,
the takedown requester has the private status link (D-014), the reporter gets a
confirmation (D-015) and a suspended user sees the notice on every page
(D-016). The owner is the only moderator (D-036) and only sees new items by
opening the admin area.

**Decision** (owner, 2026-10-19). Removals, report decisions and suspensions
stay on screen, without email. A takedown requester does get one content-free
email with their status link once a moderator decides: the Digital Services
Act (art. 16(5)) says whoever files a notice is notified of the decision and
how to contest it, and we already have their address. Staff get an email for
every new takedown request, report and contact message. Both emails are #181.

**Consequences.** J-15 is WORKS and Phase 2 is closed; the emails come with #181
in M3. Whether on-screen outcomes are enough for reporters and authors is on
the list for the legal review (#94). Outcome emails are a
new decision if users miss them after launch.

## D-038 — The operator stays anonymous while the site is free

**Context.** The legal review (#94) found that neither the terms nor the
privacy page say who runs the site. The GDPR asks for the controller's
identity and contact details; Belgian law (WER art. XII.6) asks providers of
services "normally provided for remuneration" for a name and geographic
address.

**Decision** (owner, 2026-10-19). The owner runs VolleyRumours as a private
person and stays anonymous for now: the pages name "het VolleyRumours-team"
with `info@volleyrumours.be` and the contact form (`lib/legal.ts`). The site is
free and non-commercial, and comparable Belgian volleyball sites don't name
their operator either.

**Consequences.** The contact address must be read. A court or the
Gegevensbeschermingsautoriteit can still find the operator through DNS
Belgium or the host. **The day anything is paid** (featured zoekertjes, ads),
the operator's name and address go on the terms and privacy page first. A
lawyer reviewing the texts (#94) is asked whether this holds.

## D-039 — How the moderation emails work

**Context.** D-037 promised a takedown requester one email with their status
link, and staff an email for every new item. Building it (#181) showed the
status link can't be sent again: the database keeps only a hash of its token
(D-014). The profile has one switch for email notifications (D-032), and it
wasn't said whether it applies to staff.

**Decision.**
- **A second link** (owner, 2026-10-20). When a moderator decides, the
  database gives the request a second private token and the email carries
  that link; the link from the form keeps working. Both open the same status
  page. The email names the reference, not the outcome or the note.
- **Every decision path emails.** Removing a reported rumour also decides its
  open takedown requests, so the app claims every decided request that hasn't
  been emailed after each such action (`claim_takedown_decision_emails()`).
  Each is claimed once; a failed email isn't retried, since the first link
  still works. Requests decided before #181 aren't emailed.
- **Staff can't turn moderation emails off** (agent call, flagged in the PR).
  The profile switch is for a user's own notifications; handling the inboxes
  within 72 hours is the moderator's job (D-036). A moderator who no longer
  wants them gives up the role.

**Consequences.** The status page accepts either token. DSA art. 16(5) is met
for takedown requests; reporters still get a confirmation only (D-015).

## D-040 — Cache Components stay off

**Context.** Every page renders per request, because the header in the root
layout reads the login cookie (X-9). #96 cached the data behind the busy pages
but left the info pages (`/privacy`, `/voorwaarden`, `/over-ons`) dynamic: only
Next 16's Cache Components (partial prerendering) could serve them static
(#167). A trial build in #96 showed the cost: every route that reads cookies or
`searchParams` needs a Suspense boundary or `loading.tsx`; `export const
dynamic` and `revalidate` are no longer allowed; and once the shell streams
first, `notFound()` and `redirect()` inside a page answer 200 and redirect in
the browser.

**Decision** (owner, 2026-10-20). Cache Components stay off. The gain is small:
the info pages already fetch no data, and the proxy still checks the session
with Supabase Auth on every request, static page or not. A static info page
would only save rendering its text. The cost touches every route, and the
Dutch 404s (#90), the `/admin` 404 gate (#63) and the login redirects would
lose their status codes.

**Consequences.** All pages stay dynamic; public data stays cached through the
cookie-less client (#96). Revisit when Next keeps real status codes for
`notFound()` and `redirect()` in streamed pages, or when measurements after
launch show slow info pages. Load testing goes on in #97.

## D-041 — Errors are monitored without a new service

**Context.** Since Datadog went (D-023), production errors were only visible
in Vercel's logs, and nobody reads those during launch week (#186). Error
reports carry routes and messages, so a service like Sentry would be a new
processor on the privacy page. Vercel's own alerts need a paid plan and miss
browser errors.

**Decision** (owner, 2026-10-20).
- **Errors are recorded in our own database** (`error_events`): server errors
  through Next's `onRequestError` hook, browser errors from the error pages.
  One row per distinct error, with a count and first/last seen; the route
  pattern is stored, never the URL, and no account, IP address or request
  body. Rows are deleted 90 days after the error was last seen.
- **Alerts go to info@volleyrumours.be only** (owner), through Resend: one
  content-free email for a new error, or one back after a quiet hour, at most
  10 an hour. Staff read the messages on `/admin/fouten`.
- At most 100 new errors are stored per hour, because anyone can report a
  browser error.

**Consequences.** No new processor; the privacy page lists the retention. No
stack traces or source maps: the digest on `/admin/fouten` finds the full
error in the Vercel logs. Someone has to read info@volleyrumours.be. Revisit
if the errors turn out too hard to debug this way.

## D-042 — Authors withdraw and edit their own rumours

**Context.** Once submitted, a rumour couldn't be changed or removed by its
author (#192). A player asking the author to take it down, or a typo in the
club or division, needed a report, a takedown request or the contact form,
and a moderator. Zoekertjes could already be edited and deleted (#72).

**Decision** (owner, 2026-10-20).
- **Withdraw**: an author can withdraw their own rumour while it is pending or
  lopend. Confirmed, denied and expired rumours are the track record (D-005)
  and a confirmed one has created a transfer, so those can't be withdrawn;
  the author uses the contact form or a takedown request.
- **Edit**: only while the rumour is pending. To correct a published rumour,
  the author withdraws it and submits a new one, which is moderated again.
- **Track record**: withdrawn rumours don't count, and no "ingetrokken" count
  is shown.
- **Messages** can't be deleted, because reports read the conversation
  (D-015).
- A withdrawn rumour gets the status `withdrawn` instead of being deleted, so
  takedown requests and reports about it (`ON DELETE CASCADE`) stay in the
  staff inbox, marked as withdrawn. Only its author and staff can still read
  it. Its name, clubs, description and source link are wiped 12 months after
  withdrawal, like takedown requests (D-014).
- Suspended users may withdraw but not edit (owner, 2026-10-20). It matches
  zoekertjes, which a suspended user can delete but not edit (D-016).
  Withdrawing only removes content, staff keep seeing the rumour and its open
  reports and takedowns, and the person it names isn't kept waiting for the
  suspension to end.

**Consequences.** `withdraw_rumour()` and an UPDATE policy limited to the
author's own pending rumours, with the submission checks on every edit. The
retention function `wipe_withdrawn_rumours()` runs every night since #202
(D-046), like the other retention functions.

## D-043 — Migrations keep the code on `main` working, and are pushed before merge

**Context.** Rollback is Vercel Instant Rollback (D-008), which brings back
older code but never undoes a migration. The review for #188
(`docs/rollback.md`) found seven migrations since the baseline that the code
before them couldn't run against: dropped or renamed columns, a dropped table,
a new NOT NULL column, a column-level SELECT grant and a stricter insert
trigger. The owner also pushed every migration after its PR merged, so for a
few minutes the new code ran against the old database. Both were harmless in
coming-soon mode; after launch, real users would hit them.

**Decision** (owner, 2026-10-20).
- Every migration keeps the code on `main` working. Adding is fine. Removing
  or renaming something the app uses, or tightening a rule it relies on, is
  split: first a PR that stops using it, then a later PR with the migration
  (expand first, contract later).
- The owner runs `npx supabase db push` from the up-to-date PR branch once CI
  is green, then the PR merges. New code never runs against an old database,
  and the code that was live just before can always run against the new one.
- Each migration PR notes the SQL that would undo it.
- A pushed migration's file must reach `main`, even if the PR is dropped
  (merge the file, or a migration that undoes it); otherwise `db push` finds a
  remote version it doesn't know.

**Consequences.** `CLAUDE.md`, the PR template and the README say so. The
seven older migrations stay as they are: nobody will roll back weeks of
deployments. A change that needs a contract step takes two PRs.

## D-044 — Supabase Pro from a week before launch

**Context.** Production runs on Supabase's Free plan, which has no backups at
all (checked 2026-10-20: no daily backups, PITR off) and pauses a project after
a week without activity. Its other limits fit the expected peak: under 500
visitors a day during the window (owner, 2026-10-20). Details in
`docs/supabase.md` (#187).

**Decision** (owner, 2026-10-20). Upgrade to Pro ($25/month) a week before
launch (#95) and stay on it: daily backups kept 7 days, no pausing, spend cap
on, leaked-password protection (R-11) turned on. No point-in-time recovery
(about $100/month more, and a bigger compute size); losing up to a day of data
is acceptable at this size. Making our own dumps on the Free plan was
considered: free, but the dumps hold personal data in a new place, and
restoring them is manual.

**Consequences.** Until the upgrade, production has no backups; it holds the
waitlist and test accounts, and the owner accepts that. The plan is changed in
Vercel, which manages the Supabase organisation. Resend stays on its Free plan
(100 emails a day) except around launch: upgrade for the launch month if the
waitlist and sign-ups need it, or send the launch email in batches.

## D-045 — No database load test; speed work goes to the browser

**Context.** #97 planned a load test of the database against a non-production
target. The expected peak is under 500 visitors a day, on Supabase Pro from a
week before launch (D-044), and #96 measured local p95 under 60 ms with 500
rows. Vercel Speed Insights meanwhile gave production a desktop Real Experience
Score of 64 (2026-10-21), and Lighthouse mobile scored the homepage 53: the
server answers in 20–50 ms, the browser then spends over a second on
JavaScript.

**Decision** (owner, 2026-10-21). No database load test; #97 is dropped. Launch
performance work goes into page speed in the browser (#199), measured with
Lighthouse mobile against a local production build, before and after.

**Consequences.** Libraries that a page needs only after it has loaded, like
the Supabase browser client, load on demand (`lib/supabase/load-client.ts`).
Icons and logos are served at the size they are shown. Supabase Pro is still
the safety margin for the database; if the window brings far more traffic
than expected, a load test can come back as its own issue.

**Correction** (#205). The 20–50 ms server figure was Lighthouse's
"server response time", which doesn't show the real wait: from Belgium the
homepage HTML took 0.4–1.0 s, because functions ran in Washington. See D-048.

## D-046 — Retention runs every night with pg_cron

**Context.** The privacy page promises how long we keep withdrawn rumours,
takedown requests and contact messages (12 months) and the staff log (2
years). Four database functions carry that out (D-011, D-014, D-017, D-042),
but nothing ran them. The first rows expire in October 2027. The options
were pg_cron inside the database, or a Vercel cron route calling the
functions through the admin client.

**Decision** (agent, #202). pg_cron, scheduled in a migration: one job per
function every night between 02:00 and 02:15 UTC, and a fifth that keeps the
jobs' own run history 90 days.

**Why.** The jobs run as `postgres`, which owns the functions, so nothing new
is granted. A Vercel route would need an `EXECUTE` grant to `service_role`
for four privacy functions, a public endpoint and a `CRON_SECRET`. pg_cron
is on every Supabase plan and in the local stack, so pgTAP tests the
schedule. It also doesn't depend on Vercel's Hobby cron limits or on a
deployment.

**Consequences.** A new retention function gets its job in the same
migration. Job status is in Supabase → Integrations → Cron and in
`cron.job_run_details` (`docs/supabase.md`); a failing job raises no alert
of its own. Undoing the migration unschedules the jobs (`docs/rollback.md`).

## D-047 — Rumour vote counts are live

**Context.** The rumour cards subscribed to Realtime for live vote counts, one
channel per card, but `rumours` was never in the `supabase_realtime`
publication, so Realtime refused every subscription: counts only changed on
the user's own vote or a reload, in production too. #200 found it while
moving the cards to the server. The options were to drop live counts or to
make them work.

**Decision** (owner, 2026-10-21, #200). Make them work: a migration adds
`rumours` to the publication, and each page with rumour cards opens one
channel for all of them.

**Consequences.** Realtime applies the table's RLS to each subscriber, so
visitors only get changes to public rumours. Every vote sends one Realtime
message to each open page that shows the rumour, which counts towards the
plan's monthly Realtime messages (`docs/supabase.md`). The Supabase browser
library still loads on rumour pages once they are idle (D-045); since #221
only once a rumour card is near the screen.

## D-048 — Vercel functions run in Paris

**Context.** The homepage felt slow next to volleytransfers.be, although
Lighthouse scored us 95 and them 92. Measured from Belgium on 2026-10-21, our
HTML arrived after 0.4–1.0 s (theirs 0.17–0.29 s) and the page showed after
1.1–1.7 s (theirs 0.4–0.6 s). Production answered with `X-Vercel-Id:
fra1::iad1`: functions ran in Vercel's default region, Washington DC, while
the database is in Paris. A page waits on Supabase several times in a row
(the proxy's session check, the page's queries, the user's votes), and each
wait was a round trip across the Atlantic.

**Decision** (owner asked for a faster homepage; agent, #205). `vercel.json`
sets `regions: ["cdg1"]`: every function runs in Paris, next to the
database. The Hobby plan allows one region of our choice.

**Consequences.** Every server-rendered page and server action gains, not
only the homepage. Visitors from Belgium reach Paris in a few milliseconds.
Personal data is processed in the EU by default; the privacy page already
says Vercel may process data in the US, which stays true for its other
services. A visitor far from Europe waits longer, which fits a Belgian site.
Lighthouse's simulated "server response time" doesn't show this kind of
delay: measure it with curl or the observed timings.

## D-049 — Pages read the user from the verified JWT

**Context.** Every logged-in page view made two calls to Supabase Auth
(`GET /auth/v1/user`): one in the proxy, one while rendering the header.
Locally that made a logged-in page ~95 ms against ~25 ms logged out. The
project signs its tokens with an asymmetric key (ES256; production and the
local stack both publish one), so the token can be checked in the process.

**Decision** (agent, #212, including the ticket's optional step 3). The proxy
calls `getClaims()`: it refreshes an expired session as before and verifies
the JWT against the project's public key, cached for 10 minutes. Pages read
the user with `getSessionUser()` (`lib/supabase/session.ts`), also from the
verified token: the header, the suspension notice and the user's votes.
Server actions, staff checks (`lib/staff.ts`) and the pages only the owner of
the data opens (profile, edit pages) keep `getUser()`.

**Consequences.** A logged-in page makes no call to Auth: locally `/over-ons`
95 → 25 ms first byte, `/` 94 → 33 ms. A deleted account, or a session ended
on another device, still looks logged in on pages until its token expires (1
hour); the database refuses its writes anyway (RLS, the suspension trigger
`VR005`), and a suspension shows at once because it is read from our own
table. To undo: call `getUser()` in `getSessionUser()` and in the proxy.

## D-051 — The homepage leads with a transfer board, and nothing slides by itself

**Context.** The owner asked for a rebuilt launch homepage, researched against
recent Awwwards sports winners, and asked whether the sliding band on the
coming-soon page was needed (#240). The award sites are one-visit brand pieces
(video heroes, gates, scroll hijacking, loops). VolleyRumours is reopened on a
phone all through the transfer window. The band slid for more than 5 seconds
with only a hover pause, which fails WCAG 2.2.2 on touch and keyboard.

**Decision** (owner approved the design, 2026-10-23, PR #241).
- The homepage opens with "Wie gaat waarheen?" and a transfer board: the 8
  newest public rumours of every status (Lopend, Bevestigd, Ontkracht, Niet
  bevestigd), each with clubs, division, time, status and the voters' share.
  Showing resolved rumours too was the agent's call: it shows the moderation
  working, and an Ontkracht row clears a name instead of leaving a rumour
  hanging.
- "Gerucht delen" stays the primary button and "Zoekertje plaatsen" the
  second: the site is called VolleyRumours (owner).
- Below the board: hot topics with votes, the newest zoekertjes, zoekertjes
  per division, confirmed transfers and Betrouwbare bronnen.
- Nothing on the homepage moves by itself. The coming-soon band stands still:
  a phone swipes it, from lg it wraps.

**Consequences.** The board's voters' share is cached for up to 60 s; the hot
topics below it are live (D-047). The per-division index counts only
zoekertjes, because `/geruchten` has no division filter yet (#242).

## D-052 — One checkbox for the rumour rules

**Context.** The rumour form asked for two declarations (#67, D-003, D-013):
the rumour is about a senior player or trainer, and it is shared in good
faith without insults or private matters. The owner found two checkboxes
heavy and asked for one "akkoord met de voorwaarden" instead (#247).

**Decision** (owner, 2026-10-23).
- One required checkbox: "Ik volg de regels voor geruchten", where the link
  opens the Geruchten section of the terms (`/voorwaarden#geruchten`) in a
  new tab. The rules themselves are not in the sentence.
- Ticking it sets both stored flags, `declared_senior` and
  `declared_good_faith`; the database still refuses a rumour without them.
- The agent advised keeping the rules in the sentence: a declaration of the
  specific rules is stronger evidence against a defamation claim than a
  reference to them, and it puts the minors rule in front of the poster at the
  moment of posting. The owner chose the short version.
- Not a generic "Ik ga akkoord met de voorwaarden": every user accepted the
  terms at sign-up already (D-031).

**Consequences.** The terms text is unchanged, so no new terms version; the
Geruchten section only gained an anchor. Seniors only and pre-moderation
still keep minors out. The legal review lists the change as a question for
the lawyer.

## D-053 — Production shows the coming-soon page until launch

**Context.** D-034 kept production public during development, so the owner
could follow progress live. On 2026-10-22 the owner added Production to
`NEXT_PUBLIC_COMING_SOON` in Vercel, and since then volleyrumours.be shows the
coming-soon page and redirects other routes to `/` (D-009). The countdown
page with the waitlist is what visitors should see before launch.

**Decision** (owner, 2026-10-26, confirming the change of 2026-10-22).
Coming-soon mode stays on in production until launch (#95). It replaces
D-034.

**Consequences.**
- Merged features are not visible on volleyrumours.be; only the coming-soon
  page and the info pages are (D-009). Work is checked on a local production
  build. A full-site preview with coming-soon off for Preview only is a
  separate question for the owner.
- Supabase sign-ups stay disabled until launch.
- Checks on production are limited to what coming-soon shows: the homepage,
  the info pages, the redirect status and response times.
