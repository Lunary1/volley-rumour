-- New rumours stay pending until a moderator approves them (issue #65).
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

-- An author, another user and a moderator.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000065a', 'auteur@example.test', '{"username": "mod_test_auteur"}'),
  ('00000000-0000-0000-0000-00000000065b', 'lezer@example.test', '{"username": "mod_test_lezer"}'),
  ('00000000-0000-0000-0000-00000000065c', 'staff@example.test', '{"username": "mod_test_staff"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000065c';

-- One rumour by the author in each status that matters here.
INSERT INTO public.rumours (creator_id, player_name, category, status) VALUES
  ('00000000-0000-0000-0000-00000000065a', 'Goedgekeurd Gerucht', 'transfer', 'rumour'),
  ('00000000-0000-0000-0000-00000000065a', 'Afgewezen Gerucht', 'transfer', 'rejected');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

SELECT col_default_is('public', 'rumours', 'status', 'pending'::text,
  'new rumours default to pending');

-- The author submits a rumour the way the app does: without a status.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000065a');
SELECT lives_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, from_club_name, category)
    VALUES ('00000000-0000-0000-0000-00000000065a', 'Nieuw Gerucht', 'Club X', 'transfer')$$,
  'a user can submit a rumour');
SELECT is(
  (SELECT status FROM public.rumours WHERE player_name = 'Nieuw Gerucht'),
  'pending', 'a submitted rumour is pending and its author can see it');
SELECT is(
  (SELECT status FROM public.rumours WHERE player_name = 'Afgewezen Gerucht'),
  'rejected', 'the author can see their rejected rumour');
SELECT throws_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, category, status)
    VALUES ('00000000-0000-0000-0000-00000000065a', 'Zelf Goedgekeurd', 'transfer', 'rumour')$$,
  '42501', NULL, 'the author cannot submit a rumour as approved');
SELECT throws_ok(
  $$UPDATE public.rumours SET status = 'rumour' WHERE player_name = 'Nieuw Gerucht'$$,
  '42501', NULL, 'the author cannot approve their own rumour');
RESET ROLE;

-- Anonymous visitors see only approved rumours
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE player_name = 'Nieuw Gerucht'),
  0, 'a visitor cannot see a pending rumour');
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE player_name = 'Afgewezen Gerucht'),
  0, 'a visitor cannot see a rejected rumour');
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE player_name = 'Goedgekeurd Gerucht'),
  1, 'a visitor sees an approved rumour');
RESET ROLE;

-- Another signed-in user
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000065b');
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE player_name = 'Nieuw Gerucht'),
  0, 'another user cannot see a pending rumour');
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE player_name = 'Afgewezen Gerucht'),
  0, 'another user cannot see a rejected rumour');
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE player_name = 'Goedgekeurd Gerucht'),
  1, 'another user sees an approved rumour');
RESET ROLE;

-- Staff see pending and rejected rumours, so they can moderate them
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000065c');
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE player_name = 'Nieuw Gerucht'),
  1, 'a moderator sees a pending rumour');
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE player_name = 'Afgewezen Gerucht'),
  1, 'a moderator sees a rejected rumour');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
