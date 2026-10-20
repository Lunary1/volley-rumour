-- Authors withdraw their own pending or lopend rumour and edit it while it is
-- pending (issue #192, D-042). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(46);

-- An author, another author, a moderator and a suspended author.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000192a', 'in_auteur@example.test', '{"username": "intrek_test_auteur"}'),
  ('00000000-0000-0000-0000-00000000192b', 'in_ander@example.test', '{"username": "intrek_test_ander"}'),
  ('00000000-0000-0000-0000-00000000192c', 'in_mod@example.test', '{"username": "intrek_test_mod"}'),
  ('00000000-0000-0000-0000-00000000192d', 'in_geschorst@example.test', '{"username": "intrek_test_geschorst"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000192c';
INSERT INTO public.user_suspensions (user_id, suspended_until, reason) VALUES
  ('00000000-0000-0000-0000-00000000192d', NULL, 'Test');

-- f1 pending and f2 lopend: the author's to edit and withdraw. f3–f6 are
-- past the point of withdrawing. f7 is someone else's. f8/f9 belong to the
-- suspended author. f0 was withdrawn 13 months ago.
INSERT INTO public.rumours (id, creator_id, player_name, category, status,
                            from_club_name, to_club_name, description,
                            source_type, declared_good_faith, declared_senior) VALUES
  ('00000000-0000-0000-0000-0000000192f1', '00000000-0000-0000-0000-00000000192a', 'Pia Pending', 'transfer', 'pending', 'Club A', 'Club B', NULL, 'club', true, true),
  ('00000000-0000-0000-0000-0000000192f2', '00000000-0000-0000-0000-00000000192a', 'Lou Lopend', 'transfer', 'rumour', 'Club A', 'Club C', 'Gehoord', 'club', true, true),
  ('00000000-0000-0000-0000-0000000192f3', '00000000-0000-0000-0000-00000000192a', 'Ben Bevestigd', 'transfer', 'confirmed', 'Club A', 'Club D', NULL, 'club', true, true),
  ('00000000-0000-0000-0000-0000000192f4', '00000000-0000-0000-0000-00000000192a', 'Olle Ontkracht', 'transfer', 'denied', 'Club A', 'Club E', NULL, 'club', true, true),
  ('00000000-0000-0000-0000-0000000192f5', '00000000-0000-0000-0000-00000000192a', 'Vera Verlopen', 'transfer', 'expired', 'Club A', 'Club F', NULL, 'club', true, true),
  ('00000000-0000-0000-0000-0000000192f6', '00000000-0000-0000-0000-00000000192a', 'Ad Afgewezen', 'transfer', 'rejected', 'Club A', 'Club G', NULL, 'club', true, true),
  ('00000000-0000-0000-0000-0000000192f7', '00000000-0000-0000-0000-00000000192b', 'Ander Gerucht', 'transfer', 'pending', 'Club A', 'Club H', NULL, 'club', true, true),
  ('00000000-0000-0000-0000-0000000192f8', '00000000-0000-0000-0000-00000000192d', 'Gesch Lopend', 'transfer', 'rumour', 'Club A', 'Club I', NULL, 'club', true, true),
  ('00000000-0000-0000-0000-0000000192f9', '00000000-0000-0000-0000-00000000192d', 'Gesch Pending', 'transfer', 'pending', 'Club A', 'Club J', NULL, 'club', true, true);
INSERT INTO public.rumours (id, creator_id, player_name, category, status,
                            from_club_name, to_club_name, description, source_url, withdrawn_at) VALUES
  ('00000000-0000-0000-0000-0000000192f0', '00000000-0000-0000-0000-00000000192a', 'Oud Ingetrokken', 'transfer', 'withdrawn',
   'Club A', 'Club K', 'Lang geleden', 'https://example.test/oud', now() - interval '13 months');

-- A takedown request and a report about the lopend rumour.
INSERT INTO public.takedown_requests (id, reference, token_hash, rumour_id, relation, requester_name, requester_email, explanation) VALUES
  ('00000000-0000-0000-0000-0000000192d1', 'VR-INTREK', md5('in1') || md5('in2'), '00000000-0000-0000-0000-0000000192f2',
   'self', 'Lou Lopend', 'lou@example.test', 'Haal mijn naam weg.');
INSERT INTO public.reports (id, target_type, rumour_id, reporter_id, reason) VALUES
  ('00000000-0000-0000-0000-0000000192e1', 'rumour', '00000000-0000-0000-0000-0000000192f2',
   '00000000-0000-0000-0000-00000000192b', 'private_info');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- How many rows an edit by the current user changed: RLS skips rows silently.
CREATE FUNCTION pg_temp.rename(rumour uuid, name text) RETURNS integer LANGUAGE sql AS $$
  WITH changed AS (
    UPDATE public.rumours SET player_name = name WHERE id = rumour RETURNING 1
  )
  SELECT count(*)::int FROM changed;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.rename(uuid, text) TO authenticated;

-- Submits a rumour as the current user, the way the app does.
CREATE FUNCTION pg_temp.submit(name text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.rumours (creator_id, player_name, category, source_type,
                              declared_good_faith, declared_senior)
  VALUES ((SELECT auth.uid()), name, 'trainer_retirement', 'own_observation', true, true);
$$;
GRANT EXECUTE ON FUNCTION pg_temp.submit(text) TO authenticated;

-- ------------------------------------------------------------- who may call
SELECT ok(
  NOT has_function_privilege('anon', 'public.withdraw_rumour(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.withdraw_rumour(uuid)', 'EXECUTE'),
  'signed-in users can call withdraw_rumour(), visitors cannot');
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.wipe_withdrawn_rumours()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.wipe_withdrawn_rumours()', 'EXECUTE'),
  'only the service role can wipe withdrawn rumours');

-- ---------------------------------------------------------------- withdraw
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000192a');
SELECT lives_ok(
  $$SELECT public.withdraw_rumour('00000000-0000-0000-0000-0000000192f2')$$,
  'the author withdraws their lopend rumour');
SELECT is(
  (SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000192f2'),
  'withdrawn', 'the rumour is withdrawn');
SELECT ok(
  (SELECT withdrawn_at IS NOT NULL FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000192f2'),
  'withdrawn_at is recorded');
SELECT throws_ok(
  $$SELECT public.withdraw_rumour('00000000-0000-0000-0000-0000000192f2')$$,
  'VR013', NULL, 'a withdrawn rumour cannot be withdrawn again');
SELECT throws_ok(
  $$SELECT public.withdraw_rumour('00000000-0000-0000-0000-0000000192f3')$$,
  'VR013', NULL, 'a confirmed rumour cannot be withdrawn');
SELECT throws_ok(
  $$SELECT public.withdraw_rumour('00000000-0000-0000-0000-0000000192f4')$$,
  'VR013', NULL, 'a denied rumour cannot be withdrawn');
SELECT throws_ok(
  $$SELECT public.withdraw_rumour('00000000-0000-0000-0000-0000000192f5')$$,
  'VR013', NULL, 'an expired rumour cannot be withdrawn');
SELECT throws_ok(
  $$SELECT public.withdraw_rumour('00000000-0000-0000-0000-0000000192f6')$$,
  'VR013', NULL, 'a rejected rumour cannot be withdrawn');
SELECT throws_ok(
  $$SELECT public.withdraw_rumour('00000000-0000-0000-0000-0000000192f7')$$,
  'P0002', NULL, 'nobody withdraws someone else''s rumour');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000192c');
SELECT throws_ok(
  $$SELECT public.withdraw_rumour('00000000-0000-0000-0000-0000000192f7')$$,
  'P0002', NULL, 'staff cannot withdraw on an author''s behalf');

RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.withdraw_rumour('00000000-0000-0000-0000-0000000192f1')$$,
  '42501', NULL, 'visitors cannot withdraw');

-- -------------------------------------------------------- who sees it
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000192f2'),
  0, 'visitors no longer see a withdrawn rumour');
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000192b');
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000192f2'),
  0, 'other users no longer see a withdrawn rumour');
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000192a');
SELECT is(
  (SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000192f2'),
  'withdrawn', 'the author still sees it, as withdrawn');
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000192c');
SELECT is(
  (SELECT player_name FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000192f2'),
  'Lou Lopend', 'staff still see its content');
SELECT is(
  (SELECT count(*)::int FROM public.takedown_requests
    WHERE rumour_id = '00000000-0000-0000-0000-0000000192f2' AND status = 'open'),
  1, 'the open takedown request stays in the inbox');
SELECT is(
  (SELECT count(*)::int FROM public.reports
    WHERE rumour_id = '00000000-0000-0000-0000-0000000192f2' AND status = 'open'),
  1, 'the open report stays in the inbox');

-- -------------------------------------------------- pending cap and queue
-- The author has f1 pending; four more reach the cap of 5.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000192a');
SELECT pg_temp.submit('Cap Twee');
SELECT pg_temp.submit('Cap Drie');
SELECT pg_temp.submit('Cap Vier');
SELECT pg_temp.submit('Cap Vijf');
SELECT throws_ok($$SELECT pg_temp.submit('Cap Zes')$$, 'VR001', NULL,
  'the pending cap is reached');
SELECT lives_ok(
  $$SELECT public.withdraw_rumour((SELECT id FROM public.rumours WHERE player_name = 'Cap Vijf'))$$,
  'the author withdraws a pending rumour');
SELECT lives_ok($$SELECT pg_temp.submit('Cap Zes')$$,
  'a withdrawn pending rumour frees a slot');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000192c');
SELECT throws_ok(
  $$SELECT public.approve_rumour((SELECT id FROM public.rumours WHERE player_name = 'Cap Vijf'))$$,
  'P0002', NULL, 'a moderator can no longer approve a withdrawn rumour');

-- ---------------------------------------------------------- track record
RESET ROLE;
SELECT is(
  (SELECT (rumours_confirmed, rumours_denied)::text FROM public.profiles
    WHERE id = '00000000-0000-0000-0000-00000000192a'),
  '(1,1)', 'withdrawn rumours do not count in the track record');

-- -------------------------------------------------------------------- edit
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000192a');
SELECT lives_ok(
  $$UPDATE public.rumours
       SET player_name = 'Pia Verbeterd', to_club_name = 'Club Z', from_division = 'nat1_dames',
           gender = 'female', description = 'Typfout', source_type = 'media',
           source_url = 'https://example.test/artikel'
     WHERE id = '00000000-0000-0000-0000-0000000192f1'$$,
  'the author edits their pending rumour');
SELECT is(
  (SELECT player_name || ' → ' || to_club_name FROM public.rumours
    WHERE id = '00000000-0000-0000-0000-0000000192f1'),
  'Pia Verbeterd → Club Z', 'the edit is saved');
SELECT is(
  (SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000192f1'),
  'pending', 'an edited rumour stays pending');
SELECT throws_ok(
  $$UPDATE public.rumours SET source_type = NULL WHERE id = '00000000-0000-0000-0000-0000000192f1'$$,
  '23514', NULL, 'an edit keeps the source type');
SELECT throws_ok(
  $$UPDATE public.rumours SET declared_senior = false WHERE id = '00000000-0000-0000-0000-0000000192f1'$$,
  '23514', NULL, 'an edit keeps the declarations');
SELECT throws_ok(
  $$UPDATE public.rumours SET source_url = 'javascript:alert(1)' WHERE id = '00000000-0000-0000-0000-0000000192f1'$$,
  '23514', NULL, 'an edit keeps the source link http(s)');
SELECT throws_ok(
  $$UPDATE public.rumours SET to_division = 'u17_meisjes' WHERE id = '00000000-0000-0000-0000-0000000192f1'$$,
  '23514', NULL, 'an edit keeps senior divisions only');
SELECT throws_ok(
  $$UPDATE public.rumours SET gender = 'x' WHERE id = '00000000-0000-0000-0000-0000000192f1'$$,
  '23514', NULL, 'an edit keeps the gender values');
SELECT throws_ok(
  $$UPDATE public.rumours SET status = 'rumour' WHERE id = '00000000-0000-0000-0000-0000000192f1'$$,
  '42501', NULL, 'the author cannot approve their own rumour');
SELECT throws_ok(
  $$UPDATE public.rumours SET withdrawn_at = NULL WHERE id = '00000000-0000-0000-0000-0000000192f2'$$,
  '42501', NULL, 'the author cannot undo a withdrawal');
SELECT is(pg_temp.rename('00000000-0000-0000-0000-0000000192f3', 'X'), 0,
  'a confirmed rumour cannot be edited');
SELECT is(pg_temp.rename('00000000-0000-0000-0000-0000000192f6', 'X'), 0,
  'a rejected rumour cannot be edited');
SELECT is(pg_temp.rename('00000000-0000-0000-0000-0000000192f2', 'X'), 0,
  'a withdrawn rumour cannot be edited');
SELECT is(pg_temp.rename('00000000-0000-0000-0000-0000000192f7', 'X'), 0,
  'nobody edits someone else''s rumour');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000192c');
SELECT is(pg_temp.rename('00000000-0000-0000-0000-0000000192f7', 'X'), 0,
  'staff do not edit rumours through the API either');

RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$UPDATE public.rumours SET player_name = 'X' WHERE id = '00000000-0000-0000-0000-0000000192f1'$$,
  '42501', NULL, 'visitors cannot edit');

-- -------------------------------------------------------------- suspended
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000192d');
SELECT throws_ok(
  $$UPDATE public.rumours SET player_name = 'Gesch Bewerkt' WHERE id = '00000000-0000-0000-0000-0000000192f9'$$,
  'VR005', NULL, 'a suspended author cannot edit');
SELECT lives_ok(
  $$SELECT public.withdraw_rumour('00000000-0000-0000-0000-0000000192f8')$$,
  'a suspended author can still withdraw');
RESET ROLE;
SELECT is(
  (SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000192f8'),
  'withdrawn', 'the suspended author''s rumour is withdrawn');

-- -------------------------------------------------------------- retention
SELECT is(public.wipe_withdrawn_rumours(), 1,
  'the wipe only touches rumours withdrawn over 12 months ago');
SELECT is(
  (SELECT row(player_name, from_club_name, to_club_name, description, source_url,
              anonymised_at IS NOT NULL)::text
     FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000192f0'),
  '("Ingetrokken gerucht",,,,,t)', 'its name, clubs, description and link are wiped');
SELECT is(
  (SELECT player_name FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000192f2'),
  'Lou Lopend', 'a rumour withdrawn today keeps its text');

SELECT * FROM finish();
ROLLBACK;
