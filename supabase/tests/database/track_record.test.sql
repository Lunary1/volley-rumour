-- A contributor's track record counts moderator-resolved rumours, and
-- trusted_sources() lists the Betrouwbare bronnen (issue #88, D-005, J-10).
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(22);

-- An author, a moderator, and four contributors for the ranking.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000088a', 'tr_auteur@example.test', '{"username": "tr_test_auteur"}'),
  ('00000000-0000-0000-0000-00000000088b', 'tr_staff@example.test', '{"username": "tr_test_staff"}'),
  ('00000000-0000-0000-0000-0000000088c1', 'tr_vier@example.test', '{"username": "tr_test_vier"}'),
  ('00000000-0000-0000-0000-0000000088c2', 'tr_perfect@example.test', '{"username": "tr_test_perfect"}'),
  ('00000000-0000-0000-0000-0000000088c3', 'tr_negen@example.test', '{"username": "tr_test_negen"}'),
  ('00000000-0000-0000-0000-0000000088c4', 'tr_tien@example.test', '{"username": "tr_test_tien"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000088b';

INSERT INTO public.rumours (
  id, creator_id, player_name, category, status, from_club_name, to_club_name
) VALUES
  ('00000000-0000-0000-0000-0000000088f1', '00000000-0000-0000-0000-00000000088a', 'Anna Akkoord', 'transfer', 'rumour', 'Club A', 'Club B'),
  ('00000000-0000-0000-0000-0000000088f2', '00000000-0000-0000-0000-00000000088a', 'Ben Bedrogen', 'transfer', 'rumour', 'Club A', 'Club B'),
  ('00000000-0000-0000-0000-0000000088f3', '00000000-0000-0000-0000-00000000088a', 'Cas Verlopen', 'transfer', 'rumour', 'Club A', 'Club B'),
  ('00000000-0000-0000-0000-0000000088f4', '00000000-0000-0000-0000-00000000088a', 'Dora Wacht', 'transfer', 'pending', 'Club A', 'Club B');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

CREATE FUNCTION pg_temp.record(uid uuid) RETURNS text LANGUAGE sql AS $$
  SELECT rumours_confirmed || '/' || rumours_denied FROM public.profiles WHERE id = uid;
$$;

-- Resolved rumours for the ranking, inserted directly like the seed.
CREATE FUNCTION pg_temp.resolved(uid uuid, confirmed integer, denied integer) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO public.rumours (creator_id, player_name, category, status, from_club_name, to_club_name)
  SELECT uid, 'Ranking ' || n, 'transfer', CASE WHEN n <= confirmed THEN 'confirmed' ELSE 'denied' END,
         'Club A', 'Club B'
    FROM generate_series(1, confirmed + denied) AS n;
$$;

-- ------------------------------------------------------- who may do what
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.recount_track_record(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.on_rumour_resolution_change()', 'EXECUTE'),
  'the counting functions are not callable through the API');
SELECT ok(
  has_function_privilege('anon', 'public.trusted_sources(integer)', 'EXECUTE'),
  'visitors may list the trusted sources');
SELECT hasnt_column('public', 'profiles', 'trust_score', 'the trust score is gone');
SELECT hasnt_column('public', 'profiles', 'xp', 'the unused xp column is gone');

SET LOCAL ROLE anon;
SELECT lives_ok(
  $$SELECT rumours_confirmed, rumours_denied FROM public.profiles$$,
  'the track record is public');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000088a');
SELECT throws_ok(
  $$UPDATE public.profiles SET rumours_confirmed = 50, rumours_denied = 0
     WHERE id = '00000000-0000-0000-0000-00000000088a'$$,
  '42501', NULL, 'an author cannot set their own track record');
RESET ROLE;

-- --------------------------------------------- resolution moves the record
SELECT is(pg_temp.record('00000000-0000-0000-0000-00000000088a'), '0/0',
  'a new author has no track record');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000088b');
SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000088f1', 'confirmed', 'https://club.test/nieuws', 'player_male');
RESET ROLE;
SELECT is(pg_temp.record('00000000-0000-0000-0000-00000000088a'), '1/0',
  'a confirmation counts for the author');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000088b');
SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000088f2', 'denied');
RESET ROLE;
SELECT is(pg_temp.record('00000000-0000-0000-0000-00000000088a'), '1/1',
  'a denial counts against the author');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000088b');
SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000088f3', 'expired');
SELECT public.approve_rumour('00000000-0000-0000-0000-0000000088f4');
RESET ROLE;
SELECT is(pg_temp.record('00000000-0000-0000-0000-00000000088a'), '1/1',
  'an expired rumour is neutral, and so is an approval');

-- Removing the transfer reopens the rumour (#70): the confirmation is undone.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000088b');
SELECT public.delete_transfer(
  (SELECT id FROM public.transfers WHERE source_rumour_id = '00000000-0000-0000-0000-0000000088f1'),
  'Verkeerd bevestigd');
RESET ROLE;
SELECT is(pg_temp.record('00000000-0000-0000-0000-00000000088a'), '0/1',
  'a reopened rumour no longer counts');

-- A takedown or report removes the rumour from every view, and from the record.
UPDATE public.rumours SET status = 'removed' WHERE id = '00000000-0000-0000-0000-0000000088f2';
SELECT is(pg_temp.record('00000000-0000-0000-0000-00000000088a'), '0/0',
  'a removed rumour no longer counts');

-- Account deletion keeps rumours without their author; the old author's
-- record follows.
UPDATE public.rumours SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000088f1';
SELECT is(pg_temp.record('00000000-0000-0000-0000-00000000088a'), '1/0',
  'the trigger counts a status set directly too');
UPDATE public.rumours SET creator_id = NULL WHERE id = '00000000-0000-0000-0000-0000000088f1';
SELECT is(pg_temp.record('00000000-0000-0000-0000-00000000088a'), '0/0',
  'an anonymised rumour leaves the author''s record');

-- Moving a rumour to another author moves its count along.
UPDATE public.rumours SET creator_id = '00000000-0000-0000-0000-00000000088a', status = 'denied'
 WHERE id = '00000000-0000-0000-0000-0000000088f3';
UPDATE public.rumours SET creator_id = '00000000-0000-0000-0000-0000000088c1'
 WHERE id = '00000000-0000-0000-0000-0000000088f3';
SELECT is(
  pg_temp.record('00000000-0000-0000-0000-00000000088a') || ' ' ||
  pg_temp.record('00000000-0000-0000-0000-0000000088c1'),
  '0/0 0/1', 'a rumour that changes author is counted for the new one only');
DELETE FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000088f3';
SELECT is(pg_temp.record('00000000-0000-0000-0000-0000000088c1'), '0/0',
  'a deleted rumour no longer counts');

-- ------------------------------------------------- Betrouwbare bronnen
SELECT pg_temp.resolved('00000000-0000-0000-0000-0000000088c1', 4, 0); -- 4 of 4: too few
SELECT pg_temp.resolved('00000000-0000-0000-0000-0000000088c2', 5, 0); -- 5 of 5: 100%
SELECT pg_temp.resolved('00000000-0000-0000-0000-0000000088c3', 9, 1); -- 9 of 10: 90%
SELECT pg_temp.resolved('00000000-0000-0000-0000-0000000088c4', 18, 2); -- 18 of 20: 90%

SELECT is(pg_temp.record('00000000-0000-0000-0000-0000000088c4'), '18/2',
  'many resolved rumours are counted at once');

SET LOCAL ROLE anon;
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.trusted_sources() WHERE username = 'tr_test_vier'),
  'fewer than 5 resolved rumours keeps a contributor off the list');
SELECT is(
  ARRAY(SELECT username FROM public.trusted_sources() WHERE username LIKE 'tr_test_%'),
  ARRAY['tr_test_perfect', 'tr_test_tien', 'tr_test_negen'],
  'most accurate first; at equal accuracy, more resolved rumours first');
SELECT is(
  (SELECT rumours_confirmed || '/' || rumours_denied FROM public.trusted_sources()
    WHERE username = 'tr_test_negen'),
  '9/1', 'the list carries the track record');
SELECT is(
  (SELECT count(*)::integer FROM public.trusted_sources(2)), 2,
  'the list can be limited');
RESET ROLE;

-- ----------------------------------------------------------- votes
INSERT INTO public.rumours (id, creator_id, player_name, category, status, from_club_name, to_club_name)
VALUES ('00000000-0000-0000-0000-0000000088f9', '00000000-0000-0000-0000-0000000088c2', 'Vera Stem', 'transfer', 'rumour', 'Club A', 'Club B');
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000088b');
INSERT INTO public.rumour_votes (rumour_id, user_id, vote_type)
VALUES ('00000000-0000-0000-0000-0000000088f9', '00000000-0000-0000-0000-00000000088b', false);
RESET ROLE;
SELECT is(pg_temp.record('00000000-0000-0000-0000-0000000088c2'), '5/0',
  'votes never change a track record');

SELECT * FROM finish();
ROLLBACK;
