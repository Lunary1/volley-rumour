# Legal self-review — terms, privacy and takedown (#94)

Self-review of the public texts against what the site does after M2, done on
2026-10-19 before launch. It is **not legal advice**: it is the pack to hand a
lawyer, with the open questions at the end. Re-run it when the texts or the
behaviour change.

| Text | Where | Version |
| --- | --- | --- |
| Gebruiksvoorwaarden | `app/voorwaarden/page.tsx` | 19 oktober 2026 (`current_terms_version()` = `2026-10-19`) |
| Privacybeleid | `app/privacy/page.tsx` | bijgewerkt 19 oktober 2026 |
| Verwijderverzoek (form + status page) | `app/verwijderverzoek/` | — |
| Moderation notes the user reads | `lib/moderation-templates.ts`, `docs/product/moderation.md` | D-036 |

## 1. The site in one paragraph (for the reviewer)

Free, non-commercial Dutch-language community site for Belgian volleyball, run
by one private person (D-038). Users 16+ (D-003) post classifieds (players,
trainers, teams) and transfer rumours about **senior** players and trainers
(D-002). Every rumour is pre-moderated by a human before it is public (D-012);
it needs a source type and a good-faith declaration (D-013). Visitors can ask
for removal of a rumour about them without an account (D-014); users can
report rumours, classifieds and conversations (D-015). Staff can remove
content and admins can suspend accounts (read-only, D-016). Every staff action
is in an append-only audit log kept 2 years (D-011). Data in Supabase (EU);
Vercel hosting, Resend email, optional Google login.

## 2. What the old texts got wrong

| Old text said | The site does | Fixed |
| --- | --- | --- |
| Rumours can be shared "vrij" | Pre-moderation, source and declarations required, max 5 pending, seniors only | Terms › Geruchten |
| "Geverifieerde moderators" confirm transfers | Staff resolve rumours as bevestigd / ontkracht / niet bevestigd on an official source | Terms › Geruchten |
| Upvote / downvote, reputation | "Klopt het?" vote on lopende rumours, not on your own, private; track record from moderator decisions only (D-005) | Terms › Stemmen |
| Messages about rumours and classifieds | Conversations only about a zoekertje (D-022), blocking (D-018), moderators read reported conversations (D-015) | Terms › Berichten |
| Accounts "in beslag nemen", vague sanctions | Reject, remove, email warning, suspension until a date or indefinite (read-only) | Terms › Wat we kunnen doen |
| Nothing on what happens to content | Licence while online; published rumours stay anonymised after account deletion (D-021, D-029) | Terms › Wat je plaatst |
| Absolute "geen aansprakelijkheid" | Limited "voor zover de wet het toelaat", carve-out for intent and gross fault and consumer rights | Terms › Aansprakelijkheid |
| No operator, law or redress | Operator as a team + email (D-038), Belgian law, contest procedure | Terms, privacy |
| Spelling and tone mistakes ("bloostelt", "postvat", u/je mixed) | — | Rewritten |

## 3. GDPR (AVG) — information duties

| Requirement | Status | Where / note |
| --- | --- | --- |
| Art. 13(1)(a) identity and contact of the controller | **Partly** | Team name + `info@volleyrumours.be` + contact form, no personal name or address (D-038). Open question 1 |
| Art. 13(1)(b) DPO | n/a | Not required at this scale |
| Art. 13(1)(c) purposes and legal bases | Done | Privacy › Waarom we je gegevens mogen gebruiken |
| Art. 13(1)(d) legitimate interests | Done | Moderation, abuse prevention (daily rotating IP hash), cookie-less analytics, notification emails (opt-out), rumours about players |
| Art. 13(1)(e) recipients | Done | Privacy › Wie verwerkt je gegevens (Supabase, Vercel, Resend, Google) |
| Art. 13(1)(f) transfers outside the EU | Done, **verify** | Vercel, Resend, Google: DPF or SCCs stated generally. Open question 4 |
| Art. 13(2)(a) retention | Done | Privacy › Hoe lang (account, deletion, suspensions, 2-year log, 12 months takedowns/contact, waitlist) |
| Art. 13(2)(b) rights incl. objection, restriction, portability | Done | Privacy › Jouw rechten |
| Art. 13(2)(c) withdraw consent | Done | Waitlist and Google login |
| Art. 13(2)(d) complaint to the supervisory authority | Done | Gegevensbeschermingsautoriteit linked |
| Art. 13(2)(f) automated decisions | Done | "Elke moderatiebeslissing neemt een mens" |
| Art. 14 people named in rumours (data not from them) | Done | Privacy › Geruchten over jou: what, why, seniors only, objection = verwijderverzoek. Open question 2 |
| Art. 8 children | Done | 16+ for accounts (D-003); no rumours about minors (D-002) |
| Art. 30 records of processing | **Missing** | Not public; a short register is still to write (owner) |

