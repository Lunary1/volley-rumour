-- Local development and test seed data (issue #56). Fake data only — never
-- real users, players or clubs. Applied by `npm run db:reset`.
--
-- Every seeded account logs in with the password `test-wachtwoord`.
-- The Playwright tests rely on these rows (see e2e/fixtures/seed.ts), so keep
-- the two in sync when you change them.
--
--   jana@example.test      speler_jana      user       player looking for a team
--   tom@example.test       coach_tom        user       trainer looking for a team
--   club@example.test      vc_testdorp      user       club account, posts ads
--   moderator@example.test moderator_vr     moderator  staff (D-006)
--   uitlog@example.test    test_uitlogger   user       only for tests that log out
--
-- Logging out ends every session of that user (Supabase's default global
-- sign-out), so a test that logs out would break parallel tests using the
-- same account. Only logout tests use test_uitlogger.

-- ------------------------------------------------------------------ users
-- Inserted into auth.users directly; the on_auth_user_created trigger creates
-- each profile. The empty token columns must be '' (not NULL) for GoTrue.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
  u.email, extensions.crypt('test-wachtwoord', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}',
  jsonb_build_object('username', u.username, 'full_name', u.full_name),
  now() - u.age, now() - u.age,
  '', '', '', ''
FROM (VALUES
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'jana@example.test',      'speler_jana',  'Jana Voorbeeld',  interval '60 days'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'tom@example.test',       'coach_tom',    'Tom Testmans',    interval '45 days'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'club@example.test',      'vc_testdorp',  'VC Testdorp',     interval '90 days'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'moderator@example.test', 'moderator_vr', 'Moderator VR',    interval '120 days'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'uitlog@example.test',    'test_uitlogger', 'Test Uitlogger', interval '10 days')
) AS u (id, email, username, full_name, age);

INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(), id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  now(), created_at, updated_at
FROM auth.users
WHERE email LIKE '%@example.test';

UPDATE public.profiles SET role = 'moderator'
WHERE id = 'a0000000-0000-4000-8000-000000000004';

UPDATE public.profiles
SET is_verified_source = true, source_description = 'Fictieve clubaccount voor tests'
WHERE id = 'a0000000-0000-4000-8000-000000000003';

-- ------------------------------------------------------------------ clubs
INSERT INTO public.clubs (id, name, province, division) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'VC Testdorp',      'antwerpen',       'nat2_heren'),
  ('c0000000-0000-4000-8000-000000000002', 'Volley Voorbeeld', 'oost_vlaanderen', 'nat1_heren'),
  ('c0000000-0000-4000-8000-000000000003', 'VBC Fictief',      'limburg',         'promo1_dames');

-- ------------------------------------------------------------- zoekertjes
-- Every ad has a description; the search crash on ads without one is #59.
INSERT INTO public.classifieds (
  id, user_id, type, title, description, contact_name, team_name, position,
  province, division, created_at
) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   'team_seeks_player', 'VC Testdorp zoekt een setter',
   'Ons herenteam in Nationale 2 zoekt een ervaren setter voor volgend seizoen. Training op dinsdag en donderdag.',
   'VC Testdorp', 'VC Testdorp', 'setter', 'antwerpen', 'nat2_heren', now() - interval '2 days'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'player_seeks_team', 'Libero zoekt nieuwe ploeg',
   'Libero met vijf jaar ervaring in Promo 1 zoekt een ambitieuze damesploeg in Limburg of Antwerpen.',
   'Jana Voorbeeld', NULL, 'libero', 'limburg', 'promo1_dames', now() - interval '5 days'),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002',
   'trainer_seeks_team', 'Trainer B zoekt jeugdploeg',
   'Gediplomeerd trainer B zoekt een jeugdploeg voor het komende seizoen, liefst in Oost-Vlaanderen.',
   'Tom Testmans', NULL, NULL, 'oost_vlaanderen', NULL, now() - interval '9 days');

-- An inactive ad: hidden from the list and its detail page returns 404.
INSERT INTO public.classifieds (
  id, user_id, type, title, description, contact_name, province, is_active, created_at
) VALUES
  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003',
   'team_seeks_trainer', 'Oud zoekertje: trainer gezocht',
   'Dit zoekertje is niet meer actief en mag nergens verschijnen.',
   'VC Testdorp', 'antwerpen', false, now() - interval '40 days');

-- --------------------------------------------------------------- rumours
INSERT INTO public.rumours (
  id, creator_id, player_name, from_club_id, to_club_id, from_club_name,
  to_club_name, description, category, status, created_at
) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Pieter Proefspeler', 'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   'VC Testdorp', 'Volley Voorbeeld', 'Gezien op de training van Volley Voorbeeld.',
   'transfer', 'rumour', now() - interval '1 day'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'Sara Steekproef', 'c0000000-0000-4000-8000-000000000003', NULL,
   'VBC Fictief', NULL, 'Stopt na dit seizoen volgens de clubkalender.',
   'player_retirement', 'rumour', now() - interval '3 days'),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Koen Kladversie', 'c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'Volley Voorbeeld', 'VC Testdorp', 'Wordt de nieuwe hoofdtrainer.',
   'trainer_transfer', 'confirmed', now() - interval '20 days'),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002',
   'Lotte Lorem', 'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003',
   'VC Testdorp', 'VBC Fictief', 'Gehoord in de kantine.',
   'transfer', 'denied', now() - interval '30 days');

-- Votes; the on_vote_change trigger fills the vote counts and trust scores.
INSERT INTO public.rumour_votes (rumour_id, user_id, vote_type) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', true),
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', true),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', false),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', true);

-- -------------------------------------------------------------- transfers
INSERT INTO public.transfers (
  player_name, from_club, to_club, category, province, division, source_rumour_id, confirmed_at
) VALUES
  ('Koen Kladversie', 'Volley Voorbeeld', 'VC Testdorp', 'trainer_male',
   'antwerpen', 'nat2_heren', 'e0000000-0000-4000-8000-000000000003', now() - interval '15 days'),
  ('Eva Exempel', 'VBC Fictief', 'Volley Voorbeeld', 'player_female',
   'oost_vlaanderen', 'nat1_dames', NULL, now() - interval '25 days');

-- ----------------------------------------------------------- conversation
-- Jana answers the VC Testdorp ad.
INSERT INTO public.conversations (id, ad_id, ad_type, initiator_id, recipient_id, created_at, updated_at)
VALUES ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'classified',
        'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
        now() - interval '1 day', now() - interval '2 hours');

INSERT INTO public.messages (conversation_id, sender_id, content, is_read, created_at) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Hallo! Ik speel geen setter, maar ken iemand die interesse heeft.', true, now() - interval '1 day'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   'Leuk, mag die persoon ons een berichtje sturen?', false, now() - interval '2 hours');
