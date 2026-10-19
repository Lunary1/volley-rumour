-- Removing a confirmed rumour also deletes its transfer, logged, on both
-- removal paths (issue #151, D-014). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

-- An author, a moderator and a reporter.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000151a', 'rt_auteur@example.test', '{"username": "rt_test_auteur"}'),
  ('00000000-0000-0000-0000-00000000151b', 'rt_staff@example.test', '{"username": "rt_test_staff"}'),
  ('00000000-0000-0000-0000-00000000151c', 'rt_melder@example.test', '{"username": "rt_test_melder"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000151b';

-- Two lopende rumours, confirmed below, and one that stays lopend.
INSERT INTO public.rumours (
  id, creator_id, player_name, category, status, from_club_name, to_club_name
) VALUES
  ('00000000-0000-0000-0000-0000000151f1', '00000000-0000-0000-0000-00000000151a', 'Tina Takedown', 'transfer', 'rumour', 'Club A', 'Club B'),
  ('00000000-0000-0000-0000-0000000151f2', '00000000-0000-0000-0000-00000000151a', 'Mark Melding', 'transfer', 'rumour', 'Club A', 'Club C'),
  ('00000000-0000-0000-0000-0000000151f3', '00000000-0000-0000-0000-00000000151a', 'Lot Lopend', 'transfer', 'rumour', 'Club A', 'Club D');

INSERT INTO public.takedown_requests (id, reference, token_hash, rumour_id, relation, requester_name, requester_email, explanation) VALUES
  ('00000000-0000-0000-0000-0000000151d1', 'VR-RTTAKE', md5('rt1') || md5('rt2'), '00000000-0000-0000-0000-0000000151f1',
   'self', 'Tina Takedown', 'tina@example.test', 'Haal mijn naam weg.'),
  ('00000000-0000-0000-0000-0000000151d3', 'VR-RTLOPE', md5('rt3') || md5('rt4'), '00000000-0000-0000-0000-0000000151f3',
   'self', 'Lot Lopend', 'lot@example.test', 'Haal mijn naam weg.');

INSERT INTO public.reports (id, target_type, rumour_id, reporter_id, reason) VALUES
  ('00000000-0000-0000-0000-0000000151e2', 'rumour', '00000000-0000-0000-0000-0000000151f2',
   '00000000-0000-0000-0000-00000000151c', 'private_info');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

CREATE FUNCTION pg_temp.has_transfer(rid uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM public.transfers WHERE source_rumour_id = rid);
$$;

CREATE FUNCTION pg_temp.transfer_log(rid uuid) RETURNS SETOF public.staff_actions LANGUAGE sql AS $$
  SELECT * FROM public.staff_actions
   WHERE action = 'transfer_deleted' AND details->>'rumour_removed' = rid::text;
$$;

SELECT ok(
  NOT has_function_privilege('anon', 'public.delete_transfer_of_removed_rumour(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.delete_transfer_of_removed_rumour(uuid, text)', 'EXECUTE'),
  'the transfer helper is not callable through the API');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000151b');
SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000151f1', 'confirmed', 'https://club.test/tina', 'player_female');
SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000151f2', 'confirmed', 'https://club.test/mark', 'player_male');
RESET ROLE;
SELECT ok(
  pg_temp.has_transfer('00000000-0000-0000-0000-0000000151f1')
  AND pg_temp.has_transfer('00000000-0000-0000-0000-0000000151f2'),
  'confirming made both transfers');

-- -------------------------------------------------------------- takedown
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000151b');
SELECT public.remove_rumour_for_takedown('00000000-0000-0000-0000-0000000151d1', 'Op vraag van de speelster.');
RESET ROLE;
SELECT is((SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000151f1'), 'removed',
  'the takedown removes the rumour');
SELECT ok(NOT pg_temp.has_transfer('00000000-0000-0000-0000-0000000151f1'),
  'the takedown deletes its transfer');
SELECT is((SELECT count(*)::int FROM pg_temp.transfer_log('00000000-0000-0000-0000-0000000151f1')), 1,
  'the deleted transfer is logged once');
SELECT is(
  (SELECT reason FROM pg_temp.transfer_log('00000000-0000-0000-0000-0000000151f1')),
  'Gerucht verwijderd na verwijderverzoek VR-RTTAKE',
  'the entry says why, without the note meant for the requester');
SELECT ok(
  (SELECT actor_id = '00000000-0000-0000-0000-00000000151b'
          AND details->'before'->>'player_name' = 'Tina Takedown'
     FROM pg_temp.transfer_log('00000000-0000-0000-0000-0000000151f1')),
  'the entry names the moderator and keeps the transfer as it was');

-- ---------------------------------------------------------------- report
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000151b');
SELECT public.remove_reported_content('00000000-0000-0000-0000-0000000151e2', 'Privégegevens.');
RESET ROLE;
SELECT is((SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000151f2'), 'removed',
  'the report removes the rumour');
SELECT ok(NOT pg_temp.has_transfer('00000000-0000-0000-0000-0000000151f2'),
  'removing after a report deletes its transfer');
SELECT is(
  (SELECT reason FROM pg_temp.transfer_log('00000000-0000-0000-0000-0000000151f2')),
  'Gerucht verwijderd na melding: Privégegevens.',
  'the entry says why');

-- ------------------------------------------------ nothing else is touched
SELECT ok(
  EXISTS (SELECT 1 FROM public.transfers WHERE player_name IN ('Tina Takedown', 'Mark Melding')) = false,
  'no transfer of a removed rumour is left');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000151b');
SELECT lives_ok(
  $$SELECT public.remove_rumour_for_takedown('00000000-0000-0000-0000-0000000151d3')$$,
  'removing a rumour without a transfer still works');
SELECT public.create_transfer('Tina Takedown', 'player_female', 'Club A', 'Club B', NULL, current_date, 'https://club.test/tina');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM pg_temp.transfer_log('00000000-0000-0000-0000-0000000151f3')), 0,
  'and logs no transfer deletion');
SELECT ok(
  EXISTS (SELECT 1 FROM public.transfers WHERE player_name = 'Tina Takedown' AND source_rumour_id IS NULL),
  'staff can add the transfer again by hand');

SELECT * FROM finish();
ROLLBACK;
