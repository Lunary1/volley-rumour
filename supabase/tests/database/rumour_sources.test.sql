-- New rumours name a source and carry both declarations, and one author can
-- have at most 5 waiting for a moderator (issue #67, #54, D-013).
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(17);

-- An author, another author and a moderator.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000067a', 'bron_auteur@example.test', '{"username": "bron_test_auteur"}'),
  ('00000000-0000-0000-0000-00000000067b', 'bron_ander@example.test', '{"username": "bron_test_ander"}'),
  ('00000000-0000-0000-0000-00000000067c', 'bron_staff@example.test', '{"username": "bron_test_staff"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000067c';

-- A rumour from before #67: no source, no declarations.
INSERT INTO public.rumours (id, creator_id, player_name, category) VALUES
  ('00000000-0000-0000-0000-0000000067f0', '00000000-0000-0000-0000-00000000067b', 'Oud Gerucht', 'transfer');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- Submits a rumour as the current user, the way the app does.
CREATE FUNCTION pg_temp.submit(name text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.rumours (creator_id, player_name, category, source_type,
                              declared_good_faith, declared_senior)
  VALUES ((SELECT auth.uid()), name, 'trainer_retirement', 'own_observation', true, true);
$$;
GRANT EXECUTE ON FUNCTION pg_temp.submit(text) TO authenticated;

-- ------------------------------------------------------- source and declarations
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000067a');
SELECT throws_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, category, declared_good_faith, declared_senior)
    VALUES ('00000000-0000-0000-0000-00000000067a', 'Zonder Bron', 'transfer', true, true)$$,
  '23514', NULL, 'a rumour needs a source type');
SELECT throws_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, category, source_type, declared_senior)
    VALUES ('00000000-0000-0000-0000-00000000067a', 'Zonder Goede Trouw', 'transfer', 'club', true)$$,
  '23514', NULL, 'a rumour needs the good-faith declaration');
SELECT throws_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, category, source_type, declared_good_faith, declared_senior)
    VALUES ('00000000-0000-0000-0000-00000000067a', 'Geen Senior', 'transfer', 'club', true, false)$$,
  '23514', NULL, 'a rumour needs the senior declaration');
SELECT throws_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, category, source_type, declared_good_faith, declared_senior)
    VALUES ('00000000-0000-0000-0000-00000000067a', 'Rare Bron', 'transfer', 'hearsay', true, true)$$,
  '23514', NULL, 'the source type comes from the fixed list');
SELECT throws_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, category, source_type, source_url, declared_good_faith, declared_senior)
    VALUES ('00000000-0000-0000-0000-00000000067a', 'Script Link', 'transfer', 'media', 'javascript:alert(1)', true, true)$$,
  '23514', NULL, 'the source link must be http or https');
SELECT throws_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, category, source_type, declared_good_faith, declared_senior, from_division)
    VALUES ('00000000-0000-0000-0000-00000000067a', 'Jeugdploeg', 'transfer', 'club', true, true, 'u17_meisjes')$$,
  '23514', NULL, 'divisions are senior divisions only');
SELECT lives_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, category, source_type, source_url,
                                declared_good_faith, declared_senior, gender, from_division, to_division)
    VALUES ('00000000-0000-0000-0000-00000000067a', 'Met Bron', 'transfer', 'media', 'https://example.test/artikel',
            true, true, 'female', 'promo1_dames', 'nat3_dames')$$,
  'a rumour with a source and both declarations is accepted');
SELECT results_eq(
  $$SELECT source_type, source_url, gender, from_division, to_division
      FROM public.rumours WHERE player_name = 'Met Bron'$$,
  $$VALUES ('media', 'https://example.test/artikel', 'female', 'promo1_dames', 'nat3_dames')$$,
  'the source, gender and divisions are stored');

-- ------------------------------------------------------------ pending cap
-- 'Met Bron' is the first; four more reach the cap.
SELECT lives_ok(
  $$SELECT pg_temp.submit('Twee'); SELECT pg_temp.submit('Drie');
    SELECT pg_temp.submit('Vier'); SELECT pg_temp.submit('Vijf')$$,
  'an author can have 5 rumours waiting');
SELECT throws_ok(
  $$SELECT pg_temp.submit('Zes')$$,
  'VR001', NULL, 'a sixth waiting rumour is refused');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000067b');
SELECT lives_ok(
  $$SELECT pg_temp.submit('Van Iemand Anders')$$,
  'the cap counts per author');

-- A moderator handles one; the author can submit again.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000067c');
SELECT lives_ok(
  $$SELECT public.approve_rumour((SELECT id FROM public.rumours WHERE player_name = 'Twee'))$$,
  'a moderator approves one of the five');
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000067a');
SELECT lives_ok(
  $$SELECT pg_temp.submit('Zes')$$,
  'after a decision the author can submit again');
SELECT throws_ok(
  $$SELECT pg_temp.submit('Zeven')$$,
  'VR001', NULL, 'and is back at the cap');
RESET ROLE;

-- ------------------------------------------------- rumours from before #67
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000067c');
SELECT lives_ok(
  $$SELECT public.approve_rumour('00000000-0000-0000-0000-0000000067f0')$$,
  'a rumour without a source can still be approved');
RESET ROLE;

-- Voting updates the counts on the rumour row; that must keep working too.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000067a');
SELECT lives_ok(
  $$INSERT INTO public.rumour_votes (rumour_id, user_id, vote_type)
    VALUES ('00000000-0000-0000-0000-0000000067f0', '00000000-0000-0000-0000-00000000067a', true)$$,
  'a rumour without a source can still be voted on');
RESET ROLE;

-- Inserts outside the API (seed, service role) aren't checked.
SELECT lives_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, category)
    VALUES ('00000000-0000-0000-0000-00000000067a', 'Via De Seed', 'transfer')$$,
  'server-side inserts skip the API rules');

SELECT * FROM finish();
ROLLBACK;
