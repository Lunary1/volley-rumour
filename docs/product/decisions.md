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
| D-005 | 2026-10-13 | Proposed | Replace popularity points with an accuracy-based track record     |
| D-006 | 2026-10-13 | Accepted | Moderation needs an admin role, separate from the user account type |
| D-007 | 2026-10-13 | Accepted | npm is the package manager; `pnpm-lock.yaml` is removed           |
| D-008 | 2026-10-13 | Accepted | GitHub Flow: protected `main` is production; PRs with CI, squash merge |
| O-001 | 2026-10-13 | Open     | Who may confirm a rumour as a transfer, and who marks it denied   |

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
  own club's transfers — see O-001).
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

## D-005 — Reputation as an accuracy track record (Proposed)

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

**Needs owner sign-off before it becomes backlog items.**

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
safety. The real gap is the database: add a separate non-production Supabase
project for Preview deployments (M1). Revisit a staging branch if batched
releases or a fixed staging URL for moderators become necessary.

## O-001 — Rumour confirmation authority (Open)

**Question.** Who turns an approved rumour into a confirmed transfer, and who
marks it denied?

**Options considered so far.**
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

**Leaning:** A for launch, with B as a post-launch option. To be decided.
