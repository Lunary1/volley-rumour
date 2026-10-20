# Rollback runbook — volleyrumours.be

What to do when a release breaks production, from launch (#95) on. Written
for the owner, who holds Vercel, the Supabase dashboard and `db push`; agents
prepare fixes as PRs and never touch production. Background: D-008
(rollback is Vercel Instant Rollback, then fix forward) and D-043 (every
migration keeps the code on `main` working, and is pushed before its PR
merges).

## Pick the response

| Situation | Do this | Section |
| --- | --- | --- |
| The last merge broke a page or a flow; the database is fine | Roll back the code | [1](#1-roll-back-the-code) |
| The site isn't ready for the public at all (launch day) | Close the site again | [2](#2-close-the-site-again) |
| A migration is wrong (bad data written, a policy too open or too strict) | Fix the database forward | [3](#3-fix-the-database) |
| Data leaks to people who shouldn't see it | Close the site first (2), then fix (3) | |

A rollback only ever changes the code. The database stays as it is, which is
why every migration has to keep the previous code working (D-043).

## 1. Roll back the code

1. Vercel → project → production deployment tile → **Instant Rollback**.
2. Pick the deployment to return to and confirm. The switch is instant.
3. Check the broken flow on www.volleyrumours.be.
4. Find the cause and fix it, through a normal `fix/` PR, or revert the bad PR
   through a new PR (`git revert` on a branch).
5. Once the fix is merged and its deployment is ready: **Undo Rollback** on
   the same tile and promote the fixed deployment.

Know before you need it:
- **On the Hobby plan you can only go back one deployment.** Pro can pick any
  earlier production deployment. Merge one thing at a time around launch, so
  "one back" is always the last good state.
- **After a rollback, merges to `main` don't go live** until you click
  **Undo Rollback** (or `vercel promote`). CI and previews still run.
- **The rolled-back deployment keeps the environment variables it was built
  with.** Changing a variable in Vercel doesn't affect it until a new build.

## 2. Close the site again

Coming-soon mode (D-009) closes every route except the homepage and the info
pages. `NEXT_PUBLIC_COMING_SOON` is read at build time, so changing the
variable alone does nothing: the site needs a new build.

- **Fastest, if the launch was the last deployment:** Instant Rollback (section
  1) to the last coming-soon deployment. It was built with
  `NEXT_PUBLIC_COMING_SOON=true`, so the site closes at once.
- **Otherwise:** set `NEXT_PUBLIC_COMING_SOON` to `true` for Production in
  Vercel, then **Redeploy** the current production deployment (a few minutes).
- **Supabase dashboard → Authentication:** turn sign-ups off again, so nobody
  creates an account through the API while the site is closed.
- People who are logged in keep their session but can only reach the open
  pages. Their data stays.
- The waitlist email can't be unsent. If the closure lasts, post a short
  notice on the homepage through a normal PR.

To open again, reverse the steps: variable to `false`, redeploy, sign-ups on.

## 3. Fix the database

Who: the owner applies every change to production. An agent writes the fix
as a migration in a `fix/` PR and never runs SQL against production.

1. If users are affected while you fix it, close the site first (section 2).
2. Write a new migration that corrects the schema or data
   (`npm run db:new -- fix_<what>`). Never edit an applied migration. The
   undo SQL below and in each migration PR's notes is the starting point.
3. Test it locally: `npm run db:reset` and `npm run db:test`.
4. Open the PR. When CI is green, the owner runs `npx supabase db push` from
   the PR branch, then merges (D-043).
5. Don't change the schema in the Supabase SQL editor, even in an emergency.
   The change wouldn't be in `supabase/migrations/`, so the next `db reset`
   and every test run would build a different database than production.
   Correcting a few rows of data by hand is fine. Write down what was changed
   and why, in the PR or the issue.

## Before launch

- [ ] Note which Vercel plan the project is on: Hobby can roll back one step only.
- [ ] Ship the launch (#95) as its own deployment with **no migration** in it,
      so rolling back the launch is one step and touches no data.
- [ ] Write down the deployment URL of the last coming-soon deployment.
- [ ] Check that the owner can log in to Vercel and Supabase from a phone.

## Migration review (#188)

Every migration after the baseline, checked against the question: does the
code from just before it still work against the database after it? Checked
against the code at the parent commit of each PR, on 2026-10-20.

- **Safe**: the old code works; at most it shows something new in a plain way.
- **Degraded**: the old code runs, but something behaves differently.
- **Breaks**: the old code fails on a page or a flow.

| Migration | PR | Rollback | Why |
| --- | --- | --- | --- |
| `20261013130000_tighten_permissions` | #35 | Degraded | Keeps every write the app made, except a user confirming a rumour (X-1), which it closes on purpose |
| `20261014094026_add_staff_check` | #110 | Safe | New function |
| `20261014101116_add_staff_audit_log` | #114 | Safe | New table and functions |
| `20261014112118_hide_staff_roles` | #115 | **Breaks** | Column-level SELECT on `profiles`; the old profile page used `select("*")` |
| `20261014114556_rumours_pending_until_approved` | #116 | Degraded | New rumours from the old form go `pending`, with no queue yet to approve them |
| `20261014122546_moderate_rumours` | #117 | Safe | New columns and functions |
| `20261014145732_rumour_sources_and_pending_cap` | #121 | **Breaks** | The insert trigger needs a source type and both declarations; the old form sent neither, so every new rumour is refused |
| `20261014160718_takedown_requests` | #122 | Safe | New table; status `removed` shows as the raw word on the author's profile |
| `20261014174640_user_reports` | #123 | **Breaks** | Drops `reported_conversations`, which the old report button and account deletion wrote to |
| `20261014193846_user_sanctions` | #124 | Safe | New table, functions and trigger |
| `20261015072309_contact_messages` | #125 | Safe | New table |
| `20261015080113_block_users` | #126 | Safe | Old block insert still allowed; blocked sends get a generic error |
| `20261015093039_classified_gender_and_diploma` | #130 | Safe | New columns; the old form offered the same senior divisions |
| `20261015112454_classified_owner_updates` | #131 | Safe | Policy only refuses edits to removed ads |
| `20261015135308_messages_recipient` | #138 | Safe | `recipient_id` is filled by a trigger |
| `20261016123232_conversation_archives` | #139 | **Breaks** | Drops `conversations.is_archived`; the old inbox filtered on it |
| `20261016224117_vote_integrity` | #140 | Safe | Old code only read its own votes; votes on own or closed rumours get an error |
| `20261017110217_rumour_resolution` | #147 | Safe | New status, columns and functions |
| `20261017115222_contributor_track_record` | #148 | **Breaks** | Drops `trust_score`, `xp`, `level`, `total_votes_received`; Transfer Talk, the inbox and the leaderboard selected them |
| `20261018095649_delete_own_account` | #157 | **Breaks** | `classifieds.user_id` becomes NOT NULL; the old account deletion set it to null and fails halfway |
| `20261018102058_zoekertjes_privacy_and_expiry` | #158 | Safe | `contact_email` was unused by then; contact about offline ads is refused |
| `20261018141947_terms_acceptance` | #159 | Safe | Old code just doesn't ask for the terms |
| `20261018172443_refuse_taken_username` | #164 | Safe | A taken username gets a generic error |
| `20261018181718_avatar_uploads` | #165 | **Breaks** | Renames `avatar_url` to `avatar_path`; the old header and inbox selected `avatar_url` |
| `20261018200436_email_notifications` | #166 | Safe | New table and functions |
| `20261019075657_remove_transfer_with_rumour` | #169 | Safe | Same function signatures |
| `20261019083251_reopen_rumour` | #170 | Safe | New function |
| `20261019091054_drop_transfer_talk` | #171 | Safe | No old screen still created `transfer_talk` conversations |
| `20261019140006_bump_terms_version` | #183 | Degraded | Old code shows the previous terms text but records acceptance of 2026-10-19 |
| `20261020094935_staff_and_takedown_emails` | #184 | Safe | New columns and functions |
| `20261020113616_error_events` | #190 | Safe | New table and function |
| `20261020130343_withdraw_own_rumour` | #193 | Safe | Withdrawn rumours show as "withdrawn" on the author's profile; RLS already hides them from everyone else |

The seven that break are all from the stocktake clean-up, weeks of
deployments back. Nobody will roll back that far: undoing them would mean
restoring dropped data. From now on D-043 keeps every migration in the Safe
column.

### Undo SQL for the latest migrations

The ones a launch-day rollback could reach. Run as a new migration (section 3),
not in the SQL editor.

**#193 `withdraw_own_rumour`.** Withdrawn rumours first need a status the old
check allows. `removed` hides them in the same way:

```sql
UPDATE public.rumours SET status = 'removed' WHERE status = 'withdrawn';
ALTER TABLE public.rumours DROP CONSTRAINT rumours_status_check;
ALTER TABLE public.rumours ADD CONSTRAINT rumours_status_check
  CHECK (status IN ('pending', 'rumour', 'confirmed', 'denied', 'expired', 'rejected', 'removed'));
DROP TRIGGER check_rumour_edit ON public.rumours;
DROP FUNCTION public.check_rumour_edit();
DROP POLICY "Authors edit their own pending rumours" ON public.rumours;
REVOKE UPDATE (player_name, from_club_name, to_club_name, description, category, gender,
  from_division, to_division, source_type, source_url, declared_good_faith, declared_senior)
  ON public.rumours FROM authenticated;
DROP TRIGGER check_account_not_suspended ON public.rumours;
CREATE TRIGGER check_account_not_suspended
  BEFORE INSERT ON public.rumours
  FOR EACH ROW EXECUTE FUNCTION public.check_account_not_suspended();
DROP FUNCTION public.withdraw_rumour(uuid);
DROP FUNCTION public.wipe_withdrawn_rumours();
ALTER TABLE public.rumours DROP COLUMN withdrawn_at, DROP COLUMN anonymised_at;
```

**#190 `error_events`.** Nothing depends on it. Dropping it loses the error
history:

```sql
DROP FUNCTION public.record_error_event(text, text, text, text, text, text);
DROP TABLE public.error_events;
```

**#184 `staff_and_takedown_emails`.** Requesters lose the second status link
that their decision email gave them:

```sql
DROP FUNCTION public.claim_takedown_decision_emails();
DROP FUNCTION public.staff_notification_emails();
ALTER TABLE public.takedown_requests
  DROP COLUMN email_token_hash, DROP COLUMN decision_emailed_at;
```

**#183 `bump_terms_version`.** Only when the code is rolled back past #183.
Users who accepted 2026-10-19 are asked once more on `/welkom`:

```sql
CREATE OR REPLACE FUNCTION public.current_terms_version()
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT '2026-10-18' $$;
```
