-- Per-user archive (issue #91, J-07): archiving hides a conversation from my
-- inbox only, and a new incoming message brings it back.
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);

-- The ad owner, the user who answered, and an outsider.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000091a', 'ar_eigenaar@example.test', '{"username": "ar_test_eigenaar"}'),
  ('00000000-0000-0000-0000-00000000091b', 'ar_reageerder@example.test', '{"username": "ar_test_reageerder"}'),
  ('00000000-0000-0000-0000-00000000091c', 'ar_ander@example.test', '{"username": "ar_test_ander"}');
INSERT INTO public.classifieds (id, user_id, type, title, contact_name) VALUES
  ('00000000-0000-0000-0000-0000000091e1', '00000000-0000-0000-0000-00000000091a', 'team_seeks_player', 'Archief', 'Eigenaar');
INSERT INTO public.conversations (id, ad_id, ad_type, initiator_id, recipient_id) VALUES
  ('00000000-0000-0000-0000-0000000091c1', '00000000-0000-0000-0000-0000000091e1', 'classified',
   '00000000-0000-0000-0000-00000000091b', '00000000-0000-0000-0000-00000000091a');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

SELECT hasnt_column('public', 'conversations', 'is_archived', 'the shared archive flag is gone');
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.unarchive_for_recipient()', 'EXECUTE'),
  'the trigger function is not callable through the API');

-- The answerer archives for themselves.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000091b');
SELECT lives_ok(
  $$INSERT INTO public.conversation_archives (conversation_id, user_id)
    VALUES ('00000000-0000-0000-0000-0000000091c1', '00000000-0000-0000-0000-00000000091b')$$,
  'a participant can archive a conversation');
SELECT throws_ok(
  $$INSERT INTO public.conversation_archives (conversation_id, user_id)
    VALUES ('00000000-0000-0000-0000-0000000091c1', '00000000-0000-0000-0000-00000000091a')$$,
  '42501', NULL, 'a participant cannot archive for the other participant');

-- The ad owner doesn't see the answerer's archive.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000091a');
SELECT is(
  (SELECT count(*)::int FROM public.conversation_archives),
  0, 'the other participant does not see my archive');

-- An outsider can't archive someone else's conversation.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000091c');
SELECT throws_ok(
  $$INSERT INTO public.conversation_archives (conversation_id, user_id)
    VALUES ('00000000-0000-0000-0000-0000000091c1', '00000000-0000-0000-0000-00000000091c')$$,
  '42501', NULL, 'an outsider cannot archive a conversation');
DELETE FROM public.conversation_archives;

-- The answerer's own message keeps it archived for them.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000091b');
INSERT INTO public.messages (conversation_id, sender_id, content) VALUES
  ('00000000-0000-0000-0000-0000000091c1', '00000000-0000-0000-0000-00000000091b', 'Nog één ding');
SELECT is(
  (SELECT count(*)::int FROM public.conversation_archives),
  1, 'an outsider''s delete and my own message keep it archived');

-- A reply from the ad owner brings it back to the answerer's inbox.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000091a');
INSERT INTO public.messages (conversation_id, sender_id, content) VALUES
  ('00000000-0000-0000-0000-0000000091c1', '00000000-0000-0000-0000-00000000091a', 'Prima, zeg maar');
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000091b');
SELECT is(
  (SELECT count(*)::int FROM public.conversation_archives),
  0, 'a new incoming message unarchives the conversation');

-- Archive again, then unarchive by hand.
INSERT INTO public.conversation_archives (conversation_id, user_id)
  VALUES ('00000000-0000-0000-0000-0000000091c1', '00000000-0000-0000-0000-00000000091b');
SELECT lives_ok(
  $$DELETE FROM public.conversation_archives
     WHERE conversation_id = '00000000-0000-0000-0000-0000000091c1'$$,
  'a participant can unarchive');
SELECT is(
  (SELECT count(*)::int FROM public.conversation_archives),
  0, 'the conversation is back in the inbox');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
