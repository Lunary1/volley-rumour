-- Waitlist: sign-ups only go through the server, with a rate limit; the API
-- can't read or write the list (GHSA-9v4r, #271).
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

-- A 64-character hex string, like the app's HMAC hashes.
CREATE FUNCTION pg_temp.hex64(seed text) RETURNS text LANGUAGE sql AS $$
  SELECT md5(seed) || md5(seed || '2');
$$;
GRANT EXECUTE ON FUNCTION pg_temp.hex64(text) TO service_role;

-- ------------------------------------------------------------ who may call
SELECT ok(
  NOT has_function_privilege('anon', 'public.subscribe_to_waitlist(text, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.subscribe_to_waitlist(text, text)', 'EXECUTE'),
  'only the server can subscribe: visitors and users cannot call the function');
SELECT ok(
  NOT has_table_privilege('anon', 'public.waitlist_subscribers', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.waitlist_subscribers', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.waitlist_subscribers', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.waitlist_subscribers', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.waitlist_subscribers', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.waitlist_subscribers', 'DELETE'),
  'nobody reads, changes or deletes the waitlist through the API');
SELECT ok(
  NOT has_any_column_privilege('anon', 'public.waitlist_subscribers', 'INSERT')
  AND NOT has_any_column_privilege('authenticated', 'public.waitlist_subscribers', 'INSERT'),
  'nobody inserts into the waitlist through the API, not even an email');

-- ----------------------------------------------------- no direct insert
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$INSERT INTO public.waitlist_subscribers (email) VALUES ('direct@example.test')$$,
  '42501', NULL, 'a visitor cannot insert an address directly');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO public.waitlist_subscribers (email) VALUES ('direct@example.test')$$,
  '42501', NULL, 'a signed-in user cannot insert an address directly');
RESET ROLE;

-- The table itself refuses anything that is not an address.
SELECT throws_ok(
  $$INSERT INTO public.waitlist_subscribers (email) VALUES ('geen e-mailadres')$$,
  '23514', NULL, 'the waitlist holds only email addresses');

-- --------------------------------------------------------------- subscribe
SET LOCAL ROLE service_role;
SELECT lives_ok(
  $$SELECT public.subscribe_to_waitlist('  nieuw@example.test ', pg_temp.hex64('ip-1'))$$,
  'the server subscribes an address');
SELECT is(
  (SELECT ip_hash FROM public.waitlist_subscribers WHERE email = 'nieuw@example.test'),
  pg_temp.hex64('ip-1'), 'the address is stored trimmed, with the IP hash');
SELECT lives_ok(
  $$SELECT public.subscribe_to_waitlist('NIEUW@example.test', pg_temp.hex64('ip-2'))$$,
  'an address already on the list succeeds silently, in any case');
SELECT is(
  (SELECT count(*)::int FROM public.waitlist_subscribers WHERE lower(email) = 'nieuw@example.test'),
  1, 'and is not added twice');
SELECT throws_ok(
  $$SELECT public.subscribe_to_waitlist('geen e-mailadres', pg_temp.hex64('ip-1'))$$,
  '22023', NULL, 'something that is not an address is refused');
SELECT throws_ok(
  $$SELECT public.subscribe_to_waitlist(repeat('a', 250) || '@example.test', pg_temp.hex64('ip-1'))$$,
  '22023', NULL, 'an address longer than 254 characters is refused');

-- ----------------------------------------------------------------- the limit
SELECT lives_ok(
  $$SELECT public.subscribe_to_waitlist('ploeg-' || n || '@example.test', pg_temp.hex64('ip-ploeg'))
      FROM generate_series(1, 10) n$$,
  'ten teammates on one IP address can sign up in a day');
SELECT throws_ok(
  $$SELECT public.subscribe_to_waitlist('ploeg-11@example.test', pg_temp.hex64('ip-ploeg'))$$,
  'VR002', NULL, 'the eleventh sign-up from that address is refused');
SELECT lives_ok(
  $$SELECT public.subscribe_to_waitlist('ploeg-11@example.test', pg_temp.hex64('ip-ander'))$$,
  'another address can still sign up');
SELECT lives_ok(
  $$SELECT public.subscribe_to_waitlist('lokaal-' || n || '@example.test', NULL)
      FROM generate_series(1, 12) n$$,
  'without an IP hash (local runs) there is no limit');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
