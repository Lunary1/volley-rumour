# User journeys — volleyrumours.be

These journeys describe the **target** behaviour for public launch (before the
spring 2027 transfer window). They are the reference for the gap audit
(`audit.md`) and for acceptance criteria on GitHub issues.

- UI copy is Dutch. Dutch strings quoted below are indicative, not final copy.
- Decisions referenced as `D-xxx` / `O-xxx` live in [decisions.md](decisions.md).
- Items marked **[assumption]** are my best guess at intent and need owner
  confirmation before they become issues.

## Personas

| Persona               | Description                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Visitor               | Anyone, not logged in. Includes people named in a rumour.                                    |
| Registered player     | 16+ senior player looking for a (new) team.                                                   |
| Coach                 | Trainer/trainster looking for a team, or responding to clubs looking for a trainer.          |
| Club representative   | Board member or team manager posting "team zoekt speler/trainer". Same account type (D-001). |
| Rumour contributor    | Registered user who shares transfer rumours and builds a track record.                       |
| Admin / moderator     | Staff with the moderation role (D-006).                                                       |

## Overview

| ID   | Persona             | Journey                                             | Pillar      |
| ---- | ------------------- | --------------------------------------------------- | ----------- |
| J-01 | Visitor             | Find a matching zoekertje                           | Classifieds |
| J-02 | Visitor             | Read Transfer Talk and confirmed transfers          | Rumours     |
| J-03 | Visitor             | Create an account                                   | Account     |
| J-04 | Registered player   | Post a "speler zoekt team" zoekertje                | Classifieds |
| J-05 | Registered player   | Manage my own zoekertjes                            | Classifieds |
| J-06 | Coach               | Find a club and start a conversation                | Classifieds |
| J-07 | Coach               | Block or report an unwanted contact                 | Safety      |
| J-08 | Club representative | Recruit a player or trainer for the club            | Classifieds |
| J-09 | Rumour contributor  | Submit a sourced rumour for moderation              | Rumours     |
| J-10 | Rumour contributor  | Follow my rumours and track record; vote on others  | Rumours     |
| J-11 | Registered user     | Manage my account and personal data                 | Account     |
| J-12 | Visitor (named)     | Request removal of a rumour about me                | Safety      |
| J-13 | Moderator           | Work the pre-moderation queue                       | Moderation  |
| J-14 | Moderator           | Resolve a live rumour (confirm / deny / expire)     | Moderation  |
| J-15 | Moderator / admin   | Handle reports, takedowns and sanctions             | Moderation  |

---

## J-01 — Visitor finds a matching zoekertje

**Goal.** Without an account, find ads that match what I'm looking for (type,
region, level, position) and see enough detail to decide whether to make
contact.

**Steps.**
1. Open `/zoekertjes` from the homepage or navigation.
2. Filter by type (speler zoekt team / team zoekt speler / trainer zoekt team /
   team zoekt trainer), province, division and position; optionally search
   by text.
3. Open an ad detail page.
4. Tap "Contact opnemen" and be asked to log in or register.

**Acceptance criteria.**
- **Given** active zoekertjes exist, **when** I open `/zoekertjes`, **then** I
  see them newest first, with featured ads marked, paginated, and only ads that
  are active and not expired.
- **Given** I select type, province, division and/or position filters,
  **when** the list updates, **then** only matching ads are shown and the
  filters are reflected in the URL so the view can be shared.
- **Given** an ad has an empty description or an anonymised author, **when** I
  search, **then** the page does not error.
- **Given** I open an ad detail page, **then** I see type, title, position,
  team, division, province, description, posted date and the author's username
  (never their e-mail address or phone number).
- **Given** I am not logged in, **when** I click "Contact opnemen", **then** I
  am sent to login and returned to the same ad afterwards.
- **Given** an ad is deactivated or removed, **when** I open its URL, **then** I
  see a Dutch "niet (meer) beschikbaar" page, not an error.

## J-02 — Visitor reads Transfer Talk and confirmed transfers

**Goal.** Catch up on what's being rumoured and what's confirmed, and judge how
credible each rumour is.

**Steps.**
1. Open `/geruchten` (Transfer Talk) and filter by status: lopend, bevestigd,
   ontkracht, niet bevestigd (expired).
