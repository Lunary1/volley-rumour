-- Contact messages: anyone can send one through the server, only staff read
-- and handle them, and handling is logged (issue #81, D-017). Run with
-- `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(28);

-- A user, a suspended user and a moderator.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000081a', 'cm_user@example.test', '{"username": "cm_test_user"}'),
  ('00000000-0000-0000-0000-00000000081b', 'cm_geschorst@example.test', '{"username": "cm_test_geschorst"}'),
  ('00000000-0000-0000-0000-00000000081c', 'cm_staff@example.test', '{"username": "cm_test_staff"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000081c';
INSERT INTO public.user_suspensions (user_id, suspended_until, reason)
VALUES ('00000000-0000-0000-0000-00000000081b', NULL, 'Test');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- A 64-character hex string, like the app's HMAC hashes.
CREATE FUNCTION pg_temp.hex64(seed text) RETURNS text LANGUAGE sql AS $$
  SELECT md5(seed) || md5(seed || '2');
$$;

-- Sends a message the way the server action does.
CREATE FUNCTION pg_temp.send(email text, ip text DEFAULT 'ip-1', sender uuid DEFAULT NULL) RETURNS uuid LANGUAGE sql AS $$
  SELECT public.submit_contact_message(
    'question', 'Test Afzender', email, 'Hoe werkt een zoekertje plaatsen?', sender, pg_temp.hex64(ip));
$$;
GRANT EXECUTE ON FUNCTION pg_temp.hex64(text) TO service_role;
GRANT EXECUTE ON FUNCTION pg_temp.send(text, text, uuid) TO service_role;

-- ------------------------------------------------------------ who may send
SELECT ok(
  NOT has_function_privilege('anon', 'public.submit_contact_message(text, text, text, text, uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.submit_contact_message(text, text, text, text, uuid, text)', 'EXECUTE'),
  'only the server can send a message: visitors and users cannot call the function');
SELECT ok(
  NOT has_table_privilege('anon', 'public.contact_messages', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.contact_messages', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.contact_messages', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.contact_messages', 'DELETE'),
  'nobody writes messages through the API');

-- -------------------------------------------------------------------- send
SET LOCAL ROLE service_role;
SELECT lives_ok(
  $$SELECT pg_temp.send('afzender@example.test')$$,
  'a visitor can send a message');
SELECT is(
  (SELECT status FROM public.contact_messages WHERE sender_email = 'afzender@example.test'),
  'open', 'a new message is open');
SELECT lives_ok(
  $$SELECT pg_temp.send('geschorst@example.test', 'ip-geschorst', '00000000-0000-0000-0000-00000000081b')$$,
  'a suspended user can still send a message: it is how they appeal (D-017)');
SELECT is(
  (SELECT user_id FROM public.contact_messages WHERE sender_email = 'geschorst@example.test'),
  '00000000-0000-0000-0000-00000000081b'::uuid, 'the message keeps the sender''s account');
SELECT throws_ok(
  $$SELECT public.submit_contact_message('abuse', 'Test Afzender', 'cat@example.test',
      'Dit is een testbericht.', NULL, NULL)$$,
  '23514', NULL, 'the category comes from the fixed list');
SELECT throws_ok(
  $$SELECT public.submit_contact_message('other', 'Test Afzender', 'kort@example.test', 'Kort', NULL, NULL)$$,
  '23514', NULL, 'the message needs at least 10 characters');

-- At most 3 messages per email per day ...
SELECT pg_temp.send('veel@example.test', 'ip-veel');
SELECT pg_temp.send('veel@example.test', 'ip-veel');
SELECT lives_ok(
  $$SELECT pg_temp.send('veel@example.test', 'ip-veel')$$,
  'a third message from one email on one day is accepted');
SELECT throws_ok(
  $$SELECT pg_temp.send('VEEL@example.test ', 'ip-ander')$$,
  'VR002', NULL, 'a fourth message from one email on one day is refused, whatever the case');

-- ... and 5 per IP address.
SELECT pg_temp.send('a@example.test', 'ip-druk');
SELECT pg_temp.send('b@example.test', 'ip-druk');
SELECT pg_temp.send('c@example.test', 'ip-druk');
SELECT pg_temp.send('d@example.test', 'ip-druk');
SELECT lives_ok(
  $$SELECT pg_temp.send('e@example.test', 'ip-druk')$$,
  'a fifth message from one IP address on one day is accepted');
SELECT throws_ok(
  $$SELECT pg_temp.send('f@example.test', 'ip-druk')$$,
  'VR002', NULL, 'a sixth message from one IP address on one day is refused');
RESET ROLE;

SELECT set_config('cm.afzender',
  (SELECT id::text FROM public.contact_messages WHERE sender_email = 'afzender@example.test'), true);

-- ------------------------------------------------------------- who may read
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT id FROM public.contact_messages$$,
  '42501', NULL, 'visitors cannot read messages');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000081b');
SELECT is(
  (SELECT count(*)::int FROM public.contact_messages), 0,
  'a user cannot read messages, not even their own');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000081c');
SELECT is(
  (SELECT sender_name FROM public.contact_messages WHERE id = current_setting('cm.afzender')::uuid),
  'Test Afzender', 'staff read messages, with the sender''s details');
SELECT throws_ok(
  $$SELECT ip_hash FROM public.contact_messages$$,
  '42501', NULL, 'not even staff can read the IP hash');
RESET ROLE;

-- ------------------------------------------------------------ who may handle
SELECT ok(
  NOT has_function_privilege('anon', 'public.handle_contact_message(uuid, text)', 'EXECUTE'),
  'visitors cannot call the handle function');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000081a');
SELECT throws_ok(
  $$SELECT public.handle_contact_message(current_setting('cm.afzender')::uuid)$$,
  '42501', NULL, 'a user cannot handle a message');
RESET ROLE;

-- ------------------------------------------------------------------ handle
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000081c');
SELECT lives_ok(
  $$SELECT public.handle_contact_message(current_setting('cm.afzender')::uuid, '  Beantwoord per mail.  ')$$,
  'a moderator can mark a message handled');
SELECT results_eq(
  $$SELECT status, handled_note, handled_at IS NOT NULL FROM public.contact_messages
     WHERE id = current_setting('cm.afzender')::uuid$$,
  $$VALUES ('handled'::text, 'Beantwoord per mail.'::text, true)$$,
  'the message is handled, with the trimmed note');
SELECT results_eq(
  $$SELECT actor_id, action, target_type, reason, details ->> 'category'
      FROM public.staff_actions WHERE target_id = current_setting('cm.afzender')::uuid$$,
  $$VALUES ('00000000-0000-0000-0000-00000000081c'::uuid, 'contact_handled', 'contact_message',
            'Beantwoord per mail.', 'question')$$,
  'handling is logged with the note and the category');
SELECT throws_ok(
  $$SELECT public.handle_contact_message(current_setting('cm.afzender')::uuid)$$,
  'P0002', NULL, 'a message cannot be handled twice');
SELECT lives_ok(
  format('SELECT public.handle_contact_message(%L)',
    (SELECT id FROM public.contact_messages WHERE sender_email = 'a@example.test')),
  'the note is optional');
SELECT is(
  (SELECT reason FROM public.staff_actions
    WHERE target_id = (SELECT id FROM public.contact_messages WHERE sender_email = 'a@example.test')),
  NULL, 'without a note the log entry has no reason');
RESET ROLE;

-- --------------------------------------------------------------- retention
-- Handled 13 months ago, handled a month ago, and open for 13 months.
UPDATE public.contact_messages
   SET created_at = now() - interval '14 months', handled_at = now() - interval '13 months'
 WHERE id = current_setting('cm.afzender')::uuid;
UPDATE public.contact_messages
   SET created_at = now() - interval '14 months', handled_at = now() - interval '1 month'
 WHERE sender_email = 'a@example.test';
UPDATE public.contact_messages SET created_at = now() - interval '13 months'
 WHERE sender_email = 'geschorst@example.test';

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.anonymise_expired_contact_messages()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.anonymise_expired_contact_messages()', 'EXECUTE'),
  'users cannot run the retention function');
SELECT is(
  public.anonymise_expired_contact_messages(), 1,
  'only messages handled more than 12 months ago are anonymised; open ones wait');
SELECT results_eq(
  $$SELECT sender_name, sender_email, message, user_id, ip_hash, handled_note, status, category
      FROM public.contact_messages WHERE id = current_setting('cm.afzender')::uuid$$,
  $$VALUES (NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text, 'handled'::text, 'question'::text)$$,
  'anonymising wipes the personal fields and keeps category and status');
SELECT is(
  (SELECT sender_email FROM public.contact_messages WHERE sender_email = 'geschorst@example.test'),
  'geschorst@example.test', 'an old open message keeps its details until it is handled');

SELECT * FROM finish();
ROLLBACK;
