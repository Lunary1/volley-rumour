-- Moderators resolve live rumours and manage confirmed transfers, and every
-- action is logged (issue #70, D-020, J-14). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(44);

-- An author, a moderator and another user.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000070a', 'rr_auteur@example.test', '{"username": "rr_test_auteur"}'),
  ('00000000-0000-0000-0000-00000000070b', 'rr_staff@example.test', '{"username": "rr_test_staff"}'),
  ('00000000-0000-0000-0000-00000000070c', 'rr_lezer@example.test', '{"username": "rr_test_lezer"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000070b';

INSERT INTO public.rumours (
  id, creator_id, player_name, category, status, from_club_name, to_club_name, from_division, to_division
) VALUES
  ('00000000-0000-0000-0000-0000000070f1', '00000000-0000-0000-0000-00000000070a', 'Bea Bevestigd', 'transfer', 'rumour',
   'Club A', 'Club B', 'nat2_dames', 'nat1_dames'),
  ('00000000-0000-0000-0000-0000000070f2', '00000000-0000-0000-0000-00000000070a', 'Otto Ontkracht', 'transfer', 'rumour',
   'Club A', 'Club B', NULL, NULL),
  ('00000000-0000-0000-0000-0000000070f3', '00000000-0000-0000-0000-00000000070a', 'Vic Vervallen', 'trainer_retirement', 'rumour',
   'Club A', NULL, 'promo1_heren', NULL),
  ('00000000-0000-0000-0000-0000000070f4', '00000000-0000-0000-0000-00000000070a', 'Bart Bulk', 'transfer', 'rumour',
   'Club A', 'Club C', NULL, NULL),
  ('00000000-0000-0000-0000-0000000070f5', '00000000-0000-0000-0000-00000000070a', 'Wim Wachtend', 'transfer', 'pending',
   'Club A', 'Club C', NULL, NULL),
  ('00000000-0000-0000-0000-0000000070f6', '00000000-0000-0000-0000-00000000070a', 'Gert Gerectificeerd', 'trainer_transfer', 'rumour',
   'Club A', 'Club D', NULL, NULL);

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

CREATE FUNCTION pg_temp.status(rid uuid) RETURNS text LANGUAGE sql AS $$
  SELECT status FROM public.rumours WHERE id = rid;
$$;

-- ------------------------------------------------------------- who may act
SELECT ok(
  NOT has_function_privilege('anon', 'public.resolve_rumour(uuid, text, text, text, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.expire_open_rumours()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.create_transfer(text, text, text, text, text, date, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.update_transfer(uuid, text, text, text, text, text, date, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.delete_transfer(uuid, text)', 'EXECUTE'),
  'visitors cannot call the resolution and transfer functions');
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.checked_source_url(text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.check_transfer_fields(text, text, text, text, text)', 'EXECUTE'),
  'the helper checks are not callable through the API');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000070a');
SELECT throws_ok(
  $$SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000070f1', 'confirmed', 'https://club.test/nieuws', 'player_female')$$,
  '42501', NULL, 'a user cannot confirm a rumour, not even their own');
SELECT throws_ok(
  $$SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000070f2', 'denied')$$,
  '42501', NULL, 'a user cannot deny a rumour');
SELECT throws_ok(
  $$SELECT public.expire_open_rumours()$$,
  '42501', NULL, 'a user cannot expire all open rumours');
SELECT throws_ok(
  $$SELECT public.create_transfer('Zelf Gemaakt', 'player_male', 'Club A', 'Club B', NULL, current_date, 'https://club.test/x')$$,
  '42501', NULL, 'a user cannot add a transfer');
SELECT throws_ok(
  $$INSERT INTO public.transfers (player_name, category, to_club) VALUES ('Direct Erin', 'player_male', 'Club B')$$,
  '42501', NULL, 'a user cannot write to transfers directly');
SELECT throws_ok(
  $$UPDATE public.rumours SET resolution_source_url = 'https://nep.test' WHERE id = '00000000-0000-0000-0000-0000000070f1'$$,
  '42501', NULL, 'a user cannot set a resolution source');
RESET ROLE;

-- ---------------------------------------------------------------- confirm
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000070b');
SELECT throws_ok(
  $$SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000070f1', 'confirmed', NULL, 'player_female')$$,
  '22023', NULL, 'confirming needs an official source');
SELECT throws_ok(
  $$SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000070f1', 'confirmed', 'javascript:alert(1)', 'player_female')$$,
  '22023', NULL, 'the source must be an http(s) link');
SELECT throws_ok(
  $$SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000070f1', 'confirmed', 'https://club.test/nieuws')$$,
  '22023', NULL, 'confirming needs a transfer type');
SELECT throws_ok(
  $$SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000070f1', 'confirmed', 'https://club.test/nieuws', 'trainer_female')$$,
  '22023', NULL, 'the transfer type must fit the rumour');
SELECT throws_ok(
  $$SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000070f1', 'waar')$$,
  '22023', NULL, 'the outcome must be confirmed, denied or expired');
SELECT is(pg_temp.status('00000000-0000-0000-0000-0000000070f1'), 'rumour',
  'a refused confirmation leaves the rumour lopend');

SELECT isnt(
  public.resolve_rumour('00000000-0000-0000-0000-0000000070f1', 'confirmed', ' https://club.test/nieuws ', 'player_female', 'Club meldde het'),
  NULL, 'a moderator confirms a rumour and gets the new transfer');
SELECT results_eq(
  $$SELECT status, resolution_source_url, resolved_at IS NOT NULL FROM public.rumours
    WHERE id = '00000000-0000-0000-0000-0000000070f1'$$,
  $$VALUES ('confirmed', 'https://club.test/nieuws', true)$$,
  'the rumour is confirmed with its source and date');
SELECT results_eq(
  $$SELECT player_name, from_club, to_club, category, division, source_url FROM public.transfers
    WHERE source_rumour_id = '00000000-0000-0000-0000-0000000070f1'$$,
  $$VALUES ('Bea Bevestigd', 'Club A', 'Club B', 'player_female', 'nat1_dames', 'https://club.test/nieuws')$$,
  'the transfer has the type, clubs, new division and source');
SELECT throws_ok(
  $$SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000070f1', 'confirmed', 'https://club.test/nieuws', 'player_female')$$,
  'P0002', NULL, 'a confirmed rumour cannot be confirmed again');
SELECT is(
  (SELECT count(*)::int FROM public.transfers WHERE source_rumour_id = '00000000-0000-0000-0000-0000000070f1'),
  1, 'confirming twice makes one transfer');
SELECT results_eq(
  $$SELECT actor_id, action, reason, details->>'outcome', details->>'source_url' FROM public.staff_actions
    WHERE target_id = '00000000-0000-0000-0000-0000000070f1'$$,
  $$VALUES ('00000000-0000-0000-0000-00000000070b'::uuid, 'rumour_resolved', 'Bevestigd: Club meldde het', 'confirmed', 'https://club.test/nieuws')$$,
  'the confirmation is logged once, with the moderator and source');

-- ----------------------------------------------------------- deny, expire
SELECT lives_ok(
  $$SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000070f2', 'denied', NULL, NULL, 'Speler ontkende')$$,
  'a moderator denies a rumour without a link');
SELECT is(pg_temp.status('00000000-0000-0000-0000-0000000070f2'), 'denied', 'the rumour is denied');
SELECT lives_ok(
  $$SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000070f3', 'expired')$$,
  'a moderator marks a rumour "niet bevestigd"');
SELECT is(pg_temp.status('00000000-0000-0000-0000-0000000070f3'), 'expired', 'the rumour is expired');
SELECT is(
  (SELECT count(*)::int FROM public.transfers WHERE source_rumour_id IN (
    '00000000-0000-0000-0000-0000000070f2', '00000000-0000-0000-0000-0000000070f3')),
  0, 'denying or expiring makes no transfer');
RESET ROLE;

-- Expired rumours are public, closed to votes and can still be reported.
SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000070f3'),
  1, 'visitors see an expired rumour');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000070c');
SELECT throws_ok(
  $$INSERT INTO public.rumour_votes (rumour_id, user_id, vote_type)
    VALUES ('00000000-0000-0000-0000-0000000070f3', '00000000-0000-0000-0000-00000000070c', true)$$,
  'VR010', NULL, 'voting is closed on an expired rumour');
SELECT lives_ok(
  $$SELECT public.submit_report('rumour', '00000000-0000-0000-0000-0000000070f3', 'incorrect')$$,
  'an expired rumour can be reported');
RESET ROLE;

-- ------------------------------------------------------------ bulk expire
CREATE TEMP TABLE open_before ON COMMIT DROP AS
  SELECT id FROM public.rumours WHERE status = 'rumour';
GRANT SELECT ON open_before TO authenticated;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000070b');
SELECT is(
  public.expire_open_rumours(),
  (SELECT count(*)::int FROM open_before),
  'bulk expiring returns how many lopende rumours it closed');
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE status = 'rumour'),
  0, 'no rumour is lopend afterwards');
