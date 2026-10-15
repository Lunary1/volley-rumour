-- Blocking: a block stops new messages and new conversations in both
-- directions, only the blocker sees and lifts it, and the conversation page
-- can ask whether either user blocked the other (issue #73, J-07, D-018).
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(29);

-- The blocker, the blocked user and an outsider.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000073a', 'bl_blokker@example.test', '{"username": "bl_test_blokker"}'),
  ('00000000-0000-0000-0000-00000000073b', 'bl_geblokt@example.test', '{"username": "bl_test_geblokt"}'),
  ('00000000-0000-0000-0000-00000000073c', 'bl_ander@example.test', '{"username": "bl_test_ander"}');

-- Two zoekertjes of the blocker and one of the outsider. The blocked user
-- answered the first one; the second has no conversation yet.
INSERT INTO public.classifieds (id, user_id, type, title, contact_name) VALUES
  ('00000000-0000-0000-0000-0000000073e1', '00000000-0000-0000-0000-00000000073a', 'team_seeks_player', 'Blok Een', 'Blokker'),
  ('00000000-0000-0000-0000-0000000073e2', '00000000-0000-0000-0000-00000000073a', 'team_seeks_player', 'Blok Twee', 'Blokker'),
  ('00000000-0000-0000-0000-0000000073e3', '00000000-0000-0000-0000-00000000073c', 'team_seeks_player', 'Ander', 'Ander');
INSERT INTO public.conversations (id, ad_id, ad_type, initiator_id, recipient_id) VALUES
  ('00000000-0000-0000-0000-0000000073c1', '00000000-0000-0000-0000-0000000073e1', 'classified',
   '00000000-0000-0000-0000-00000000073b', '00000000-0000-0000-0000-00000000073a'),
  ('00000000-0000-0000-0000-0000000073c2', '00000000-0000-0000-0000-0000000073e3', 'classified',
   '00000000-0000-0000-0000-00000000073b', '00000000-0000-0000-0000-00000000073c');
INSERT INTO public.messages (conversation_id, sender_id, content) VALUES
  ('00000000-0000-0000-0000-0000000073c1', '00000000-0000-0000-0000-00000000073b', 'Is de plaats nog vrij?');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- ------------------------------------------------------------- privileges
SELECT ok(
  NOT has_table_privilege('anon', 'public.blocked_users', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.blocked_users', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.blocked_users', 'DELETE'),
  'visitors cannot read or change blocks');
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.blocked_users', 'UPDATE'),
  'a block is never edited, only lifted');
SELECT ok(
  NOT has_function_privilege('anon', 'public.is_blocked_with(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.is_blocked_with(uuid)', 'EXECUTE'),
  'only logged-in users ask whether they can message someone');
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.check_not_blocked()', 'EXECUTE'),
  'the trigger function is not callable through the API');

-- ------------------------------------------------------------------ block
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000073a');
SELECT is(public.is_blocked_with('00000000-0000-0000-0000-00000000073b'), false,
  'no block yet');
SELECT throws_ok(
  $$INSERT INTO public.blocked_users (blocker_id, blocked_id)
    VALUES ('00000000-0000-0000-0000-00000000073c', '00000000-0000-0000-0000-00000000073b')$$,
  '42501', NULL, 'nobody blocks in someone else''s name');
SELECT throws_ok(
  $$INSERT INTO public.blocked_users (blocker_id, blocked_id)
    VALUES ('00000000-0000-0000-0000-00000000073a', '00000000-0000-0000-0000-00000000073a')$$,
  '23514', NULL, 'nobody blocks themselves');
SELECT lives_ok(
  $$INSERT INTO public.blocked_users (blocker_id, blocked_id)
    VALUES ('00000000-0000-0000-0000-00000000073a', '00000000-0000-0000-0000-00000000073b')$$,
  'a user blocks another');
SELECT is(
  (SELECT count(*)::int FROM public.blocked_users),
  1,
  'the blocker sees their block');
SELECT is(public.is_blocked_with('00000000-0000-0000-0000-00000000073b'), true,
  'the blocker is told they cannot message the blocked user');
RESET ROLE;

