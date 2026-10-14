-- Permissions of the public API roles (issue #34). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(27);

-- Two users; the on_auth_user_created trigger creates their profiles.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test', '{"username": "speler_a"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', '{"username": "speler_b"}');

SELECT is(
  (SELECT count(*)::int FROM public.profiles WHERE id IN ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')),
  2, 'new auth users get a profile');

-- Helpers: act as a user, and count the rows a statement changed.
CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;
CREATE FUNCTION pg_temp.rows_changed(stmt text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Rows are created the way the app creates them (database-generated ids)
-- and looked up afterwards by these values.
--   rumour:       player_name 'Test Speler'
--   zoekertje:    title 'Zoekertje A'
--   conversation: between A and B
--   message:      content 'Hallo'

-- ---------------------------------------------------------------- profiles
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

SELECT lives_ok(
  $$UPDATE public.profiles SET username = 'speler_a2', avatar_url = NULL WHERE id = '00000000-0000-0000-0000-00000000000a'$$,
  'users can edit their username and avatar');
SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', NULL, 'users cannot change their role');
SELECT throws_ok(
  $$UPDATE public.profiles SET trust_score = 999 WHERE id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', NULL, 'users cannot set their trust score');
SELECT throws_ok(
  $$UPDATE public.profiles SET is_verified_source = true WHERE id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', NULL, 'users cannot verify themselves');

-- --------------------------------------------------------------- functions
SELECT throws_ok(
  $$SELECT public.increment_trust_score('00000000-0000-0000-0000-00000000000a', 100)$$,
  '42501', NULL, 'signed-in users cannot call increment_trust_score');
SELECT throws_ok(
  $$SELECT public.decrement_trust_score('00000000-0000-0000-0000-00000000000b', 100)$$,
  '42501', NULL, 'signed-in users cannot call decrement_trust_score');

-- ----------------------------------------------------------------- rumours
SELECT lives_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, from_club_name, to_club_name, category, description)
    VALUES ('00000000-0000-0000-0000-00000000000a', 'Test Speler', 'Club X', 'Club Y', 'transfer', 'test')$$,
  'users can create a rumour');
SELECT throws_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, category, status)
    VALUES ('00000000-0000-0000-0000-00000000000a', 'Andere Speler', 'transfer', 'confirmed')$$,
  '42501', NULL, 'users cannot create a rumour as confirmed');
SELECT throws_ok(
  $$UPDATE public.rumours SET status = 'confirmed' WHERE player_name = 'Test Speler'$$,
  '42501', NULL, 'users cannot confirm their own rumour');
SELECT throws_ok(
  $$UPDATE public.rumours SET votes_true = 999 WHERE player_name = 'Test Speler'$$,
  '42501', NULL, 'users cannot set vote counts');

-- --------------------------------------------------------------- transfers
SELECT throws_ok(
  $$INSERT INTO public.transfers (player_name, category) VALUES ('Nep Transfer', 'player_male')$$,
  '42501', NULL, 'users cannot publish transfers');

-- ------------------------------------------------------------- classifieds
SELECT lives_ok(
  $$INSERT INTO public.classifieds (user_id, type, title, contact_name, is_active)
    VALUES ('00000000-0000-0000-0000-00000000000a', 'player_seeks_team', 'Zoekertje A', 'Speler A', true)$$,
  'users can create a zoekertje');
SELECT throws_ok(
  $$INSERT INTO public.classifieds (user_id, type, title, contact_name, is_featured)
    VALUES ('00000000-0000-0000-0000-00000000000a', 'player_seeks_team', 'Zoekertje B', 'Speler A', true)$$,
  '42501', NULL, 'users cannot create a featured zoekertje');
SELECT lives_ok(
  $$UPDATE public.classifieds SET is_active = false, description = 'gevonden' WHERE title = 'Zoekertje A'$$,
  'owners can edit and deactivate their zoekertje');
SELECT throws_ok(
  $$UPDATE public.classifieds SET is_featured = true WHERE title = 'Zoekertje A'$$,
  '42501', NULL, 'owners cannot feature their zoekertje');

-- -------------------------------------------------- conversations/messages
SELECT lives_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    SELECT id, 'classified', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'
    FROM public.classifieds WHERE title = 'Zoekertje A'$$,
  'users can start a conversation');
SELECT lives_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, content)
    SELECT id, '00000000-0000-0000-0000-00000000000a', 'Hallo'
    FROM public.conversations WHERE initiator_id = '00000000-0000-0000-0000-00000000000a'$$,
  'participants can send a message');
SELECT throws_ok(
  $$UPDATE public.conversations SET recipient_id = '00000000-0000-0000-0000-00000000000a'
    WHERE initiator_id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', NULL, 'participants cannot change who is in a conversation');
SELECT lives_ok(
  $$UPDATE public.conversations SET is_archived = true, updated_at = now()
    WHERE initiator_id = '00000000-0000-0000-0000-00000000000a'$$,
  'participants can archive and bump a conversation');
SELECT is(
  pg_temp.rows_changed($$UPDATE public.messages SET is_read = true WHERE content = 'Hallo'$$),
  0, 'senders cannot mark their own message as read');

RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

SELECT throws_ok(
  $$UPDATE public.messages SET content = 'Gewijzigd' WHERE content = 'Hallo'$$,
  '42501', NULL, 'nobody can rewrite a message');
SELECT is(
  pg_temp.rows_changed($$UPDATE public.messages SET is_read = true, read_at = now() WHERE content = 'Hallo'$$),
  1, 'recipients can mark a message as read');

-- ------------------------------------------------------------------- votes
-- New rumours are pending (#65); a moderator approves this one so others can
-- see it and vote.
RESET ROLE;
UPDATE public.rumours SET status = 'rumour' WHERE player_name = 'Test Speler';
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

SELECT lives_ok(
  $$INSERT INTO public.rumour_votes (rumour_id, user_id, vote_type)
    SELECT id, '00000000-0000-0000-0000-00000000000b', true FROM public.rumours WHERE player_name = 'Test Speler'$$,
  'users can vote');

RESET ROLE;
SELECT is(
  (SELECT votes_true FROM public.rumours WHERE player_name = 'Test Speler'),
  1, 'the vote trigger still counts votes');

-- -------------------------------------------------------------------- anon
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.increment_trust_score('00000000-0000-0000-0000-00000000000a', 100)$$,
  '42501', NULL, 'anonymous visitors cannot call increment_trust_score');
SELECT lives_ok(
  $$SELECT public.get_interest_count()$$,
  'anonymous visitors can read the interest count');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
