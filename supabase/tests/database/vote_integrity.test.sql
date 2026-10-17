-- Vote integrity (issue #78, X-4, J-10): the database counts votes, also when
-- one is deleted; no votes on your own rumour or on closed ones; votes are
-- private. Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

-- The creator and two voters.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000078a', 'vi_maker@example.test', '{"username": "vi_test_maker"}'),
  ('00000000-0000-0000-0000-00000000078b', 'vi_stemmer@example.test', '{"username": "vi_test_stemmer"}'),
  ('00000000-0000-0000-0000-00000000078c', 'vi_ander@example.test', '{"username": "vi_test_ander"}');
INSERT INTO public.rumours (id, creator_id, player_name, category, status) VALUES
  ('00000000-0000-0000-0000-0000000078e1', '00000000-0000-0000-0000-00000000078a', 'Open Gerucht', 'transfer', 'rumour'),
  ('00000000-0000-0000-0000-0000000078e2', '00000000-0000-0000-0000-00000000078a', 'Bevestigd Gerucht', 'transfer', 'confirmed'),
  ('00000000-0000-0000-0000-0000000078e3', '00000000-0000-0000-0000-00000000078a', 'Wachtend Gerucht', 'transfer', 'pending');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

CREATE FUNCTION pg_temp.counts() RETURNS text LANGUAGE sql AS $$
  SELECT votes_true || '/' || votes_false FROM public.rumours
   WHERE id = '00000000-0000-0000-0000-0000000078e1';
$$;

-- The creator's track record (#88): votes never move it (D-005).
CREATE FUNCTION pg_temp.maker_score() RETURNS text LANGUAGE sql AS $$
  SELECT rumours_confirmed || '/' || rumours_denied FROM public.profiles
   WHERE id = '00000000-0000-0000-0000-00000000078a';
$$;

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.recount_rumour_votes(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.check_vote_allowed()', 'EXECUTE'),
  'the counting and checking functions are not callable through the API');

-- A vote is counted on the rumour, not in the creator's track record.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000078b');
SELECT lives_ok(
  $$INSERT INTO public.rumour_votes (rumour_id, user_id, vote_type)
    VALUES ('00000000-0000-0000-0000-0000000078e1', '00000000-0000-0000-0000-00000000078b', true)$$,
  'a user can vote on someone else''s lopend rumour');
RESET ROLE;
SELECT is(pg_temp.counts(), '1/0', 'the vote is counted');
-- The maker starts with one confirmed rumour (Bevestigd Gerucht).
SELECT is(pg_temp.maker_score(), '1/0', 'the vote doesn''t change the creator''s track record');

-- Changing the vote moves it to the other side.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000078b');
SELECT lives_ok(
  $$UPDATE public.rumour_votes SET vote_type = false
     WHERE rumour_id = '00000000-0000-0000-0000-0000000078e1'$$,
  'a user can change their vote');
RESET ROLE;
SELECT is(pg_temp.counts(), '0/1', 'the changed vote is counted on the other side');

-- Closed rumours and your own.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000078b');
SELECT throws_ok(
  $$INSERT INTO public.rumour_votes (rumour_id, user_id, vote_type)
    VALUES ('00000000-0000-0000-0000-0000000078e2', '00000000-0000-0000-0000-00000000078b', true)$$,
  'VR010', NULL, 'no votes on a resolved rumour');
SELECT throws_ok(
  $$INSERT INTO public.rumour_votes (rumour_id, user_id, vote_type)
    VALUES ('00000000-0000-0000-0000-0000000078e3', '00000000-0000-0000-0000-00000000078b', true)$$,
  'VR010', NULL, 'no votes on a pending rumour');
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000078a');
SELECT throws_ok(
  $$INSERT INTO public.rumour_votes (rumour_id, user_id, vote_type)
    VALUES ('00000000-0000-0000-0000-0000000078e1', '00000000-0000-0000-0000-00000000078a', true)$$,
  'VR009', NULL, 'no votes on your own rumour');

-- Votes are private, and stay on their rumour.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000078c');
SELECT is(
  (SELECT count(*)::int FROM public.rumour_votes
    WHERE rumour_id = '00000000-0000-0000-0000-0000000078e1'),
  0, 'another user does not see my vote');
SELECT lives_ok(
  $$INSERT INTO public.rumour_votes (rumour_id, user_id, vote_type)
    VALUES ('00000000-0000-0000-0000-0000000078e1', '00000000-0000-0000-0000-00000000078c', true)$$,
  'a second user votes');
SELECT is(
  (SELECT count(*)::int FROM public.rumour_votes),
  1, 'a user sees only their own vote');
SELECT throws_ok(
  $$UPDATE public.rumour_votes SET rumour_id = '00000000-0000-0000-0000-0000000078e2'$$,
  '42501', NULL, 'a vote cannot move to another rumour');
SELECT throws_ok(
  $$DELETE FROM public.rumour_votes$$,
  '42501', NULL, 'a vote cannot be withdrawn');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT count(*) FROM public.rumour_votes$$,
  '42501', NULL, 'visitors cannot read votes');
RESET ROLE;

-- Once resolved, a vote can't be changed either.
UPDATE public.rumours SET status = 'confirmed'
 WHERE id = '00000000-0000-0000-0000-0000000078e1';
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000078c');
SELECT throws_ok(
  $$UPDATE public.rumour_votes SET vote_type = false$$,
  'VR010', NULL, 'a vote on a resolved rumour cannot be changed');
RESET ROLE;

-- Deleting a vote (an account deletion) recounts: this missed before #78.
DELETE FROM public.rumour_votes
 WHERE user_id = '00000000-0000-0000-0000-00000000078b';
SELECT is(pg_temp.counts(), '1/0', 'a deleted vote is no longer counted');
SELECT is(pg_temp.maker_score(), '2/0', 'the track record counts the confirmation, not the votes');

SELECT * FROM finish();
ROLLBACK;
