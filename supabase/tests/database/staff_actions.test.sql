-- Audit log of staff actions (issue #64, D-011). Run with `npm run db:test`.
-- The seed adds entries too, so checks look only at this test's actor.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000006a', 'log_user@example.test', '{"username": "log_test_user"}'),
  ('00000000-0000-0000-0000-00000000006b', 'log_mod@example.test', '{"username": "log_test_mod"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000006b';

-- Claims of a user, without switching role: moderation functions run as their
-- owner (SECURITY DEFINER) and call log_staff_action() from there.
CREATE FUNCTION pg_temp.claims(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.claims(uid);
  SET LOCAL ROLE authenticated;
$$;

-- ----------------------------------------------------------------- writing
SELECT pg_temp.claims('00000000-0000-0000-0000-00000000006b');
SELECT lives_ok(
  $$SELECT public.log_staff_action('rumour_rejected', 'rumour', '00000000-0000-0000-0000-0000000000f1', '  Geen bron  ', '{"queue": "geruchten"}')$$,
  'a moderation function can log an action for a moderator');
SELECT results_eq(
  $$SELECT actor_id, action, target_type, target_id, reason, details->>'queue' FROM public.staff_actions WHERE actor_id = '00000000-0000-0000-0000-00000000006b'$$,
  $$VALUES ('00000000-0000-0000-0000-00000000006b'::uuid, 'rumour_rejected', 'rumour', '00000000-0000-0000-0000-0000000000f1'::uuid, 'Geen bron', 'geruchten')$$,
  'the entry records who, what, target and the trimmed reason');
SELECT ok(
  (SELECT created_at = now() FROM public.staff_actions WHERE actor_id = '00000000-0000-0000-0000-00000000006b'),
  'the entry records when');

SELECT throws_ok(
  $$SELECT public.log_staff_action('vote_cast', 'rumour', '00000000-0000-0000-0000-0000000000f1')$$,
  '23514', NULL, 'unknown actions are rejected');

SELECT pg_temp.claims('00000000-0000-0000-0000-00000000006a');
SELECT throws_ok(
  $$SELECT public.log_staff_action('rumour_approved', 'rumour', '00000000-0000-0000-0000-0000000000f1')$$,
  '42501', NULL, 'a normal user cannot be logged as staff');

-- ---------------------------------------------------------- API access
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000006b');
SELECT is((SELECT count(*)::int FROM public.staff_actions WHERE actor_id = '00000000-0000-0000-0000-00000000006b'), 1, 'staff can read the log');
SELECT throws_ok(
  $$SELECT public.log_staff_action('rumour_approved', 'rumour', '00000000-0000-0000-0000-0000000000f1')$$,
  '42501', NULL, 'staff cannot write entries through the API directly');
SELECT throws_ok(
  $$INSERT INTO public.staff_actions (actor_id, action, target_type, target_id) VALUES ('00000000-0000-0000-0000-00000000006b', 'rumour_approved', 'rumour', '00000000-0000-0000-0000-0000000000f1')$$,
  '42501', NULL, 'staff cannot insert into the log');
SELECT throws_ok(
  $$UPDATE public.staff_actions SET reason = 'Gewijzigd' WHERE actor_id = '00000000-0000-0000-0000-00000000006b'$$,
  '42501', NULL, 'staff cannot edit entries');
SELECT throws_ok(
  $$DELETE FROM public.staff_actions WHERE actor_id = '00000000-0000-0000-0000-00000000006b'$$,
  '42501', NULL, 'staff cannot delete entries');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000006a');
SELECT is((SELECT count(*)::int FROM public.staff_actions), 0, 'a normal user sees no entries');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT count(*) FROM public.staff_actions$$, '42501', NULL, 'anonymous visitors cannot read the log');
RESET ROLE;

-- --------------------------------------------- append-only, even for owners
SELECT throws_ok(
  $$UPDATE public.staff_actions SET reason = 'Gewijzigd' WHERE actor_id = '00000000-0000-0000-0000-00000000006b'$$,
  '42501', NULL, 'the service side cannot edit entries either');
SELECT throws_ok(
  $$DELETE FROM public.staff_actions WHERE actor_id = '00000000-0000-0000-0000-00000000006b'$$,
  '42501', NULL, 'the service side cannot delete entries either');

-- --------------------------------------------------------- retention (D-011)
-- Backdate one entry past 2 years; the trigger blocks UPDATE, so disable it
-- just for this setup step.
ALTER TABLE public.staff_actions DISABLE TRIGGER staff_actions_append_only;
INSERT INTO public.staff_actions (actor_id, action, target_type, target_id, created_at)
VALUES ('00000000-0000-0000-0000-00000000006b', 'rumour_approved', 'rumour', '00000000-0000-0000-0000-0000000000f2', now() - interval '2 years 1 day');
ALTER TABLE public.staff_actions ENABLE TRIGGER staff_actions_append_only;

SELECT is(public.purge_expired_staff_actions(), 1, 'the purge removes only the expired entry');
SELECT is((SELECT count(*)::int FROM public.staff_actions WHERE actor_id = '00000000-0000-0000-0000-00000000006b'), 1, 'entries younger than 2 years stay');

SELECT * FROM finish();
ROLLBACK;
