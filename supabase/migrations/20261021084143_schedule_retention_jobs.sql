-- Run the retention functions every night with pg_cron (issue #202).
--
-- The privacy page promises these periods; the functions already exist but
-- nothing ran them:
--   wipe_withdrawn_rumours()               12 months after withdrawal (D-042)
--   anonymise_expired_takedown_requests()  12 months after the request (D-014)
--   anonymise_expired_contact_messages()   12 months after handling (D-017)
--   purge_expired_staff_actions()          2 years (D-011)
--
-- The jobs run inside the database as postgres, which owns these SECURITY
-- DEFINER functions, so nothing new is granted to the API roles. pg_cron uses
-- UTC: 02:00-02:20 UTC is 03:00-04:20 in Belgium.
--
-- Undo:
--   SELECT cron.unschedule(jobname) FROM cron.job
--    WHERE jobname IN ('wipe-withdrawn-rumours', 'anonymise-takedown-requests',
--                      'anonymise-contact-messages', 'purge-staff-actions',
--                      'trim-cron-history');
-- (and DROP EXTENSION pg_cron if no other job uses it).

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- cron.schedule() with an existing name updates that job, so this is safe to
-- run again.
SELECT cron.schedule('wipe-withdrawn-rumours', '0 2 * * *',
  'SELECT public.wipe_withdrawn_rumours()');
SELECT cron.schedule('anonymise-takedown-requests', '5 2 * * *',
  'SELECT public.anonymise_expired_takedown_requests()');
SELECT cron.schedule('anonymise-contact-messages', '10 2 * * *',
  'SELECT public.anonymise_expired_contact_messages()');
SELECT cron.schedule('purge-staff-actions', '15 2 * * *',
  'SELECT public.purge_expired_staff_actions()');

-- pg_cron keeps a row per run in cron.job_run_details and never removes it.
-- Keep 90 days: enough to check that the jobs ran.
SELECT cron.schedule('trim-cron-history', '20 2 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '90 days'$$);
