-- Every message names its recipient, set by the database, so the unread
-- badge can subscribe to Realtime with a server-side filter (issue #74, X-5).
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);

-- The ad owner, the user who answered, and an outsider.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000074a', 'rc_eigenaar@example.test', '{"username": "rc_test_eigenaar"}'),
  ('00000000-0000-0000-0000-00000000074b', 'rc_reageerder@example.test', '{"username": "rc_test_reageerder"}'),
  ('00000000-0000-0000-0000-00000000074c', 'rc_ander@example.test', '{"username": "rc_test_ander"}');
INSERT INTO public.classifieds (id, user_id, type, title, contact_name) VALUES
  ('00000000-0000-0000-0000-0000000074e1', '00000000-0000-0000-0000-00000000074a', 'team_seeks_player', 'Ontvanger', 'Eigenaar');
INSERT INTO public.conversations (id, ad_id, ad_type, initiator_id, recipient_id) VALUES
  ('00000000-0000-0000-0000-0000000074c1', '00000000-0000-0000-0000-0000000074e1', 'classified',
   '00000000-0000-0000-0000-00000000074b', '00000000-0000-0000-0000-00000000074a');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

SELECT col_not_null('public', 'messages', 'recipient_id', 'every message has a recipient');
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.messages', 'recipient_id', 'INSERT')
  AND NOT has_column_privilege('authenticated', 'public.messages', 'recipient_id', 'UPDATE'),
  'users cannot set or change the recipient');
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.set_message_recipient()', 'EXECUTE'),
  'the trigger function is not callable through the API');

-- The initiator writes: the ad owner receives it.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000074b');
INSERT INTO public.messages (conversation_id, sender_id, content) VALUES
  ('00000000-0000-0000-0000-0000000074c1',
   '00000000-0000-0000-0000-00000000074b', 'Is de plaats nog vrij?');
RESET ROLE;
SELECT is(
  (SELECT recipient_id FROM public.messages WHERE content = 'Is de plaats nog vrij?'),
  '00000000-0000-0000-0000-00000000074a'::uuid,
  'a message from the initiator goes to the ad owner');

-- The ad owner answers: the initiator receives it.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000074a');
INSERT INTO public.messages (conversation_id, sender_id, content) VALUES
  ('00000000-0000-0000-0000-0000000074c1',
   '00000000-0000-0000-0000-00000000074a', 'Ja, kom gerust eens langs.');
RESET ROLE;
SELECT is(
  (SELECT recipient_id FROM public.messages WHERE content = 'Ja, kom gerust eens langs.'),
  '00000000-0000-0000-0000-00000000074b'::uuid,
  'an answer from the ad owner goes to the initiator');

-- A sender cannot address someone else, even with the column in the insert.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000074b');
SELECT throws_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, content, recipient_id)
    VALUES ('00000000-0000-0000-0000-0000000074c1', '00000000-0000-0000-0000-00000000074b',
            'Aan iemand anders', '00000000-0000-0000-0000-00000000074c')$$,
  '42501', NULL, 'the sender cannot pick the recipient');

-- The outsider sees neither message, so Realtime sends them nothing.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000074c');
SELECT is(
  (SELECT count(*) FROM public.messages WHERE conversation_id = '00000000-0000-0000-0000-0000000074c1'),
  0::bigint,
  'an outsider cannot read the conversation');

SELECT * FROM finish();
ROLLBACK;
