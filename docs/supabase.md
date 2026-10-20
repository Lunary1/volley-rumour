# Supabase in production — plan, limits, backups

Which Supabase plan production runs on, what it can carry during the spring
transfer window, and how to restore the database. Written for the owner, who
holds the Supabase and Vercel dashboards (#187). Rolling back a release:
[`rollback.md`](rollback.md).

## Production at a glance

Checked 2026-10-20 through the linked Supabase CLI (`projects list`,
`backups list`), read-only.

| | |
| --- | --- |
| Project | `supabase-violet-zebra` (ref `qaejtjgfkggcbgajmfcn`) |
| Region | eu-west-3 (Paris) |
| Postgres | 17.6 |
| Organisation | Created through the Vercel integration: plan and billing are managed from Vercel |
| Plan | **Free** (owner, 2026-10-13) |
| Backups | **None.** No daily backups, PITR off. Free projects get no backups |
| Auth email | Sent through Resend SMTP as `info@volleyrumours.be` |
| Resend plan | **Free**: 3,000 emails a month, **100 a day** (owner, 2026-10-20) |

## Expected peak

The owner expects a small peak: **under 500 visitors a day** during the
window, tens of people logged in at the same time (2026-10-20).

| Limit | Free | Pro ($25/month) | Our peak | Fits? |
| --- | --- | --- | --- | --- |
| Backups | none | daily, kept 7 days | — | **No: Pro before launch (D-044)** |
| Pausing | after 1 week without activity | never | live traffic every day | Yes, once open |
| Database size | 500 MB | 8 GB | a few MB today | Yes |
| File storage (avatars) | 1 GB | 100 GB | 400×400 WebP, ~30 KB each | Yes |
| Egress | 5 GB/month | 250 GB/month | pages are server-rendered on Vercel; avatars are small | Yes; watch it in the usage page |
| Monthly active users | 50,000 | 100,000 | hundreds | Yes |
| Realtime connections at once | 200 | 500 | one per open tab of a logged-in user (unread badge, chat) | Yes |
| Compute | shared, 500 MB RAM | Micro, 1 GB RAM | local p95 < 60 ms with 500 rows (#96) | Yes |
| Auth emails (sign-up, reset) | 30/hour by default with custom SMTP | same | a burst after the launch email | **Raise for launch week** |
| Resend | 100/day on Free | — | Auth + notifications + moderation + the launch email | **Upgrade for launch month** |

Database connections aren't a limit for us: the app reaches the database
through the Data API (PostgREST), which pools its own connections.

## D-044 — Pro from a week before launch

Production moves to the Pro plan a week before #95, and stays on it.

- Daily backups kept 7 days, restored from the dashboard.
- No pausing, and the spend cap stays on, so usage can't run up a bill.
- Leaked-password protection becomes available (R-11): turn it on.
- Point-in-time recovery stays off. It costs about $100/month on top of Pro
  and needs a bigger compute size; losing up to a day of data is acceptable
  at this size.

Until the upgrade, production has no backups. The data in it is the
waitlist and test accounts; the owner accepts that risk until then.

## Launch checklist

**A week before #95 (owner):**
- [ ] Upgrade to Pro. The organisation is managed by Vercel, so this is in
      Vercel (Integrations / Storage → Supabase → plan) rather than in
      Supabase's own billing page.
- [ ] Next day: Supabase → Database → Backups shows a first daily backup.
- [ ] Authentication → turn on leaked-password protection (R-11).
- [ ] Try a restore once (below), if the dashboard offers a restore to a new
      project.
- [ ] Count the waitlist (`waitlist_subscribers`) in the Table Editor.
- [ ] If the waitlist plus the expected sign-ups go over ~80 emails a day,
      upgrade Resend to Pro ($20/month, no daily limit) for the launch month.
      Otherwise the launch email is sent in daily batches under 100.

**On launch day (owner):**
- [ ] Authentication → Rate limits: emails sent per hour from 30 to 100, for
      the first week.
- [ ] Authentication → sign-ups on (part of #95).

**After the window:**
- [ ] Auth email rate limit back to 30/hour.
- [ ] Resend back to Free if the month's volume allows it.
- [ ] Look at the usage page (egress, Realtime peak, database size) and note
      the numbers here, to plan the next window.

## Restoring the database

A restore is the last resort, when data is lost or damaged and a fix-forward
migration ([`rollback.md`](rollback.md), section 3) can't repair it. It
needs Pro.

Who: the owner, the only one with access to the Supabase organisation.

1. Close the site (`rollback.md`, section 2). The project is unreachable
   during the restore anyway, and the restore throws away everything written
   after the backup.
2. Supabase → Database → Backups → Scheduled backups → pick the day → Restore.
   It takes longer the bigger the database is.
3. Migrations pushed after that backup are gone too: run
   `npx supabase db push` from `main` to apply them again.
4. Files in Storage (profile pictures) aren't part of a database backup. A
   picture uploaded after the backup stays in the bucket without a profile
   pointing at it; a picture deleted after the backup is missing, so that
   profile shows a broken or empty picture until the user uploads a new one.
5. Check the site, then open it again.
6. Tell users if accounts, zoekertjes or messages from after the backup were
   lost. If personal data was lost or exposed, it may be a data breach to
   report to the GBA within 72 hours.

**Trying it once.** After the upgrade, check whether Backups offers
**Restore to a new project**. If it does, restore the latest backup into a new
project, check that the tables and row counts look right, then delete that
project. It contains production's personal data, so don't connect anything to
it, and delete it the same day.