SELECT is(pg_temp.status('00000000-0000-0000-0000-0000000070f5'), 'pending',
  'a pending rumour is not expired');
SELECT is(pg_temp.status('00000000-0000-0000-0000-0000000070f2'), 'denied',
  'a denied rumour stays denied');
SELECT is(
  (SELECT count(*)::int FROM public.staff_actions
    WHERE action = 'rumour_resolved' AND (details->>'bulk')::boolean
      AND target_id IN (SELECT id FROM open_before)),
  (SELECT count(*)::int FROM open_before),
  'every expired rumour has its own log entry');

-- -------------------------------------------------------------- transfers
UPDATE public.rumours SET status = 'rumour', resolved_at = NULL
 WHERE id = '00000000-0000-0000-0000-0000000070f6';
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000070b');
SELECT throws_ok(
  $$SELECT public.create_transfer('Nieuw Gekomen', 'player_male', 'Club A', 'Club B', NULL, current_date, NULL)$$,
  '22023', NULL, 'a transfer needs an official source');
SELECT throws_ok(
  $$SELECT public.create_transfer('Nieuw Gekomen', 'player_male', 'Club A', NULL, NULL, current_date, 'https://club.test/x')$$,
  '22023', NULL, 'a transfer needs a new club');
SELECT throws_ok(
  $$SELECT public.create_transfer('Nieuw Gekomen', 'player_male', 'Club A', 'Club B', NULL, current_date + 2, 'https://club.test/x')$$,
  '22023', NULL, 'a transfer cannot be dated in the future');
