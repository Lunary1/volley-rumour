-- Staff reopen a wrongly denied or expired rumour, logged, and the author's
-- track record follows (issue #150). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(15);

-- An author, a moderator and a voter.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000150a', 'ro_auteur@example.test', '{"username": "ro_test_auteur"}'),
  ('00000000-0000-0000-0000-00000000150b', 'ro_staff@example.test', '{"username": "ro_test_staff"}'),
  ('00000000-0000-0000-0000-00000000150c', 'ro_stemmer@example.test', '{"username": "ro_test_stemmer"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000150b';

-- One rumour in every status reopening has to tell apart.
INSERT INTO public.rumours (
  id, creator_id, player_name, category, status, from_club_name, to_club_name,
  resolved_at, resolution_source_url
) VALUES
  ('00000000-0000-0000-0000-0000000150f1', '00000000-0000-0000-0000-00000000150a', 'Dirk Ontkracht', 'transfer', 'denied', 'Club A', 'Club B',
   now() - interval '1 day', 'https://club.test/dirk'),
  ('00000000-0000-0000-0000-0000000150f2', '00000000-0000-0000-0000-00000000150a', 'Eva Verlopen', 'transfer', 'expired', 'Club A', 'Club C',
   now() - interval '1 day', NULL),
  ('00000000-0000-0000-0000-0000000150f3', '00000000-0000-0000-0000-00000000150a', 'Lot Lopend', 'transfer', 'rumour', 'Club A', 'Club D', NULL, NULL),
  ('00000000-0000-0000-0000-0000000150f4', '00000000-0000-0000-0000-00000000150a', 'Bart Bevestigd', 'transfer', 'confirmed', 'Club A', 'Club E',
   now() - interval '1 day', 'https://club.test/bart'),
  ('00000000-0000-0000-0000-0000000150f5', '00000000-0000-0000-0000-00000000150a', 'Wim Weg', 'transfer', 'removed', 'Club A', 'Club F', NULL, NULL);

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

CREATE FUNCTION pg_temp.reopen_log(rid uuid) RETURNS SETOF public.staff_actions LANGUAGE sql AS $$
  SELECT * FROM public.staff_actions WHERE action = 'rumour_reopened' AND target_id = rid;
$$;

SELECT ok(
  NOT has_function_privilege('anon', 'public.reopen_rumour(uuid, text)', 'EXECUTE'),
  'visitors cannot call reopen_rumour');

SELECT is((SELECT rumours_denied FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000150a'), 1,
  'the denial counts in the author''s track record');

-- ------------------------------------------------------------- refusals
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000150c');
SELECT throws_ok(
  $$ SELECT public.reopen_rumour('00000000-0000-0000-0000-0000000150f1', 'Toch waar') $$,
  '42501', NULL, 'a user who is not staff cannot reopen a rumour');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000150b');
SELECT throws_ok(
  $$ SELECT public.reopen_rumour('00000000-0000-0000-0000-0000000150f1', '   ') $$,
  '22023', NULL, 'reopening needs a reason');
SELECT throws_ok(
  $$ SELECT public.reopen_rumour('00000000-0000-0000-0000-0000000150f1', repeat('x', 501)) $$,
  '22023', NULL, 'the reason is at most 500 characters');
SELECT throws_ok(
  $$ SELECT public.reopen_rumour('00000000-0000-0000-0000-0000000150f3', 'Opnieuw') $$,
  'P0002', NULL, 'a lopend rumour cannot be reopened');
SELECT throws_ok(
  $$ SELECT public.reopen_rumour('00000000-0000-0000-0000-0000000150f4', 'Opnieuw') $$,
  'P0002', NULL, 'a confirmed rumour is reopened by deleting its transfer, not here');
SELECT throws_ok(
  $$ SELECT public.reopen_rumour('00000000-0000-0000-0000-0000000150f5', 'Opnieuw') $$,
  'P0002', NULL, 'a removed rumour stays removed');

-- ---------------------------------------------------------------- denied
SELECT public.reopen_rumour('00000000-0000-0000-0000-0000000150f1', '  Speler ontkende, club bevestigt nu  ');
RESET ROLE;
SELECT ok(
  (SELECT status = 'rumour' AND resolved_at IS NULL AND resolution_source_url IS NULL
     FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000150f1'),
  'a denied rumour is lopend again, without its resolution');
SELECT is((SELECT rumours_denied FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000150a'), 0,
  'the denial no longer counts against the author');
SELECT ok(
  (SELECT actor_id = '00000000-0000-0000-0000-00000000150b'
          AND reason = 'Speler ontkende, club bevestigt nu'
          AND target_type = 'rumour'
          AND details->>'previous_status' = 'denied'
          AND details->>'resolution_source_url' = 'https://club.test/dirk'
          AND details ? 'resolved_at'
     FROM pg_temp.reopen_log('00000000-0000-0000-0000-0000000150f1')),
  'the entry names the moderator, the reason and the decision it undid');

-- --------------------------------------------------------------- expired
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000150b');
SELECT public.reopen_rumour('00000000-0000-0000-0000-0000000150f2', 'Te vroeg afgesloten');
RESET ROLE;
SELECT ok(
  (SELECT status = 'rumour' AND resolved_at IS NULL
     FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000150f2')
  AND (SELECT details->>'previous_status' = 'expired'
         FROM pg_temp.reopen_log('00000000-0000-0000-0000-0000000150f2')),
  'an expired rumour is lopend again, logged as expired before');

SELECT throws_ok(
  $$ SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000150b');
     SELECT public.reopen_rumour('00000000-0000-0000-0000-0000000150f2', 'Nog eens') $$,
  'P0002', NULL, 'reopening twice is refused');
RESET ROLE;

-- ------------------------------------------------------------ afterwards
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000150c');
SELECT lives_ok(
  $$ INSERT INTO public.rumour_votes (rumour_id, user_id, vote_type)
     VALUES ('00000000-0000-0000-0000-0000000150f1', '00000000-0000-0000-0000-00000000150c', true) $$,
  'voting opens again on the reopened rumour');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000150b');
SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000150f1', 'confirmed', 'https://club.test/dirk-bevestigd', 'player_male');
RESET ROLE;
SELECT is((SELECT rumours_confirmed FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000150a'), 2,
  'the reopened rumour can be resolved again, and the record follows');

SELECT * FROM finish();
ROLLBACK;
