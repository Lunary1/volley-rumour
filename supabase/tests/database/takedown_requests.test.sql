-- Takedown requests: anyone can ask for a rumour's removal through the
-- server, only staff read the requests and decide, and every decision is
-- logged (issue #68, D-014). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(35);

-- An author, another user and a moderator.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000068a', 'td_auteur@example.test', '{"username": "td_test_auteur"}'),
  ('00000000-0000-0000-0000-00000000068b', 'td_ander@example.test', '{"username": "td_test_ander"}'),
  ('00000000-0000-0000-0000-00000000068c', 'td_staff@example.test', '{"username": "td_test_staff"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000068c';

-- Public rumours 1–6, and one still waiting for a moderator.
INSERT INTO public.rumours (id, creator_id, player_name, category, status)
SELECT ('00000000-0000-0000-0000-0000000068f' || n)::uuid, '00000000-0000-0000-0000-00000000068a',
       'Verwijder Test ' || n, 'transfer', 'rumour'
FROM generate_series(1, 6) AS n;
INSERT INTO public.rumours (id, creator_id, player_name, category, status) VALUES
  ('00000000-0000-0000-0000-0000000068f9', '00000000-0000-0000-0000-00000000068a', 'Nog Niet Openbaar', 'transfer', 'pending');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- A 64-character hex string, like the app's SHA-256 and HMAC hashes.
CREATE FUNCTION pg_temp.hex64(seed text) RETURNS text LANGUAGE sql AS $$
  SELECT md5(seed) || md5(seed || '2');
$$;

-- Submits a request the way the server action does, with a fresh token.
CREATE FUNCTION pg_temp.submit(rumour int, email text, ip text DEFAULT 'ip-1') RETURNS text LANGUAGE sql AS $$
  SELECT public.submit_takedown_request(
    ('00000000-0000-0000-0000-0000000068f' || rumour)::uuid, 'self', 'Test Persoon', email,
    'Dit gerucht klopt helemaal niet.', pg_temp.hex64(random()::text), pg_temp.hex64(ip));
$$;
GRANT EXECUTE ON FUNCTION pg_temp.hex64(text) TO service_role;
GRANT EXECUTE ON FUNCTION pg_temp.submit(int, text, text) TO service_role;

-- ------------------------------------------------------------ who may submit
SELECT ok(
  NOT has_function_privilege('anon', 'public.submit_takedown_request(uuid, text, text, text, text, text, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.submit_takedown_request(uuid, text, text, text, text, text, text)', 'EXECUTE'),
  'only the server can submit a request: visitors and users cannot call the function');
SELECT ok(
  NOT has_table_privilege('anon', 'public.takedown_requests', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.takedown_requests', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.takedown_requests', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.takedown_requests', 'DELETE'),
  'nobody writes requests through the API');

-- ------------------------------------------------------------------ submit
SET LOCAL ROLE service_role;
SELECT matches(
  pg_temp.submit(1, 'persoon@example.test'),
  '^VR-[2-9A-Z]{6}$', 'a request gets a reference like VR-7K3M9Q');
SELECT is(
  (SELECT rumour_id FROM public.takedown_requests WHERE requester_email = 'persoon@example.test'),
  '00000000-0000-0000-0000-0000000068f1'::uuid, 'the request stores the rumour and the email');
SELECT is(
  (SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000068f1'),
  'rumour', 'the rumour stays visible until a moderator decides (D-014)');
SELECT throws_ok(
  $$SELECT pg_temp.submit(1, 'Persoon@Example.test ')$$,
  'VR003', NULL, 'one open request per email per rumour, whatever the case');
SELECT throws_ok(
  $$SELECT pg_temp.submit(9, 'persoon@example.test')$$,
  'P0002', NULL, 'a rumour that is not public cannot be the subject of a request');
SELECT throws_ok(
  $$SELECT public.submit_takedown_request('00000000-0000-0000-0000-0000000068f2', 'neighbour',
      'Test Persoon', 'buur@example.test', 'Dit gerucht klopt niet.', pg_temp.hex64('t'), NULL)$$,
  '23514', NULL, 'the relation comes from the fixed list');
SELECT throws_ok(
  $$SELECT public.submit_takedown_request('00000000-0000-0000-0000-0000000068f2', 'self',
      'Test Persoon', 'kort@example.test', 'Kort', pg_temp.hex64('t'), NULL)$$,
  '23514', NULL, 'the explanation needs at least 10 characters');

-- At most 3 requests per email per day ...
SELECT pg_temp.submit(2, 'veel@example.test', 'ip-veel');
SELECT pg_temp.submit(3, 'veel@example.test', 'ip-veel');
SELECT lives_ok(
  $$SELECT pg_temp.submit(4, 'veel@example.test', 'ip-veel')$$,
  'a third request from one email on one day is accepted');
SELECT throws_ok(
  $$SELECT pg_temp.submit(5, 'VEEL@example.test', 'ip-ander')$$,
  'VR002', NULL, 'a fourth request from one email on one day is refused');

-- ... and 5 per IP address.
SELECT pg_temp.submit(2, 'a@example.test', 'ip-druk');
SELECT pg_temp.submit(2, 'b@example.test', 'ip-druk');
SELECT pg_temp.submit(2, 'c@example.test', 'ip-druk');
SELECT pg_temp.submit(2, 'd@example.test', 'ip-druk');
SELECT lives_ok(
  $$SELECT pg_temp.submit(2, 'e@example.test', 'ip-druk')$$,
  'a fifth request from one IP address on one day is accepted');
SELECT throws_ok(
  $$SELECT pg_temp.submit(2, 'f@example.test', 'ip-druk')$$,
  'VR002', NULL, 'a sixth request from one IP address on one day is refused');
RESET ROLE;

-- A request id for the checks below, looked up before switching roles.
SELECT set_config('td.persoon',
  (SELECT id::text FROM public.takedown_requests WHERE requester_email = 'persoon@example.test'), true);

-- ------------------------------------------------------------- who may read
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT id FROM public.takedown_requests$$,
  '42501', NULL, 'visitors cannot read requests');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000068b');
SELECT is(
  (SELECT count(*)::int FROM public.takedown_requests), 0,
  'a user cannot read requests');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000068c');
SELECT is(
  (SELECT requester_name FROM public.takedown_requests WHERE requester_email = 'persoon@example.test'),
  'Test Persoon', 'staff read requests, with the requester''s details');
SELECT throws_ok(
  $$SELECT token_hash FROM public.takedown_requests$$,
  '42501', NULL, 'not even staff can read the token hash');
SELECT throws_ok(
  $$SELECT ip_hash FROM public.takedown_requests$$,
  '42501', NULL, 'not even staff can read the IP hash');
RESET ROLE;

-- ------------------------------------------------------------ who may decide
SELECT ok(
  NOT has_function_privilege('anon', 'public.remove_rumour_for_takedown(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.reject_takedown_request(uuid, text)', 'EXECUTE'),
  'visitors cannot call the decision functions');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000068a');
SELECT throws_ok(
  $$SELECT public.remove_rumour_for_takedown(current_setting('td.persoon')::uuid)$$,
  '42501', NULL, 'a user cannot remove a rumour through a request');
SELECT throws_ok(
  $$SELECT public.reject_takedown_request(current_setting('td.persoon')::uuid, 'Nee')$$,
  '42501', NULL, 'a user cannot reject a request');
RESET ROLE;

-- ------------------------------------------------------------------ remove
-- Rumour 2 has six open requests (veel@ and a@ … e@); removing it answers all.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000068c');
SELECT lives_ok(
  format('SELECT public.remove_rumour_for_takedown(%L, %L)',
    (SELECT id FROM public.takedown_requests WHERE requester_email = 'a@example.test'),
    'Verwijderd op vraag van de speler.'),
  'a moderator can remove the rumour of an open request');
SELECT is(
  (SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000068f2'),
  'removed', 'the rumour is removed');
SELECT is(
  (SELECT count(*)::int FROM public.takedown_requests
    WHERE rumour_id = '00000000-0000-0000-0000-0000000068f2'
      AND status = 'removed' AND decision_note = 'Verwijderd op vraag van de speler.'),
  6, 'every open request about the rumour gets the same decision');
SELECT results_eq(
  $$SELECT actor_id, action, target_type, jsonb_array_length(details -> 'takedown_requests')
      FROM public.staff_actions WHERE target_id = '00000000-0000-0000-0000-0000000068f2'$$,
  $$VALUES ('00000000-0000-0000-0000-00000000068c'::uuid, 'content_removed', 'rumour', 6)$$,
  'the removal is logged once, with every request it answered');
SELECT throws_ok(
  format('SELECT public.remove_rumour_for_takedown(%L)',
    (SELECT id FROM public.takedown_requests WHERE requester_email = 'a@example.test')),
  'P0002', NULL, 'a request cannot be decided twice');
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000068f2'), 0,
  'visitors no longer see the removed rumour');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000068a');
SELECT is(
  (SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000068f2'),
  'removed', 'the author still sees their rumour, as removed');
RESET ROLE;

-- ------------------------------------------------------------------ reject
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000068c');
SELECT throws_ok(
  format('SELECT public.reject_takedown_request(%L, %L)',
    (SELECT id FROM public.takedown_requests WHERE requester_email = 'persoon@example.test'), '  '),
  '22023', NULL, 'a rejection needs a note for the requester');
SELECT lives_ok(
  format('SELECT public.reject_takedown_request(%L, %L)',
    (SELECT id FROM public.takedown_requests WHERE requester_email = 'persoon@example.test'),
    'De bron is een officieel clubbericht.'),
  'a moderator can reject a request');
SELECT is(
  (SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000068f1'),
  'rumour', 'a rejected request leaves the rumour visible');
SELECT results_eq(
  $$SELECT a.action, a.target_type, a.reason FROM public.staff_actions a
      JOIN public.takedown_requests r ON r.id = a.target_id
     WHERE r.requester_email = 'persoon@example.test'$$,
  $$SELECT 'takedown_rejected'::text, 'takedown_request'::text,
           'Verwijderverzoek ' || reference || ' afgewezen: De bron is een officieel clubbericht.'
      FROM public.takedown_requests WHERE requester_email = 'persoon@example.test'$$,
  'the rejection is logged with the note');
RESET ROLE;

-- --------------------------------------------------------------- retention
-- Make the rejected request and one still-open request 13 months old.
UPDATE public.takedown_requests SET created_at = now() - interval '13 months'
 WHERE requester_email = 'persoon@example.test'
    OR (requester_email = 'veel@example.test' AND rumour_id = '00000000-0000-0000-0000-0000000068f3');

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.anonymise_expired_takedown_requests()', 'EXECUTE'),
  'users cannot run the retention function');
SELECT is(
  public.anonymise_expired_takedown_requests(), 1,
  'decided requests older than 12 months are anonymised; open ones wait for a decision');
SELECT results_eq(
  $$SELECT requester_name, requester_email, explanation, ip_hash, status, anonymised_at IS NOT NULL
      FROM public.takedown_requests WHERE reference IN (
        SELECT reference FROM public.takedown_requests
         WHERE status = 'rejected' AND created_at < now() - interval '12 months')$$,
  $$VALUES (NULL::text, NULL::text, NULL::text, NULL::text, 'rejected'::text, true)$$,
  'anonymising wipes the personal fields and keeps the decision');

SELECT * FROM finish();
ROLLBACK;
