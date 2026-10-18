-- Sign-up usernames (issue #89): a username chosen on the form is stored in
-- lowercase or refused with VR012, never quietly given a suffix. Google
-- sign-ups, which don't choose one, still get a suffix when theirs is taken.
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000089a', 'su_eerste@example.test',
   '{"provider": "email", "providers": ["email"]}',
   '{"username": "Su_Eerste"}');

SELECT is(
  (SELECT username FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000089a'),
  'su_eerste',
  'a chosen username is stored in lowercase'
);

SELECT throws_ok(
  $$ INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
     ('00000000-0000-0000-0000-00000000089b', 'su_tweede@example.test',
      '{"provider": "email", "providers": ["email"]}',
      '{"username": "su_eerste"}') $$,
  'VR012', 'Username already taken',
  'a taken username is refused'
);
SELECT throws_ok(
  $$ INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
     ('00000000-0000-0000-0000-00000000089b', 'su_tweede@example.test',
      '{"provider": "email", "providers": ["email"]}',
      '{"username": "SU_EERSTE"}') $$,
  'VR012', 'Username already taken',
  'whatever its case'
);
SELECT is_empty(
  $$ SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000089b' $$,
  'and the account is not made'
);
SELECT is_empty(
  $$ SELECT 1 FROM public.profiles WHERE username LIKE 'su\_eerste\_%' $$,
  'no suffixed username either'
);

SELECT throws_ok(
  $$ INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
     ('00000000-0000-0000-0000-00000000089b', 'su_tweede@example.test',
      '{"provider": "email", "providers": ["email"]}',
      '{"username": "jan peeters"}') $$,
  'VR012', 'Invalid username',
  'a username with other characters is refused'
);
SELECT throws_ok(
  $$ INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
     ('00000000-0000-0000-0000-00000000089b', 'su_tweede@example.test',
      '{"provider": "email", "providers": ["email"]}',
      '{"username": "su"}') $$,
  'VR012', 'Invalid username',
  'so is one shorter than 3'
);

-- Google: the username comes from the email address.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000089c', 'su.google@example.test',
   '{"provider": "google", "providers": ["google"]}',
   '{"full_name": "Su Google"}'),
  ('00000000-0000-0000-0000-00000000089d', 'su.google@other.test',
   '{"provider": "google", "providers": ["google"]}',
   '{"full_name": "Su Google Twee"}');

SELECT is(
  (SELECT username FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000089c'),
  'su_google',
  'a Google sign-up gets a username from its email address'
);
SELECT matches(
  (SELECT username FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000089d'),
  '^su_google_[0-9a-f]{4}$',
  'and a suffix when that one is taken'
);
SELECT is(
  (SELECT count(*)::int FROM public.profiles
   WHERE id IN ('00000000-0000-0000-0000-00000000089c', '00000000-0000-0000-0000-00000000089d')),
  2,
  'both Google accounts have a profile'
);

SELECT * FROM finish();
ROLLBACK;