SELECT throws_ok(
  $$SELECT public.create_transfer('Nieuw Gekomen', 'player_male', 'Club A', 'Club B', 'u17_heren', current_date, 'https://club.test/x')$$,
  '22023', NULL, 'the division must be a senior division');

CREATE TEMP TABLE made ON COMMIT DROP AS
  SELECT public.create_transfer('Stoppende Speler', 'player_retirement', 'Club A', 'Club B', NULL, '2026-10-01', 'https://club.test/stopt') AS id;
SELECT results_eq(
  $$SELECT to_club, category, confirmed_at FROM public.transfers WHERE id = (SELECT id FROM made)$$,
  $$VALUES (NULL::text, 'player_retirement', '2026-10-01 00:00 Europe/Brussels'::timestamptz)$$,
  'a moderator adds a retirement: no new club, dated in Belgian time');

SELECT lives_ok(
  $$SELECT public.update_transfer((SELECT id FROM made), 'Stoppende Speelster', 'player_retirement', 'Club A', NULL, NULL, '2026-10-02', 'https://club.test/stopt')$$,
  'a moderator corrects a transfer');
SELECT results_eq(
  $$SELECT action, details->'before'->>'player_name' FROM public.staff_actions
    WHERE target_id = (SELECT id FROM made) ORDER BY created_at, action$$,
  $$VALUES ('transfer_created', NULL::text), ('transfer_updated', 'Stoppende Speler')$$,
  'adding and correcting are logged, the correction with what it said before');

-- Confirm Gert, then remove the transfer: the confirmation was a mistake.
SELECT lives_ok(
  $$SELECT public.resolve_rumour('00000000-0000-0000-0000-0000000070f6', 'confirmed', 'https://club.test/gert', 'trainer_male')$$,
  'a moderator confirms another rumour');
SELECT lives_ok(
  $$SELECT public.delete_transfer(
      (SELECT id FROM public.transfers WHERE source_rumour_id = '00000000-0000-0000-0000-0000000070f6'),
      'Verkeerd bevestigd')$$,
  'a moderator removes a transfer');
SELECT results_eq(
  $$SELECT status, resolved_at IS NULL, resolution_source_url IS NULL FROM public.rumours
    WHERE id = '00000000-0000-0000-0000-0000000070f6'$$,
  $$VALUES ('rumour', true, true)$$,
  'removing a rumour''s transfer makes the rumour lopend again');
SELECT is(
  (SELECT reason FROM public.staff_actions WHERE action = 'transfer_deleted'
    AND details->'before'->>'source_rumour_id' = '00000000-0000-0000-0000-0000000070f6'),
  'Verkeerd bevestigd', 'the removal is logged with its reason');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
