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
| D-034 | 2026-10-19 | Accepted | Production stays public while the site is in development; coming-soon goes back on before launch |
| D-035 | 2026-10-19 | Accepted | Every approved rumour has its own shareable page, but rumour pages are never indexed by search engines |

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

**Consequences.** The purge must be scheduled before the first entries expire
(October 2028). The privacy page should mention the log and its retention
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
function must be scheduled before October 2027. Copy is reviewed in #94.

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
function must be scheduled before October 2027, with the takedown one.

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
