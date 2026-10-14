-- Staff check (issue #63, D-006). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);

-- A user, a moderator and an admin; the on_auth_user_created trigger creates
-- their profiles. Roles are set the way the owner sets them: not through the API.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000005a', 'user@example.test', '{"username": "staff_test_user"}'),
  ('00000000-0000-0000-0000-00000000005b', 'mod@example.test', '{"username": "staff_test_mod"}'),
  ('00000000-0000-0000-0000-00000000005c', 'admin@example.test', '{"username": "staff_test_admin"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000005b';
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-00000000005c';

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000005a');
SELECT is(public.is_staff(), false, 'a normal user is not staff');
SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000005a'$$,
  '42501', NULL, 'a normal user cannot make themselves staff');
SELECT is(public.is_staff(), false, 'and is still not staff afterwards');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000005b');
SELECT is(public.is_staff(), true, 'a moderator is staff');
SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-00000000005b'$$,
  '42501', NULL, 'a moderator cannot promote themselves to admin');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000005c');
SELECT is(public.is_staff(), true, 'an admin is staff');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SELECT is(public.is_staff(), false, 'an anonymous visitor is not staff');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