2. Open a rumour to read details.
3. Open `/transfers` and filter by players, trainers, stoppers.

**Acceptance criteria.**
- **Given** rumours in any state, **when** I open `/geruchten`, **then** only
  moderator-approved rumours are visible; pending, rejected and removed
  rumours never appear (D-002).
- **Given** an approved rumour, **then** its card shows person, from → to club,
  category, status, age, community belief as a neutral percentage, and the
  author's username plus track record (D-005), without good/evil labels.
- **Given** a rumour has a source, **then** the source type is shown
  ("Bron: clubwebsite / pers / sociale media / eigen info") and a link if one
  was provided.
- **Given** each rumour card, **then** there is a visible "Melden" link that
  starts J-12 / J-15.
- **Given** confirmed transfers exist, **when** I open `/transfers` and switch
  tabs, **then** each tab shows the matching transfers with correct type
  labels (no "Onbekend") and the confirmation date.
- **Given** a transfer card, **then** there is no "Contact <author>" button
  (D-004).
- **Given** the list grows to hundreds of rumours, **then** the page paginates
  and loads in under 1 s p95.

## J-03 — Visitor creates an account

**Goal.** Register with email or Google so I can post and message.

**Steps.**
1. Open `/auth/sign-up`.
2. Choose Google, or enter username, email and password.
3. Tick "Ik bevestig dat ik 16 jaar of ouder ben" and accept the terms and
   privacy policy.
4. Confirm my email (email sign-up) and land logged in.

**Acceptance criteria.**
- **Given** the sign-up form, **when** I submit without ticking the 16+
  confirmation or without accepting the terms, **then** sign-up is blocked
  with a Dutch error (D-003).
- **Given** I sign up with Google for the first time, **when** I return from
  Google, **then** I must complete the same 16+ and terms confirmation before I
  can post or message.
- **Given** valid details, **when** I register by email, **then** I see
  "Controleer je e-mail", and clicking the link logs me in and lands me on the
  page I came from.
- **Given** the username I chose is taken or invalid, **then** I see a Dutch
  error on the field, not a raw Supabase message.
- **Given** the user registered, **then** the time of the 16+ and terms
  acceptance and the terms version are stored for audit.
- **Given** an email that is already registered, **then** the response does not
  reveal whether the account exists.

## J-04 — Registered player posts a "speler zoekt team" zoekertje

**Goal.** Let clubs know I'm available, at my level and in my region.

**Steps.**
1. Click "Plaats zoekertje" (and log in if needed).
2. Choose "Speler/speelster zoekt team".
3. Fill in name, gender, position, current club, division (senior only),
   province and description.
4. Submit, and see my ad live in the list.

**Acceptance criteria.**
- **Given** I am not logged in, **when** I open `/zoekertjes/nieuw`, **then** I
  am redirected to login and back afterwards.
- **Given** the form, **then** division only offers senior divisions (Liga,
  Nationale 1–3, Promo 1–4) for both heren and dames (D-003).
- **Given** I submit, **then** input is validated on the server with Dutch
  messages, and every field I filled in (including gender) is stored and
  shown.
- **Given** a successful submit, **then** I land on my new ad's detail page with
  a confirmation toast, and the ad appears in `/zoekertjes`.
- **Given** the ad is created, **then** it has an expiry date
  (the next 31 August, at least 30 days after posting, D-024) and I'm told
  when it expires.
- **Given** the form, **then** I'm told that my name and club will be public,
  before I submit.

## J-05 — Registered player manages own zoekertjes

**Goal.** Keep my ad accurate, and take it down once I've found a team.

**Steps.**
1. Go to Profile → "Mijn zoekertjes".
2. Edit an ad, mark it "gevonden" (deactivate), or delete it.

**Acceptance criteria.**
- **Given** I own active ads, **when** I open "Mijn zoekertjes", **then** I see
  all my ads (active, inactive and expired) with their status.
- **Given** I edit an ad, **when** I save, **then** the changes are visible
  immediately in the list and on the detail page.
- **Given** I mark an ad "gevonden", **then** it disappears from the public list
  and its conversations stay readable for both parties.
- **Given** I delete an ad, **then** it is removed from public view and I am
  asked to confirm first.