-- ---------------------------------------------------- the blocked user
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000073b');
SELECT is(
  (SELECT count(*)::int FROM public.blocked_users),
  0,
  'the blocked user cannot see who blocked them');
SELECT is(public.is_blocked_with('00000000-0000-0000-0000-00000000073a'), true,
  'the blocked user is told they cannot message the blocker');
SELECT is(public.is_blocked_with('00000000-0000-0000-0000-00000000073c'), false,
  'other users are not affected');
SELECT throws_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES ('00000000-0000-0000-0000-0000000073c1', '00000000-0000-0000-0000-00000000073b', 'Hallo?')$$,
  'VR008', NULL, 'the blocked user cannot send a message in the conversation');
SELECT throws_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    VALUES ('00000000-0000-0000-0000-0000000073e2', 'classified',
            '00000000-0000-0000-0000-00000000073b', '00000000-0000-0000-0000-00000000073a')$$,
  'VR008', NULL, 'the blocked user cannot start a new conversation');
SELECT lives_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES ('00000000-0000-0000-0000-0000000073c2', '00000000-0000-0000-0000-00000000073b', 'Nog vrij?')$$,
  'the blocked user can still message others');
SELECT lives_ok(
  $$DELETE FROM public.blocked_users WHERE blocker_id = '00000000-0000-0000-0000-00000000073a'$$,
  'the blocked user''s delete runs');
SELECT is(
  (SELECT count(*)::int FROM public.messages WHERE conversation_id = '00000000-0000-0000-0000-0000000073c1'),
  1,
  'the blocked user still reads the earlier messages');
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.blocked_users WHERE blocker_id = '00000000-0000-0000-0000-00000000073a'),
  1,
  'but cannot lift the block');

-- ------------------------------------------------- the other direction
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000073a');
SELECT throws_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES ('00000000-0000-0000-0000-0000000073c1', '00000000-0000-0000-0000-00000000073a', 'Toch nog dit')$$,
  'VR008', NULL, 'the blocker cannot send a message either');
SELECT throws_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    VALUES ('00000000-0000-0000-0000-0000000073e3', 'classified',
            '00000000-0000-0000-0000-00000000073a', '00000000-0000-0000-0000-00000000073b')$$,
  'VR008', NULL, 'nor start a new conversation');
RESET ROLE;

SELECT throws_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES ('00000000-0000-0000-0000-0000000073c1', '00000000-0000-0000-0000-00000000073b', 'Via de server')$$,
  'VR008', NULL, 'the block also holds for inserts outside the API');
SELECT throws_ok(
  $$INSERT INTO public.blocked_users (blocker_id, blocked_id)
    VALUES ('00000000-0000-0000-0000-00000000073c', '00000000-0000-0000-0000-00000000073c')$$,
  '23514', NULL, 'no self-blocks, also outside the API');

-- ---------------------------------------------------------------- unblock
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000073a');
SELECT lives_ok(
  $$DELETE FROM public.blocked_users WHERE blocked_id = '00000000-0000-0000-0000-00000000073b'$$,
  'the blocker lifts the block');
SELECT is(
  (SELECT count(*)::int FROM public.blocked_users),
  0,
  'the block is gone');
SELECT is(public.is_blocked_with('00000000-0000-0000-0000-00000000073b'), false,
  'they can message each other again');
SELECT lives_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES ('00000000-0000-0000-0000-0000000073c1', '00000000-0000-0000-0000-00000000073a', 'Ja, nog vrij')$$,
  'the blocker can message again');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000073b');
SELECT lives_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES ('00000000-0000-0000-0000-0000000073c1', '00000000-0000-0000-0000-00000000073b', 'Fijn!')$$,
  'and so can the blocked user');
RESET ROLE;

-- Without a login there is no caller to be blocked. A block from the outsider
-- makes sure the answer isn't just "no blocks at all".
INSERT INTO public.blocked_users (blocker_id, blocked_id)
VALUES ('00000000-0000-0000-0000-00000000073c', '00000000-0000-0000-0000-00000000073b');
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '', true); END $$;
SELECT is(public.is_blocked_with('00000000-0000-0000-0000-00000000073b'), false,
  'without a login, nobody is blocked');

SELECT * FROM finish();
ROLLBACK;
