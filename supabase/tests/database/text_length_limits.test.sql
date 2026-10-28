-- Length limits on text users write (GHSA-fjw6): the database refuses what
-- the forms refuse, because the API writes these tables directly. Google
-- sign-ups are shortened to fit instead of refused.
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(22);

-- Seeded rows: VC Testdorp's classified, a rumour, a message, jana's profile.
CREATE TEMP VIEW ids AS SELECT
  'd0000000-0000-4000-8000-000000000001'::uuid AS classified,
  'e0000000-0000-4000-8000-000000000004'::uuid AS rumour,
  (SELECT id FROM public.messages ORDER BY created_at LIMIT 1) AS message,
  (SELECT id FROM public.profiles WHERE username = 'speler_jana') AS profile;

-- ------------------------------------------------------------- classifieds
SELECT lives_ok(
  $$UPDATE public.classifieds SET title = repeat('a', 250), contact_name = repeat('a', 250),
      team_name = repeat('a', 200), description = repeat('a', 2000)
    WHERE id = (SELECT classified FROM ids)$$,
  'a classified at every limit is accepted');
SELECT throws_ok(
  $$UPDATE public.classifieds SET title = repeat('a', 251) WHERE id = (SELECT classified FROM ids)$$,
  '23514', NULL, 'a classified title over 250 characters is refused');
SELECT throws_ok(
  $$UPDATE public.classifieds SET contact_name = repeat('a', 251) WHERE id = (SELECT classified FROM ids)$$,
  '23514', NULL, 'a contact name over 250 characters is refused');
SELECT throws_ok(
  $$UPDATE public.classifieds SET team_name = repeat('a', 201) WHERE id = (SELECT classified FROM ids)$$,
  '23514', NULL, 'a team name over 200 characters is refused');
SELECT throws_ok(
  $$UPDATE public.classifieds SET description = repeat('a', 2001) WHERE id = (SELECT classified FROM ids)$$,
  '23514', NULL, 'a classified description over 2000 characters is refused');
SELECT throws_ok(
  $$UPDATE public.classifieds SET position = 'spits' WHERE id = (SELECT classified FROM ids)$$,
  '23514', NULL, 'a position the form does not offer is refused');
SELECT throws_ok(
  $$UPDATE public.classifieds SET province = 'brussel_' WHERE id = (SELECT classified FROM ids)$$,
  '23514', NULL, 'a province the form does not offer is refused');

-- ---------------------------------------------------------------- messages
SELECT lives_ok(
  $$UPDATE public.messages SET content = repeat('a', 5000),
      contact_shared = '{"email": "jana@example.test", "phone": "0470 12 34 56"}'
    WHERE id = (SELECT message FROM ids)$$,
  'a message of 5000 characters with contact details is accepted');
SELECT throws_ok(
  $$UPDATE public.messages SET content = repeat('a', 5001) WHERE id = (SELECT message FROM ids)$$,
  '23514', NULL, 'a message over 5000 characters is refused');
SELECT throws_ok(
  $$UPDATE public.messages SET contact_shared = jsonb_build_object('email', repeat('a', 500))
    WHERE id = (SELECT message FROM ids)$$,
  '23514', NULL, 'contact details over 500 characters are refused');
SELECT throws_ok(
  $$UPDATE public.messages SET contact_shared = '["jana@example.test"]' WHERE id = (SELECT message FROM ids)$$,
  '23514', NULL, 'contact details that are not an object are refused');

-- ---------------------------------------------------------------- profiles
SELECT throws_ok(
  $$UPDATE public.profiles SET username = repeat('a', 31) WHERE id = (SELECT profile FROM ids)$$,
  '23514', NULL, 'a username over 30 characters is refused');
SELECT throws_ok(
  $$UPDATE public.profiles SET display_name = repeat('a', 101) WHERE id = (SELECT profile FROM ids)$$,
  '23514', NULL, 'a display name over 100 characters is refused');

-- ----------------------------------------------------------------- rumours
SELECT lives_ok(
  $$UPDATE public.rumours SET player_name = repeat('a', 201), from_club_name = repeat('a', 200),
      to_club_name = repeat('a', 200), description = repeat('a', 2000)
    WHERE id = (SELECT rumour FROM ids)$$,
  'a rumour at every limit is accepted');
SELECT throws_ok(
  $$UPDATE public.rumours SET player_name = repeat('a', 202) WHERE id = (SELECT rumour FROM ids)$$,
  '23514', NULL, 'a player name over 201 characters is refused');
SELECT throws_ok(
  $$UPDATE public.rumours SET from_club_name = repeat('a', 201) WHERE id = (SELECT rumour FROM ids)$$,
  '23514', NULL, 'a current club over 200 characters is refused');
SELECT throws_ok(
  $$UPDATE public.rumours SET to_club_name = repeat('a', 201) WHERE id = (SELECT rumour FROM ids)$$,
  '23514', NULL, 'a new club over 200 characters is refused');
SELECT throws_ok(
  $$UPDATE public.rumours SET description = repeat('a', 2001) WHERE id = (SELECT rumour FROM ids)$$,
  '23514', NULL, 'a rumour description over 2000 characters is refused');

-- ---------------------------------------------------------- Google sign-up
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000f1a01',
   'een.heel.erg.lang.adres.van.iemand@example.test',
   '{"provider": "google", "providers": ["google"]}',
   jsonb_build_object('full_name', repeat('n', 150))),
  ('00000000-0000-0000-0000-0000000f1a02',
   'een.heel.erg.lang.adres.van.iemand@other.test',
   '{"provider": "google", "providers": ["google"]}',
   '{"full_name": "Tweede"}');

SELECT is(
  (SELECT username FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000f1a01'),
  'een_heel_erg_lang_adres_v',
  'a long email address gives a username of 25 characters');
SELECT matches(
  (SELECT username FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000f1a02'),
  '^een_heel_erg_lang_adres_v_[0-9a-f]{4}$',
  'with a suffix when taken, still within 30');
SELECT is(
  (SELECT char_length(display_name) FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000f1a01'),
  100,
  'a long Google name is shortened to 100 characters');

-- Email sign-ups keep their own rule: a chosen username over 30 is refused.
SELECT throws_ok(
  $$INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
    ('00000000-0000-0000-0000-0000000f1a03', 'lang@example.test',
     '{"provider": "email", "providers": ["email"]}',
     jsonb_build_object('username', repeat('a', 31)))$$,
  'VR012', 'Invalid username', 'a chosen username over 30 characters is refused');

SELECT * FROM finish();
ROLLBACK;
