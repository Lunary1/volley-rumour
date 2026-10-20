-- Error monitoring (issue #186, D-041): who can read and write error_events,
-- how occurrences group, when an alert is due and the caps that stop a flood.
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(17);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000186a', 'ee_gebruiker@example.test', '{"username": "ee_test_gebruiker"}'),
  ('00000000-0000-0000-0000-00000000186b', 'ee_moderator@example.test', '{"username": "ee_test_moderator"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000186b';

-- Start from an empty table, so the hourly caps only count this test's rows.
DELETE FROM public.error_events;

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- A fingerprint from a short label, the way the app hashes its own.
CREATE FUNCTION pg_temp.fp(label text) RETURNS text LANGUAGE sql AS $$
  SELECT encode(sha256(convert_to(label, 'UTF8')), 'hex');
$$;

CREATE FUNCTION pg_temp.record(label text) RETURNS boolean LANGUAGE sql AS $$
  SELECT public.record_error_event(pg_temp.fp(label), 'server', 'render', '/geruchten', 'Fout ' || label, 'digest-' || label);
$$;

-- ------------------------------------------------------------ privileges
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.record_error_event(text, text, text, text, text, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.record_error_event(text, text, text, text, text, text)', 'EXECUTE'),
  'users cannot record errors through the API');
SELECT ok(
  has_function_privilege('service_role', 'public.record_error_event(text, text, text, text, text, text)', 'EXECUTE'),
  'the service role can');
SELECT ok(
  NOT has_table_privilege('anon', 'public.error_events', 'SELECT'),
  'anonymous visitors cannot read errors');
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.error_events', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.error_events', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.error_events', 'DELETE'),
  'nobody writes errors directly');

-- ------------------------------------------------------------ grouping and alerts
SELECT is(pg_temp.record('a'), true, 'a new error is alerted');
SELECT is(pg_temp.record('a'), false, 'the same error again within the hour is not');
SELECT is(
  (SELECT count FROM public.error_events WHERE fingerprint = pg_temp.fp('a')), 2,
  'both occurrences count on one row');

UPDATE public.error_events
   SET last_seen_at = now() - interval '2 hours', alerted_at = now() - interval '2 hours'
 WHERE fingerprint = pg_temp.fp('a');
SELECT is(pg_temp.record('a'), true, 'an error back after a quiet hour is alerted again');
SELECT is(
  (SELECT last_seen_at FROM public.error_events WHERE fingerprint = pg_temp.fp('a')), now(),
  'last seen moves to now');

SELECT throws_ok(
  $$SELECT public.record_error_event(pg_temp.fp('x'), 'server', 'cron', '/', 'Fout', NULL)$$,
  '23514', NULL, 'an unknown kind is refused');

-- ------------------------------------------------------------ reading
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000186a');
SELECT is((SELECT count(*) FROM public.error_events)::int, 0, 'a user sees no errors');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000186b');
SELECT is((SELECT count(*) FROM public.error_events)::int, 1, 'a moderator sees them');
RESET ROLE;

-- ------------------------------------------------------------ caps
-- 'a' used 1 of the 10 alerts this hour; 9 more new errors use the rest.
SELECT is(
  (SELECT count(*) FROM generate_series(1, 9) i WHERE pg_temp.record('b' || i))::int, 9,
  'nine more new errors are alerted');
SELECT is(pg_temp.record('c'), false, 'the eleventh alert in an hour is not sent');
SELECT ok(
  EXISTS (SELECT 1 FROM public.error_events WHERE fingerprint = pg_temp.fp('c') AND alerted_at IS NULL),
  'but the error is stored');

-- 11 new errors so far this hour; 89 more reach the cap of 100.
SELECT pg_temp.record('d' || i) FROM generate_series(1, 89) i;
SELECT pg_temp.record('e');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.error_events WHERE fingerprint = pg_temp.fp('e')),
  'the 101st new error in an hour is not stored');

-- ------------------------------------------------------------ retention
UPDATE public.error_events SET last_seen_at = now() - interval '91 days'
 WHERE fingerprint = pg_temp.fp('b1');
SELECT pg_temp.record('a');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.error_events WHERE fingerprint = pg_temp.fp('b1')),
  'an error not seen for 90 days is deleted');

SELECT * FROM finish();
ROLLBACK;
