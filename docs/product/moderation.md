# Moderator handbook

How volleyrumours.be is moderated, who does it and how fast (#93, D-036).
Policy background: D-002 (pre-moderation), D-014 (takedowns), D-015 (reports),
D-016 (sanctions). Journeys J-13, J-14 and J-15 in `journeys.md`.

## Response times

| Inbox | Where | Target |
| --- | --- | --- |
| Pending rumours | `/admin/wachtrij` | Reviewed within 24 h |
| Takedown requests ("Voorrang") | `/admin/meldingen` | Decided within 72 h. The rumour stays up until then (D-014), so handle them first |
| Reports on rumours, zoekertjes and conversations | `/admin/meldingen` | Decided within 72 h |
| Contact messages | `/admin/contact` | Answered within 72 h. Read a suspension appeal ("Mijn account of schorsing") first |

The targets count calendar hours, weekends included, during the transfer
window. Outside the window they are a goal, not a promise.

## Rota

Until launch there is one moderator: the owner (admin). The transfer-window
readiness checklist asks for **at least two** before launch; recruiting the
second is an open launch risk.

| Period | Who | Check-ins |
| --- | --- | --- |
| Until launch | Owner | Once a day |
| Transfer window (peak) | Owner + [second moderator] | Morning and evening, split by day: one person per day, the other is backup |
| After the window | Owner | Once a day; end-of-window bulk "Alle lopende geruchten afsluiten" on `/admin/geruchten` |

When a moderator is away, the backup takes the whole day. Hand over anything
half-done (an open conversation report you are reading, a rumour you are
checking) in the admin's own channel, not on the site.

## Becoming a moderator

1. The person makes a normal account on the site.
2. An admin opens them on `/admin/gebruikers` and chooses "Moderator maken".
   It is logged. Admins themselves are set by the owner in SQL (D-016).
3. The new moderator reads this handbook and the moderation policy (approval
   checklist, rejection reasons).
4. First week: the owner checks their decisions in `/admin/logboek`.

Moderators approve, reject, resolve rumours, handle reports, takedowns and
contact messages, and read reported conversations. Suspensions, the verified
badge and the moderator role are admin-only.

## The admin area

| Page | What you do there |
| --- | --- |
| Wachtrij | Approve or reject pending rumours, with a fixed reason the author sees |
| Geruchten | Confirm, deny or close lopende rumours; reopen a wrong decision |
| Transfers | Add, correct or remove official transfers |
| Meldingen | Takedown requests first, then user reports |
| Gebruikers | Look up a user's history; admins suspend, badge and set roles |
| Contact | Messages from the contact form |
| Logboek | Every staff action, kept 2 years (D-011) |

## Response templates

Every note a user or requester reads has a "Sjabloon invoegen" picker: the
rejection note, takedown decisions, report decisions and the suspension
reason. Picking one fills the note, which you can still change.

- Text in **[square brackets]** must be replaced. The confirm button stays
  disabled until it is.
- Write to the person, in plain Dutch. Never name who reported or asked for a
  takedown, and never repeat private details in a note.
- The templates live in `lib/moderation-templates.ts`. Change them there in a
  PR, so the wording stays reviewed.

## Escalate to the owner

- A rumour or report that may be about a minor and isn't clear-cut.
- A legal threat, a lawyer's letter or a police request.
- A takedown request you would reject about a rumour that is not yet
  confirmed and names private matters.
- Anything you are unsure about. Leave it open rather than guess.