- **Given** an ad I don't own, **when** I try to edit or delete it (UI or direct
  request), **then** the request is refused by RLS and the server.

## J-06 — Coach finds a club and starts a conversation

**Goal.** Find clubs looking for a trainer at my diploma level and region, and
contact them privately.

**Steps.**
1. Filter `/zoekertjes` on "team zoekt trainer" and my province.
2. Open an ad and click "Contact opnemen".
3. Write a first message and send it.
4. Continue the conversation in `/messages`.

**Acceptance criteria.**
- **Given** I'm logged in and viewing someone else's ad, **when** I click
  "Contact opnemen", **then** if I already have a conversation about this ad I
  go straight to it; otherwise a modal opens to write my first message.
- **Given** I'm viewing my own ad, **then** no contact button is shown.
- **Given** I send a message, **then** it appears instantly for me and in real
  time for the recipient, and the conversation shows the ad title and links
  back to it.
- **Given** the recipient is not online, **then** they receive an email
  notification of the new message (no message content in the email), at most
  one until they read it, unless they turned emails off (D-025, D-032).
- **Given** the inbox, **then** conversations are ordered by most recent
  activity, show unread counts, and the header badge matches the total unread.
- **Given** any user who is not a participant, **then** they can never read the
  conversation or its messages, including through Realtime.

## J-07 — Coach blocks or reports an unwanted contact

**Goal.** Stop someone from messaging me and alert the moderators if they
behave inappropriately.

**Steps.**
1. In a conversation, open the menu and choose "Blokkeren" or "Melden".
2. For "Melden", give a reason.
3. Optionally unblock later from my profile.

**Acceptance criteria.**
- **Given** I block a user, **then** they can no longer send messages to me or
  start new conversations with me, and see a neutral message ("Je kan deze
  gebruiker geen berichten sturen").
- **Given** I blocked a user, **then** I can't message them either, and our
  earlier messages stay readable for both of us (D-018).
- **Given** I report a conversation with a reason, **then** a report is created
  for moderators (J-15) and I see a confirmation.
- **Given** I blocked someone, **when** I open my profile's block list, **then**
  I can unblock them.
- **Given** I archive a conversation, **then** it leaves my inbox but not the
  other participant's.

## J-08 — Club representative recruits a player or trainer

**Goal.** Publish a vacancy for my club and handle responses efficiently.

**Steps.**
1. Post "team zoekt speler" or "team zoekt trainer" with club/team name,
   team gender, division, province, position(s) and description.
2. Receive messages from candidates in my inbox.
3. Close the ad when the position is filled.

**Acceptance criteria.**
- **Given** the "team zoekt …" form, **then** I can specify team gender (heren or
  dames, matching the division, D-019), senior division, province, position (players) or
  required diploma (trainers), and all of these are stored and shown.
- **Given** several candidates contact me about one ad, **then** each is a
  separate conversation labelled with the ad title.
- **Given** the position is filled, **when** I close the ad (J-05), **then** it
  disappears from the list and existing conversations remain.
- **Given** a verified badge has been granted to me (D-001), **then** it is
  shown next to my username on my ads.

## J-09 — Rumour contributor submits a sourced rumour

**Goal.** Share a transfer or retirement rumour and get credit if it turns out
to be right.

**Steps.**
1. Click "Gerucht delen" (log in if needed).
2. Choose the category: speler transfer, trainer transfer, speler stopt,
   trainer stopt.
3. Fill in person, current club and division, destination club and division
   (transfers), source type with optional link, and description.
4. Confirm the declarations and submit.
5. See "In afwachting van moderatie".

**Acceptance criteria.**
- **Given** the form, **then** division options are senior only (D-003), and a
  source type is required ("eigen info / clubwebsite / pers / sociale media /
  andere") with an optional URL.
- **Given** the form, **then** I must tick: "Dit gerucht gaat over een senior
  speler of trainer, en ik deel het te goeder trouw" before I can submit.
- **Given** I submit valid input, **then** the rumour is stored as **pending**,
  is not publicly visible, and I see "Je gerucht wordt nagekeken door een
  moderator" (D-002).
- **Given** every field I filled in (gender, divisions, source), **then** it is
  stored, not just validated.
- **Given** I already have N pending rumours **[assumption: N = 5]**, **then**
  I can't submit more until some are reviewed (anti-spam).
- **Given** a moderator approves or rejects my rumour, **then** I'm notified
  (in-app, and by email unless I turned that off, D-025), with the reason if
  rejected.

## J-10 — Rumour contributor follows own rumours, track record and voting

**Goal.** See the status of my rumours and how accurate I've been; signal
whether I believe other people's rumours.

**Steps.**
1. Open Profile → "Mijn geruchten" to see each rumour's status.
2. See my track record ("X van Y bevestigd").
3. Vote "klopt / klopt niet" on other people's live rumours.

**Acceptance criteria.**
- **Given** my rumours, **then** I see each one's status (in afwachting /
  afgewezen + reden / lopend / bevestigd / ontkracht / niet bevestigd /
  verwijderd).
- **Given** resolved rumours, **then** my track record counts only confirmed
  vs denied; expired rumours are neutral (D-005).
- **Given** a live rumour by someone else, **when** I vote, **then** I can vote
  once, change my vote, and the counts stay correct under concurrent votes
  (enforced in the database, not with read-modify-write in the app).
- **Given** my own rumour, **then** I cannot vote on it.
- **Given** a vote, **then** it does not change anyone's reputation (D-005,
  proposed).
