-- The retention functions run every night with pg_cron (issue #202). What each
-- function wipes is tested with the function; this checks the schedule and
-- that each job's command runs. Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(11);

SELECT has_extension('pg_cron', 'pg_cron is installed');

-- --------------------------------------------------------------- schedule
SELECT results_eq(
  $$SELECT jobname::text, schedule::text, command::text, username::text, active
      FROM cron.job
     WHERE jobname IN ('wipe-withdrawn-rumours', 'anonymise-takedown-requests',
                       'anonymise-contact-messages', 'purge-staff-actions',
                       'trim-cron-history')
     ORDER BY jobid$$,
  $$VALUES
    ('wipe-withdrawn-rumours', '0 2 * * *', 'SELECT public.wipe_withdrawn_rumours()', 'postgres', true),
    ('anonymise-takedown-requests', '5 2 * * *', 'SELECT public.anonymise_expired_takedown_requests()', 'postgres', true),
    ('anonymise-contact-messages', '10 2 * * *', 'SELECT public.anonymise_expired_contact_messages()', 'postgres', true),
    ('purge-staff-actions', '15 2 * * *', 'SELECT public.purge_expired_staff_actions()', 'postgres', true),
    ('trim-cron-history', '20 2 * * *', 'DELETE FROM cron.job_run_details WHERE end_time < now() - interval ''90 days''', 'postgres', true)$$,
  'the four retention functions and the history trim run every night as postgres'
);

SELECT ok(
  NOT has_schema_privilege('anon', 'cron', 'USAGE')
  AND NOT has_schema_privilege('authenticated', 'cron', 'USAGE'),
  'visitors and users cannot reach the cron schema');

-- ------------------------------------------------------- the commands run
-- A rumour withdrawn 13 months ago, for the wipe job to find.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000202a', 'ret_auteur@example.test', '{"username": "retentie_test_auteur"}');
INSERT INTO public.rumours (id, creator_id, player_name, category, status,
                            from_club_name, to_club_name, description, withdrawn_at) VALUES
  ('00000000-0000-0000-0000-0000000202f0', '00000000-0000-0000-0000-00000000202a', 'Oud Ingetrokken', 'transfer', 'withdrawn',
   'Club A', 'Club B', 'Lang geleden', now() - interval '13 months');

-- A finished run 100 days ago and one from yesterday.
INSERT INTO cron.job_run_details (jobid, runid, job_pid, database, username, command, status, start_time, end_time)
SELECT jobid, -1, 0, 'postgres', 'postgres', command, 'succeeded', now() - interval '100 days', now() - interval '100 days'
  FROM cron.job WHERE jobname = 'wipe-withdrawn-rumours';
INSERT INTO cron.job_run_details (jobid, runid, job_pid, database, username, command, status, start_time, end_time)
SELECT jobid, -2, 0, 'postgres', 'postgres', command, 'succeeded', now() - interval '1 day', now() - interval '1 day'
  FROM cron.job WHERE jobname = 'wipe-withdrawn-rumours';

SELECT lives_ok((SELECT command FROM cron.job WHERE jobname = 'wipe-withdrawn-rumours'),
  'the wipe job runs');
SELECT lives_ok((SELECT command FROM cron.job WHERE jobname = 'anonymise-takedown-requests'),
  'the takedown job runs');
SELECT lives_ok((SELECT command FROM cron.job WHERE jobname = 'anonymise-contact-messages'),
  'the contact message job runs');
SELECT lives_ok((SELECT command FROM cron.job WHERE jobname = 'purge-staff-actions'),
  'the staff log job runs');
SELECT lives_ok((SELECT command FROM cron.job WHERE jobname = 'trim-cron-history'),
  'the history trim runs');

SELECT is(
  (SELECT row(player_name, description, anonymised_at IS NOT NULL)::text
     FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000202f0'),
  '("Ingetrokken gerucht",,t)', 'the wipe job wiped the old withdrawn rumour');
SELECT ok(NOT EXISTS (SELECT 1 FROM cron.job_run_details WHERE runid = -1),
  'the history trim removes runs older than 90 days');
SELECT ok(EXISTS (SELECT 1 FROM cron.job_run_details WHERE runid = -2),
  'and keeps recent ones');

SELECT * FROM finish();
ROLLBACK;
