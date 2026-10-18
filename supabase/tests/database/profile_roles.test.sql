-- Staff roles are hidden from the API (issue #111). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000006a', 'user@example.test', '{"username": "roles_test_user"}'),
  ('00000000-0000-0000-0000-00000000006b', 'mod@example.test', '{"username": "roles_test_mod"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000006b';

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- Anonymous visitors
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SELECT throws_ok(
  $$SELECT role FROM public.profiles$$,
  '42501', NULL, 'a visitor cannot read roles');
SELECT throws_ok(
  $$SELECT * FROM public.profiles$$,
  '42501', NULL, 'a visitor cannot read roles through select *');
SELECT throws_ok(
  $$SELECT id FROM public.profiles WHERE role = 'moderator'$$,
  '42501', NULL, 'a visitor cannot filter on role');
SELECT is(
  (SELECT username FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000006b'),
  'roles_test_mod', 'a visitor still reads public profile columns');
RESET ROLE;

-- A normal signed-in user, also for their own row
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000006a');
SELECT throws_ok(
  $$SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000006b'$$,
  '42501', NULL, 'a user cannot read someone else''s role');
SELECT throws_ok(
  $$SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000006a'$$,
  '42501', NULL, 'a user cannot read their own role either');
SELECT lives_ok(
  $$SELECT id, username, avatar_path, is_verified_source, rumours_confirmed, rumours_denied
      FROM public.profiles$$,
  'a user still reads username, avatar, verified badge and track record');
RESET ROLE;

-- Staff learn their own status from is_staff(), not from the column
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000006b');
SELECT throws_ok(
  $$SELECT role FROM public.profiles$$,
  '42501', NULL, 'a moderator cannot read roles through the API');
SELECT is(public.is_staff(), true, 'a moderator is still recognised by is_staff()');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