- **Given** a pending, rejected or resolved rumour, **then** voting is closed.

## J-11 — Registered user manages account and personal data

**Goal.** Keep my profile up to date, recover access if I forget my password,
and delete my account and data if I leave.

**Steps.**
1. Edit username/avatar in Profile.
2. Use "Wachtwoord vergeten?" from login and set a new password via the email
   link.
3. Delete my account with "VERWIJDER" confirmation.

**Acceptance criteria.**
- **Given** I request a password reset, **when** I follow the email link,
  **then** I land on a working "Nieuw wachtwoord instellen" page and can log in
  with the new password.
- **Given** a Google-only account, **when** I use the reset flow, **then** I can
  add a password and both login methods work.
- **Given** I change my avatar, **then** I upload an image (not paste a URL),
  restricted to image types and a max size **[assumption]**.
- **Given** I delete my account, **then** my profile, votes, messages,
  conversations, blocks and avatar are deleted; my zoekertjes are **deleted**
  (D-021), and so are my rumours that were never published (D-029); my
  published rumours are anonymised; a hashed audit entry is
  written; and I'm logged out with a confirmation.
- **Given** a partial failure during deletion, **then** no half-deleted state is
  left behind (single transaction or idempotent retry).
- **Given** the privacy page, **then** it lists every processor in use (Supabase,
  Vercel Analytics/Speed Insights, the email provider; Datadog is removed, D-023)
  and matches what the site actually does.

## J-12 — Named person requests removal of a rumour about them

**Goal.** As the person a rumour is about (or their parent/representative), get
it taken down quickly, without needing an account.

**Steps.**
1. Use "Vraag de verwijdering aan" in a rumour's detail view, or the takedown
   link in the footer and privacy page (search the rumour by name).
2. Choose who is asking (the person, a parent, a representative) and fill in
   name, email and reason.
3. Receive a reference and a private status link; a moderator reviews it.

**Acceptance criteria** (decided in D-014).
- **Given** any approved rumour, **then** a takedown request can be filed
  without logging in, with bot protection (honeypot and daily limits).
- **Given** a takedown request, **when** it is submitted, **then** the rumour
  **stays visible until a moderator decides** (D-014) and the request appears
  in the moderators' inbox (`/admin/meldingen`).
- **Given** a request, **then** the requester sees a reference and a private
  status link. There is no email (D-014).
- **Given** a moderator decides (J-15), **then** the status link shows the
  outcome and the moderator's note; a removed rumour disappears from every
  public view and its author sees it as "Verwijderd", without who asked.
- **Given** the request contains personal data, **then** it is visible only to
  moderators, and name, email and reason are wiped 12 months after the request.

## J-13 — Moderator works the pre-moderation queue

**Goal.** Review new rumours fast, so good ones go live during the transfer
window and risky ones never do.

