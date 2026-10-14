-- Moderators approve or reject pending rumours, and every decision is logged
-- (issue #66, D-012). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(22);

-- An author, a moderator and a visitor-like user.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000066a', 'mq_auteur@example.test', '{"username": "mq_test_auteur"}'),
  ('00000000-0000-0000-0000-00000000066b', 'mq_staff@example.test', '{"username": "mq_test_staff"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000066b';

INSERT INTO public.rumours (id, creator_id, player_name, category) VALUES
  ('00000000-0000-0000-0000-0000000066f1', '00000000-0000-0000-0000-00000000066a', 'Goed Te Keuren', 'transfer'),
  ('00000000-0000-0000-0000-0000000066f2', '00000000-0000-0000-0000-00000000066a', 'Af Te Wijzen', 'transfer'),
  ('00000000-0000-0000-0000-0000000066f3', '00000000-0000-0000-0000-00000000066b', 'Van De Moderator', 'transfer');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- ------------------------------------------------------------- who may act
SELECT ok(
  NOT has_function_privilege('anon', 'public.approve_rumour(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.reject_rumour(uuid, text, text)', 'EXECUTE'),
  'visitors cannot call the moderation functions');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000066a');
SELECT throws_ok(
  $$SELECT public.approve_rumour('00000000-0000-0000-0000-0000000066f1')$$,
  '42501', NULL, 'a user cannot approve a rumour, not even their own');
SELECT throws_ok(
  $$SELECT public.reject_rumour('00000000-0000-0000-0000-0000000066f1', 'no_source')$$,
  '42501', NULL, 'a user cannot reject a rumour');
SELECT throws_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, category, rejection_reason)
    VALUES ('00000000-0000-0000-0000-00000000066a', 'Zelf Afgewezen', 'transfer', 'other')$$,
  '42501', NULL, 'a user cannot set a rejection reason');
RESET ROLE;

-- ----------------------------------------------------------------- approve
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000066b');
SELECT lives_ok(
  $$SELECT public.approve_rumour('00000000-0000-0000-0000-0000000066f1')$$,
  'a moderator can approve a pending rumour');
SELECT is(
  (SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000066f1'),
  'rumour', 'an approved rumour is live');
SELECT results_eq(
  $$SELECT actor_id, action, target_type, reason FROM public.staff_actions
    WHERE target_id = '00000000-0000-0000-0000-0000000066f1'$$,
  $$VALUES ('00000000-0000-0000-0000-00000000066b'::uuid, 'rumour_approved', 'rumour', NULL::text)$$,
  'the approval is logged with the moderator');
SELECT throws_ok(
  $$SELECT public.approve_rumour('00000000-0000-0000-0000-0000000066f1')$$,
  'P0002', NULL, 'a rumour cannot be approved twice');
SELECT throws_ok(
  $$SELECT public.reject_rumour('00000000-0000-0000-0000-0000000066f1', 'no_source')$$,
  'P0002', NULL, 'a live rumour cannot be rejected from the queue');
SELECT is(
  (SELECT count(*)::int FROM public.staff_actions WHERE target_id = '00000000-0000-0000-0000-0000000066f1'),
  1, 'a refused decision writes no log entry');
SELECT throws_ok(
  $$SELECT public.approve_rumour('00000000-0000-0000-0000-0000000066ff')$$,
  'P0002', NULL, 'a missing rumour cannot be approved');

-- A moderator may moderate their own rumour; the log shows who did (D-012).
SELECT lives_ok(
  $$SELECT public.approve_rumour('00000000-0000-0000-0000-0000000066f3')$$,
  'a moderator can approve their own rumour');

-- ------------------------------------------------------------------ reject
SELECT throws_ok(
  $$SELECT public.reject_rumour('00000000-0000-0000-0000-0000000066f2', 'te_saai')$$,
  '22023', NULL, 'the reason must be on the fixed list');
SELECT throws_ok(
  $$SELECT public.reject_rumour('00000000-0000-0000-0000-0000000066f2', 'other', '   ')$$,
  '22023', NULL, 'the reason other needs a note');
SELECT is(
  (SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000066f2'),
  'pending', 'an invalid rejection leaves the rumour pending');
SELECT lives_ok(
  $$SELECT public.reject_rumour('00000000-0000-0000-0000-0000000066f2', 'duplicate', '  Zie het gerucht van gisteren  ')$$,
  'a moderator can reject a pending rumour with a reason');
SELECT results_eq(
  $$SELECT status, rejection_reason, rejection_note FROM public.rumours
    WHERE id = '00000000-0000-0000-0000-0000000066f2'$$,
  $$VALUES ('rejected', 'duplicate', 'Zie het gerucht van gisteren')$$,
  'the rumour is rejected with its reason and trimmed note');
SELECT results_eq(
  $$SELECT action, reason, details->>'reason' FROM public.staff_actions
    WHERE target_id = '00000000-0000-0000-0000-0000000066f2'$$,
  $$VALUES ('rumour_rejected', 'Dubbel gerucht: Zie het gerucht van gisteren', 'duplicate')$$,
  'the rejection is logged with the reason as the author reads it');
RESET ROLE;

-- ------------------------------------------------------------ who sees it
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000066a');
SELECT results_eq(
  $$SELECT rejection_reason, rejection_note FROM public.rumours
    WHERE id = '00000000-0000-0000-0000-0000000066f2'$$,
  $$VALUES ('duplicate', 'Zie het gerucht van gisteren')$$,
  'the author sees why their rumour was rejected');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000066f1'),
  1, 'a visitor sees the approved rumour');
SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000066f2'),
  0, 'a visitor cannot see the rejected rumour or its reason');
RESET ROLE;

SELECT throws_ok(
  $$UPDATE public.rumours SET rejection_reason = 'no_source'
    WHERE id = '00000000-0000-0000-0000-0000000066f1'$$,
  '23514', NULL, 'only a rejected rumour can have a rejection reason');

SELECT * FROM finish();
ROLLBACK;
