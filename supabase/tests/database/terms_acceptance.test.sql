-- Age and terms gate (issue #75, D-003): email sign-up records the 16+
-- confirmation and the terms version with the account; everyone else accepts
-- once through accept_terms(). The database sets the version and the time.
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(21);

-- An email sign-up with both checkboxes, one with only one, a Google sign-up
-- (no checkboxes) and someone else.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000075a', 'ta_email@example.test',
   '{"provider": "email", "providers": ["email"]}',
   '{"username": "ta_email", "age_confirmed": true, "terms_accepted": true}'),
  ('00000000-0000-0000-0000-00000000075b', 'ta_half@example.test',
   '{"provider": "email", "providers": ["email"]}',
   '{"username": "ta_half", "terms_accepted": true}'),
  ('00000000-0000-0000-0000-00000000075c', 'ta_google@example.test',
   '{"provider": "google", "providers": ["google"]}',
   '{"full_name": "Ta Google"}'),
  ('00000000-0000-0000-0000-00000000075d', 'ta_ander@example.test',
   '{"provider": "email", "providers": ["email"]}',
   '{"username": "ta_ander", "age_confirmed": true, "terms_accepted": true}');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- ---------------------------------------------------------------- sign-up
SELECT results_eq(
  $$ SELECT terms_version FROM public.terms_acceptances
     WHERE user_id = '00000000-0000-0000-0000-00000000075a' $$,
  $$ VALUES (public.current_terms_version()) $$,
  'email sign-up with both checkboxes records the current terms version'
);
SELECT ok(
  (SELECT accepted_at = now() FROM public.terms_acceptances
   WHERE user_id = '00000000-0000-0000-0000-00000000075a'),
  'and the time of the sign-up'
);
SELECT is_empty(
  $$ SELECT 1 FROM public.terms_acceptances
     WHERE user_id = '00000000-0000-0000-0000-00000000075b' $$,
  'one checkbox is not enough'
);
SELECT is_empty(
  $$ SELECT 1 FROM public.terms_acceptances
     WHERE user_id = '00000000-0000-0000-0000-00000000075c' $$,
  'a Google sign-up records nothing'
);
SELECT is(
  (SELECT username FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000075c'),
  'ta_google',
  'the sign-up trigger still makes the profile'
);

-- ---------------------------------------------------------------- checking
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000075a');
SELECT ok(public.has_accepted_terms(), 'a user who accepted at sign-up has accepted');
SELECT is(
  (SELECT count(*)::int FROM public.terms_acceptances),
  1,
  'users only see their own acceptances'
);
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000075c');
SELECT ok(NOT public.has_accepted_terms(), 'a Google user has not accepted yet');

-- ---------------------------------------------------------------- accepting
SELECT lives_ok(
  $$ SELECT public.accept_terms() $$,
  'a user accepts the terms'
);
SELECT ok(public.has_accepted_terms(), 'and has accepted them now');
SELECT lives_ok(
  $$ SELECT public.accept_terms() $$,
  'accepting again is harmless'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.terms_acceptances
   WHERE user_id = '00000000-0000-0000-0000-00000000075c'),
  1,
  'and keeps one row'
);

-- An old version doesn't count.
UPDATE public.terms_acceptances SET terms_version = '2000-01-01'
WHERE user_id = '00000000-0000-0000-0000-00000000075a';
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000075a');
SELECT ok(NOT public.has_accepted_terms(), 'accepting an older version is not enough');
RESET ROLE;

-- ---------------------------------------------------------------- writes
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000075b');
SELECT throws_ok(
  $$ INSERT INTO public.terms_acceptances (user_id, terms_version)
     VALUES ('00000000-0000-0000-0000-00000000075b', public.current_terms_version()) $$,
  '42501',
  NULL,
  'users cannot insert acceptances themselves'
);
SELECT throws_ok(
  $$ UPDATE public.terms_acceptances SET accepted_at = now() - interval '1 year' $$,
  '42501',
  NULL,
  'or change them'
);
SELECT throws_ok(
  $$ DELETE FROM public.terms_acceptances $$,
  '42501',
  NULL,
  'or delete them'
);
RESET ROLE;

-- A suspended user may still accept: it isn't content.
INSERT INTO public.user_suspensions (user_id, suspended_until, reason)
VALUES ('00000000-0000-0000-0000-00000000075b', NULL, 'Test');
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000075b');
SELECT lives_ok(
  $$ SELECT public.accept_terms() $$,
  'a suspended user can accept the terms'
);
RESET ROLE;

-- ---------------------------------------------------------------- anon
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.accept_terms() $$,
  '42501',
  NULL,
  'visitors cannot accept'
);
SELECT throws_ok(
  $$ SELECT 1 FROM public.terms_acceptances $$,
  '42501',
  NULL,
  'or read acceptances'
);
RESET ROLE;

-- ---------------------------------------------------------------- deletion
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000075d';
SELECT is_empty(
  $$ SELECT 1 FROM public.terms_acceptances
     WHERE user_id = '00000000-0000-0000-0000-00000000075d' $$,
  'acceptances go with the account'
);

DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000075c';
SELECT isnt_empty(
  $$ SELECT 1 FROM public.terms_acceptances
     WHERE user_id = '00000000-0000-0000-0000-00000000075c' $$,
  'but belong to the account, not the profile'
);

SELECT * FROM finish();
ROLLBACK;