**Steps.**
1. Open `/admin/moderatie` and see pending rumours, oldest first.
2. For each: check person, clubs, divisions, source, and the author's track
   record.
3. Approve, edit-and-approve (typo fixes only), or reject with a reason.

**Acceptance criteria.**
- **Given** I don't have the moderator role, **when** I open any `/admin` route
  or call an admin action, **then** I get a 404/403 and nothing is changed
  (checked on the server and in RLS) (D-006).
- **Given** pending rumours, **then** I see them oldest first, with a count, the
  time waiting, the author's track record and their previous rejections.
- **Given** I approve a rumour, **then** it becomes publicly visible as "lopend"
  and the author is notified.
- **Given** I reject a rumour, **then** I must pick a reason (e.g. "geen bron",
  "minderjarige", "geen senior niveau", "beledigend", "dubbel") and the author
  sees it.
- **Given** any moderation action, **then** it is written to an audit log
  (who, what, when, why).

## J-14 — Moderator resolves a live rumour

**Goal.** Close the loop: turn true rumours into confirmed transfers, and mark
wrong ones as denied or expired.

> Moderators only (**D-020**, was O-001).

**Steps.**
1. Open a live rumour in the admin view.
2. Choose "Bevestigen" (with an official source URL), "Ontkrachten" (with a
   reason/source) or "Niet bevestigd" (expired).

**Acceptance criteria.**
- **Given** I confirm a rumour with a source URL, **then** a transfer is created
  with the correct type (player/trainer, male/female, transfer/retirement),
  the clubs and the confirmation date, linked to the rumour; and the rumour
  shows "Bevestigd".
- **Given** a rumour was already confirmed, **when** I confirm it again,
  **then** no duplicate transfer is created.
- **Given** I deny or expire a rumour, **then** its status changes, voting
  closes, and the author's track record updates (denied counts against them;
  expired does not) (D-005).
- **Given** the transfer window closes, **then** remaining live rumours can be
  bulk-marked "niet bevestigd".
- **Given** a transfer that didn't come from a rumour (e.g. officially
  announced), **then** I can add it directly.
- **Given** a mistake, **then** I can correct or remove a confirmed transfer,
  and the action is audited.
- **Given** a rumour was wrongly denied or expired, **when** I reopen it with a
  reason, **then** it is live again, the author's track record updates, and
  the action is audited (#150).

## J-15 — Moderator/admin handles reports, takedowns and sanctions

**Goal.** Act on everything users flag (rumours, zoekertjes, conversations,
takedown requests) and deal with abusive accounts.

**Steps.**
1. Open `/admin/meldingen` and see open reports by type and age.
2. Review the content in context (including the reported conversation, for
   conversation reports only).
3. Dismiss, remove the content, warn or suspend the user, and close the report.

**Acceptance criteria.**
- **Given** open reports, **then** I see them oldest first, with type, reason,
  reporter (unless anonymised) and the target content; takedown requests
  (J-12) are flagged with priority.
- **Given** a reported conversation, **then** I can read it only via the report
  (access is logged), not browse all conversations.
- **Given** I remove content, **then** it disappears from all public views
  (lists, detail pages, homepage, share links) and the author is notified with
  the reason.
- **Given** I suspend a user, **then** they can still log in to read, but can't
  post, vote or message until the suspension ends; their existing content is
  unaffected unless I remove it separately.
- **Given** any action, **then** it is recorded in the moderation audit log,
  and the takedown requester is informed of the outcome. A reporter gets a
  confirmation only; outcomes follow by email once #53 lands (D-015).
- **Given** a report, **then** the content stays visible until I decide, and
  my decision answers every open report about the same item (D-015).
- **Given** the admin area, **then** I can grant or revoke the verified badge
  (D-001) and the moderator role, and suspend users or lift a suspension
  (admins only, D-016). Moderators see the status but change nothing.
- **Given** I am suspended, **then** every page tells me until when and why,
  and I can still report, block, delete my own zoekertjes and delete my
  account (D-016).
- **Given** someone sends the contact form, logged in or not and suspended
  or not, **then** the message is stored and staff read it at
  `/admin/contact`, oldest first, with the sender's account if they were
  logged in. Marking it handled is logged; the personal fields are wiped 12
  months later (D-017).
