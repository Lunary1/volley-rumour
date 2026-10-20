-- Moderation emails (issue #181, D-037): who gets an email about a new item
-- in the moderation inboxes, and which takedown requesters are emailed the
-- decision, each once, with a second status link. Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(17);

-- A user, a moderator who turned email notifications off, and an admin.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000181a', 'se_gebruiker@example.test', '{"username": "se_test_gebruiker"}'),
  ('00000000-0000-0000-0000-00000000181b', 'se_moderator@example.test', '{"username": "se_test_moderator"}'),
  ('00000000-0000-0000-0000-00000000181c', 'se_admin@example.test', '{"username": "se_test_admin"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000181b';
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-00000000181c';
INSERT INTO public.email_opt_outs (user_id) VALUES ('00000000-0000-0000-0000-00000000181b');

-- Two public rumours.
INSERT INTO public.rumours (id, creator_id, player_name, category, status) VALUES
  ('00000000-0000-0000-0000-0000000181f1', '00000000-0000-0000-0000-00000000181a', 'Mail Test Een', 'transfer', 'rumour'),
  ('00000000-0000-0000-0000-0000000181f2', '00000000-0000-0000-0000-00000000181a', 'Mail Test Twee', 'transfer', 'rumour');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- Files a request the way the server action does.
CREATE FUNCTION pg_temp.submit(rumour uuid, email text) RETURNS text LANGUAGE sql AS $$
  SELECT public.submit_takedown_request(
    rumour, 'self', 'Test Persoon', email, 'Dit gerucht klopt helemaal niet.',
    md5(random()::text) || md5(random()::text), md5(email) || md5(email || '2'));
$$;

-- What a claim returns, kept for the checks below.
CREATE TEMP TABLE claimed (email text, reference text, token text);
GRANT ALL ON claimed TO authenticated;

-- ------------------------------------------------------------ privileges
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.staff_notification_emails()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.staff_notification_emails()', 'EXECUTE'),
  'users cannot list staff addresses');
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.claim_takedown_decision_emails()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.claim_takedown_decision_emails()', 'EXECUTE'),
  'users cannot claim takedown decision emails');
SELECT ok(
  has_function_privilege('service_role', 'public.staff_notification_emails()', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.claim_takedown_decision_emails()', 'EXECUTE'),
  'the service role can do both');
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.takedown_requests', 'email_token_hash', 'SELECT'),
  'nobody reads the second link''s hash through the API');

-- ------------------------------------------------------------ staff
SELECT ok(
  'se_moderator@example.test' IN (SELECT public.staff_notification_emails()),
  'a moderator is emailed, even with notifications turned off on the profile');
SELECT ok(
  'se_admin@example.test' IN (SELECT public.staff_notification_emails()),
  'an admin is emailed');
SELECT ok(
  'se_gebruiker@example.test' NOT IN (SELECT public.staff_notification_emails()),
  'a regular user is not');
SELECT is(
  (SELECT count(*) FROM public.staff_notification_emails()),
  (SELECT count(DISTINCT e) FROM public.staff_notification_emails() AS e),
  'each staff address once');

-- ------------------------------------------------------------ takedown decisions
-- Earlier claims in other tests or seed data don't matter here: start clean.
SELECT count(*) FROM public.claim_takedown_decision_emails();

SELECT pg_temp.submit('00000000-0000-0000-0000-0000000181f1', 'se_een@example.test');
SELECT pg_temp.submit('00000000-0000-0000-0000-0000000181f1', 'se_twee@example.test');
SELECT pg_temp.submit('00000000-0000-0000-0000-0000000181f2', 'se_drie@example.test');

SELECT is(
  (SELECT count(*) FROM public.claim_takedown_decision_emails()),
  0::bigint,
  'open requests get no email');

-- Removing rumour 1 answers both of its requests; rumour 2's is rejected.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000181b');
SELECT public.remove_rumour_for_takedown(
  (SELECT id FROM public.takedown_requests WHERE requester_email = 'se_een@example.test'), NULL);
SELECT public.reject_takedown_request(
  (SELECT id FROM public.takedown_requests WHERE requester_email = 'se_drie@example.test'), 'Klopt wel.');
RESET ROLE;

INSERT INTO claimed SELECT * FROM public.claim_takedown_decision_emails();

SELECT set_eq(
  'SELECT email FROM claimed',
  ARRAY['se_een@example.test', 'se_twee@example.test', 'se_drie@example.test'],
  'every decided request is claimed, also the one answered by another request''s removal');
SELECT ok(
  (SELECT bool_and(c.reference = t.reference) FROM claimed c
     JOIN public.takedown_requests t ON t.requester_email = c.email),
  'with its own reference');
SELECT ok(
  (SELECT bool_and(token ~ '^[A-Za-z0-9_-]{43}$') FROM claimed),
  'the token has the status link''s format');
SELECT is(
  (SELECT count(*) FROM claimed c JOIN public.takedown_requests t
      ON t.email_token_hash = encode(sha256(convert_to(c.token, 'UTF8')), 'hex')
     AND t.requester_email = c.email),
  3::bigint,
  'only the token''s hash is stored, on its own request');
SELECT is(
  (SELECT count(DISTINCT token) FROM claimed),
  3::bigint,
  'every request gets a different token');
SELECT ok(
  (SELECT bool_and(t.token_hash <> t.email_token_hash) FROM public.takedown_requests t
    WHERE t.requester_email IN (SELECT email FROM claimed)),
  'the link from the form keeps its own hash');

SELECT is(
  (SELECT count(*) FROM public.claim_takedown_decision_emails()),
  0::bigint,
  'a decision is emailed once');

-- An anonymised request has no address left to email.
SELECT pg_temp.submit('00000000-0000-0000-0000-0000000181f2', 'se_vier@example.test');
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000181b');
SELECT public.reject_takedown_request(
  (SELECT id FROM public.takedown_requests WHERE requester_email = 'se_vier@example.test'), 'Klopt wel.');
RESET ROLE;
UPDATE public.takedown_requests
   SET requester_name = NULL, requester_email = NULL, explanation = NULL, ip_hash = NULL, anonymised_at = now()
 WHERE requester_email = 'se_vier@example.test';
SELECT is(
  (SELECT count(*) FROM public.claim_takedown_decision_emails()),
  0::bigint,
  'an anonymised request is not emailed');

SELECT * FROM finish();
ROLLBACK;