## 4. Digital Services Act (hosting service)

Whether the DSA applies to a free, non-commercial site is itself open
(question 3). The texts follow it anyway: it costs little and is the safer
reading. Micro enterprises are exempt from art. 20–28 except art. 24(3).

| Article | Status | Where / note |
| --- | --- | --- |
| 11/12 points of contact (authorities, users) and languages | Done | Terms › Over VolleyRumours: contact form + email, Dutch or English |
| 14 terms describe moderation, restrictions, procedures, tools | Done | Terms › Geruchten, Melden en laten verwijderen, Wat we kunnen doen; no automated moderation |
| 16(1) easy electronic notice mechanism | Done | "Melden" (logged in) and `/verwijderverzoek` (no account) |
| 16(2)(d) good-faith statement | **Added in #94** | Required checkbox on the takedown form, checked by the server action |
| 16(4) confirmation of receipt | Done | Reference number and private status link on screen |
| 16(5) notify the notifier of the decision and redress | **Partly** | Status page shows the decision, note and redress (#94). Email to the requester comes with #181 (D-037). Reporters only get a confirmation (D-015). Open question 5 |
| 17 statement of reasons to the affected user | Done | Reason and note on the profile (rumour rejected or removed, zoekertje removed), suspension reason on every page, each with "Niet akkoord? Laat het ons weten" (#94). Shown on screen, not emailed (D-037) |
| 20 internal complaint system | Voluntary | Contest via contact form within 6 months (Terms › Niet akkoord). Exempt as a micro enterprise |
| 23 measures against misuse | Done | Suspensions; daily limits on takedown and contact forms |

## 5. Belgian law and consumer protection

| Requirement | Status | Note |
| --- | --- | --- |
| WER art. XII.6: name, geographic address, email, enterprise number | **Not shown** | Defensible only while the service is free (D-038). Mandatory once anything is paid. Open question 1 |
| WER Book VI unfair terms (B2C) | Done | No exclusion for intent or gross fault; consumer rights kept |
| Applicable law and court | Done | Belgian law, Belgian courts |
| Changes to the terms | Done | New version asked once on `/welkom` (#75); this PR bumps it to `2026-10-19` |
| Language | Done | Dutch; French is a nice-to-have (D-027). Open question 6 |
| Paid features (featured ads) | n/a | Free at launch; terms say they'll change first if that changes |
| Cookies (ePrivacy, art. 129 WEC) | Done | Only strictly necessary (login) and theme in browser storage; analytics cookie-less, no banner needed |
| Personality rights / defamation of people named in rumours | Mitigated | Seniors only, source and good faith required, pre-moderation, takedown without account. Open question 2 |

## 6. Open questions for a lawyer

1. **Anonymous operator (D-038).** Is a team name plus email enough under GDPR
   art. 13 and WER art. XII.6 for a free, non-commercial site run by a private
   person? What must change before paid features?
2. **Rumours about named players.** Is legitimate interest a sound basis for
   publishing unconfirmed transfer rumours about senior players, given
   pre-moderation, the source requirement and takedown without an account? Is
   the Art. 14 notice on the privacy page enough, or must named players be
   told individually (art. 14(5)(b) disproportionate effort)?
3. **DSA scope.** Does the DSA apply to a free, non-commercial hobby site? If
   it does, are we a "hosting service" or an "online platform"?
4. **Transfers.** Confirm the transfer mechanism per processor (Vercel,
   Resend, Google, Supabase Inc.) and whether the privacy page must name it
   per processor.
5. **Notifying reporters (D-015, D-037).** Is the on-screen confirmation enough
   for a user who reports illegal content, or must they be told the decision
   (DSA art. 16(5))?
6. **French.** Does a Dutch-only site serving the whole of Belgium need French
   terms (language legislation does not apply to private sites, but consumer
   law asks for "clear and comprehensible" terms)?
7. **Licence clause.** Is the licence in "Wat je plaatst", plus keeping
   published rumours anonymised after account deletion, enforceable and
   compatible with the right to erasure?
8. **Audit log retention.** Is 2 years (D-011) proportionate for a log that
   names users and moderators?

## 7. Still to do outside the code

- Records of processing (GDPR art. 30): a one-page register (owner).
- A second moderator before launch (D-036).
- Verify that `info@volleyrumours.be` is read; it is the contact point in the
  terms (D-038).
