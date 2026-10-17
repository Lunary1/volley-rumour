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
--   reset@example.test     test_reset       user       only for password-reset tests
--   google@example.test    test_google      user       Google-only, no password
--   wachtrij@example.test  volle_wachtrij   user       5 pending rumours: at the cap (#54)
--   beheerder@example.test beheerder_vr     admin      suspends users, manages badges and roles (#80)
--   geschorst@example.test test_geschorst   user       only for suspension tests (#80)
--   kandidaat@example.test test_kandidaat   user       only for badge and role tests (#80)
--   bron@example.test      trouwe_bron      user       5 van 6 bevestigd: a Betrouwbare bron (#88)
--
-- Logging out ends every session of that user (Supabase's default global
-- sign-out), so a test that logs out would break parallel tests using the
-- same account. Only logout tests use test_uitlogger. Password-reset tests
-- change the password, so they have their own accounts too.
--
-- test_google is the one account without `test-wachtwoord`: like an account
-- made with "Doorgaan met Google", it has a Google identity and no password
-- until it sets one through the reset link (#58).

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
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'uitlog@example.test',    'test_uitlogger', 'Test Uitlogger', interval '10 days'),
  ('a0000000-0000-4000-8000-000000000006'::uuid, 'reset@example.test',     'test_reset',   'Test Herstel',    interval '8 days'),
  ('a0000000-0000-4000-8000-000000000008'::uuid, 'wachtrij@example.test',  'volle_wachtrij', 'Volle Wachtrij', interval '20 days'),
  ('a0000000-0000-4000-8000-000000000009'::uuid, 'beheerder@example.test', 'beheerder_vr', 'Beheerder VR',    interval '150 days'),
  ('a0000000-0000-4000-8000-00000000000a'::uuid, 'geschorst@example.test', 'test_geschorst', 'Test Geschorst', interval '15 days'),
  ('a0000000-0000-4000-8000-00000000000b'::uuid, 'kandidaat@example.test', 'test_kandidaat', 'Test Kandidaat', interval '12 days'),
  ('a0000000-0000-4000-8000-00000000000c'::uuid, 'bron@example.test',      'trouwe_bron',  'Trouwe Bron',     interval '200 days')
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

-- The Google-only account: a Google identity and no password.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000007',
  'authenticated', 'authenticated', 'google@example.test', '', now(),
  '{"provider": "google", "providers": ["google"]}',
  '{"username": "test_google", "full_name": "Test Google"}',
  now() - interval '7 days', now() - interval '7 days',
  '', '', '', ''
);

INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'a0000000-0000-4000-8000-000000000007', '100000000000000000007', 'google',
  '{"sub": "100000000000000000007", "email": "google@example.test", "email_verified": true}',
  now(), now() - interval '7 days', now() - interval '7 days'
);

UPDATE public.profiles SET role = 'moderator'
WHERE id = 'a0000000-0000-4000-8000-000000000004';

UPDATE public.profiles SET role = 'admin'
WHERE id = 'a0000000-0000-4000-8000-000000000009';

UPDATE public.profiles
SET is_verified_source = true, source_description = 'Fictieve clubaccount voor tests'
WHERE id = 'a0000000-0000-4000-8000-000000000003';

-- ------------------------------------------------------------------ clubs
INSERT INTO public.clubs (id, name, province, division) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'VC Testdorp',      'antwerpen',       'nat2_heren'),
  ('c0000000-0000-4000-8000-000000000002', 'Volley Voorbeeld', 'oost_vlaanderen', 'nat1_heren'),
  ('c0000000-0000-4000-8000-000000000003', 'VBC Fictief',      'limburg',         'promo1_dames');

-- ------------------------------------------------------------- zoekertjes
-- The last ad has no description, which is what the create form stores for an
-- empty field. Search must still work with it in the list (#59).
INSERT INTO public.classifieds (
  id, user_id, type, title, description, contact_name, team_name, position,
  trainer_diploma, gender, province, division, created_at
) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   'team_seeks_player', 'VC Testdorp zoekt een setter',
   'Ons herenteam in Nationale 2 zoekt een ervaren setter voor volgend seizoen. Training op dinsdag en donderdag.',
   'VC Testdorp', 'VC Testdorp', 'setter', NULL, 'heren', 'antwerpen', 'nat2_heren', now() - interval '2 days'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'player_seeks_team', 'Libero zoekt nieuwe ploeg',
   'Libero met vijf jaar ervaring in Promo 1 zoekt een ambitieuze damesploeg in Limburg of Antwerpen.',
   'Jana Voorbeeld', NULL, 'libero', NULL, 'dames', 'limburg', 'promo1_dames', now() - interval '5 days'),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002',
   'trainer_seeks_team', 'Trainer B zoekt jeugdploeg',
   'Gediplomeerd trainer B zoekt een jeugdploeg voor het komende seizoen, liefst in Oost-Vlaanderen.',
   'Tom Testmans', NULL, NULL, 'trainer_b', NULL, 'oost_vlaanderen', NULL, now() - interval '9 days'),
  ('d0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002',
   'trainer_seeks_team', 'Hulptrainer beschikbaar in Gent',
   NULL,
   'Tom Testmans', NULL, NULL, NULL, NULL, 'oost_vlaanderen', NULL, now() - interval '12 days');

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
   'transfer', 'denied', now() - interval '30 days'),
  -- No creator: what deleteAccount leaves behind. Pages must still load (#57).
  ('e0000000-0000-4000-8000-000000000005', NULL,
   'Wout Weesgerucht', 'c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002',
   'VBC Fictief', 'Volley Voorbeeld', 'Gepost door een account dat intussen verwijderd is.',
   'transfer', 'rumour', now() - interval '6 days'),
  -- Not approved: only the author and staff may see these (#65).
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   'Nina Nagekeken', 'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003',
   'VC Testdorp', 'VBC Fictief', 'Wacht nog op een moderator.',
   'transfer', 'pending', now() - interval '2 hours'),
  ('e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000002',
   'Rik Retour', 'c0000000-0000-4000-8000-000000000002', NULL,
   'Volley Voorbeeld', NULL, 'Afgewezen door een moderator.',
   'player_retirement', 'rejected', now() - interval '4 days'),
  -- Only the takedown tests use these (#68): one gets removed, the other's
  -- request rejected. e2e/global-setup.ts puts them back. Denied rather than
  -- lopend, so they stay off the homepage's top 3.
  ('e0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000003',
   'Tim Terugtrek', 'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   'VC Testdorp', 'Volley Voorbeeld', 'Zou volgend seizoen bij Volley Voorbeeld spelen.',
   'transfer', 'denied', now() - interval '50 days'),
  ('e0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000003',
   'Bram Bezwaar', 'c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   'VBC Fictief', 'VC Testdorp', 'Gehoord op het tornooi.',
   'transfer', 'denied', now() - interval '55 days'),
  -- Only the report tests use this one (#69): it gets reported and removed.
  -- e2e/global-setup.ts puts it back.
  ('e0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000003',
   'Mila Meldtest', 'c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003',
   'Volley Voorbeeld', 'VBC Fictief', 'Zou al getekend hebben.',
   'transfer', 'denied', now() - interval '60 days');

-- Why Rik Retour was rejected; Tom sees it on his profile (#66).
UPDATE public.rumours
   SET rejection_reason = 'duplicate', rejection_note = 'Staat al online als ander gerucht.'
 WHERE id = 'e0000000-0000-4000-8000-000000000007';

-- Sources and declarations (#67). Rumours from before #67 have none, like
-- Sara Steekproef and Wout Weesgerucht; pages must still show them.
UPDATE public.rumours
   SET source_type = 'own_observation', declared_good_faith = true, declared_senior = true,
       gender = 'male', from_division = 'nat2_heren', to_division = 'nat1_heren'
 WHERE id = 'e0000000-0000-4000-8000-000000000001';
UPDATE public.rumours
   SET source_type = 'club', source_url = 'https://example.test/nieuws/nieuwe-hoofdtrainer',
       declared_good_faith = true, declared_senior = true
 WHERE id = 'e0000000-0000-4000-8000-000000000003';
UPDATE public.rumours
   SET source_type = 'media', source_url = 'https://example.test/sport/nina-nagekeken',
       declared_good_faith = true, declared_senior = true,
       gender = 'female', from_division = 'promo1_dames', to_division = 'nat3_dames'
 WHERE id = 'e0000000-0000-4000-8000-000000000006';

-- volle_wachtrij has 5 rumours waiting: the most one author may have (#54).
-- Newer than Nina Nagekeken, which the queue test expects first.
INSERT INTO public.rumours (
  creator_id, player_name, from_club_name, description, category, status,
  source_type, declared_good_faith, declared_senior, created_at
)
SELECT 'a0000000-0000-4000-8000-000000000008', 'Wachtende Trainer ' || n, 'VBC Fictief',
       'Een van vijf wachtende geruchten.', 'trainer_retirement', 'pending',
       'own_observation', true, true, now() - n * interval '10 minutes'
FROM generate_series(1, 5) AS n;

-- trouwe_bron's resolved rumours (#88): 5 confirmed and 1 denied make
-- "5 van 6 bevestigd", enough for Betrouwbare bronnen (at least 5 resolved).
-- The expired one is neutral (D-005). Old, so they sit at the bottom of
-- Transfer Talk. The on_rumour_resolution_change trigger fills the counts.
INSERT INTO public.rumours (
  creator_id, player_name, from_club_name, to_club_name, description, category,
  status, source_type, declared_good_faith, declared_senior, created_at
)
SELECT 'a0000000-0000-4000-8000-00000000000c', r.player_name, 'VBC Fictief',
       'Volley Voorbeeld', 'Uit een betrouwbare bron.', 'transfer', r.status,
       'media', true, true, now() - r.age
FROM (VALUES
  ('Bas Bronvast',     'confirmed', interval '100 days'),
  ('Cleo Controle',    'confirmed', interval '105 days'),
  ('Dirk Degelijk',    'confirmed', interval '110 days'),
  ('Ellen Echtheid',   'confirmed', interval '115 days'),
  ('Fien Feitelijk',   'confirmed', interval '120 days'),
  ('Gert Gemist',      'denied',    interval '125 days'),
  ('Hanne Halverwege', 'expired',   interval '130 days')
) AS r (player_name, status, age);

-- Votes; the on_vote_change trigger fills the vote counts.
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

-- VC Testdorp answers Tom's ad. Only the report tests use it (#87): Tom
-- reports and blocks VC Testdorp; e2e/global-setup.ts lifts the block. Read,
-- so unread counts in other tests don't change.
INSERT INTO public.conversations (id, ad_id, ad_type, initiator_id, recipient_id, created_at, updated_at)
VALUES ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003', 'classified',
        'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002',
        now() - interval '3 days', now() - interval '3 days');

INSERT INTO public.messages (conversation_id, sender_id, content, is_read, created_at) VALUES
  ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003',
   'Een jeugdploeg? Daar ben je veel te slecht voor.', true, now() - interval '3 days');

-- Jana answers Tom's "Hulptrainer" ad. Only the block tests use it (#73):
-- Tom blocks Jana; e2e/global-setup.ts lifts the block and deletes the
-- messages the tests sent. Read, so unread counts in other tests don't change.
INSERT INTO public.conversations (id, ad_id, ad_type, initiator_id, recipient_id, created_at, updated_at)
VALUES ('f0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005', 'classified',
        'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
        now() - interval '4 days', now() - interval '4 days');

INSERT INTO public.messages (id, conversation_id, sender_id, content, is_read, created_at) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000001',
   'Dag Tom, zoek je nog iemand voor de jeugdtrainingen?', true, now() - interval '4 days');

-- test_kandidaat answers the VC Testdorp ad. Only the date tests use it
-- (#142): its one message was sent at 23:30 UTC on 10 March, which is already
-- 11 March in Belgium. Read, so unread counts in other tests don't change.
INSERT INTO public.conversations (id, ad_id, ad_type, initiator_id, recipient_id, created_at, updated_at)
VALUES ('f0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'classified',
        'a0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000003',
        '2026-03-10 23:30:00+00', '2026-03-10 23:30:00+00');

INSERT INTO public.messages (conversation_id, sender_id, content, is_read, created_at) VALUES
  ('f0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-00000000000b',
   'Is de plaats als hulptrainer nog vrij?', true, '2026-03-10 23:30:00+00');

-- ------------------------------------------------------- takedown request
-- An open request about Lotte Lorem (#68), so the inbox isn't empty locally.
-- Its status page: /verwijderverzoek/status/seedtokenvoorlokaletestsVolleyRumours000001
INSERT INTO public.takedown_requests (
  reference, token_hash, rumour_id, relation, requester_name, requester_email,
  explanation, created_at
) VALUES (
  'VR-SEED42',
  encode(extensions.digest('seedtokenvoorlokaletestsVolleyRumours000001', 'sha256'), 'hex'),
  'e0000000-0000-4000-8000-000000000004', 'self', 'Lotte Lorem', 'lotte@example.test',
  'Dit klopt niet: ik blijf gewoon bij VC Testdorp spelen.', now() - interval '1 day'
);

-- --------------------------------------------------------- contact message
-- An open message from Jana, sent while logged in (#81). e2e/global-setup.ts
-- deletes every other message before a run.
INSERT INTO public.contact_messages (
  id, category, sender_name, sender_email, message, user_id, created_at
) VALUES (
  'c0000000-0000-4000-8000-000000000001', 'account', 'Jana Voorbeeld', 'jana@example.test',
  'Kan ik mijn gebruikersnaam nog wijzigen na de registratie?',
  'a0000000-0000-4000-8000-000000000001', now() - interval '2 days'
);

-- --------------------------------------------------------------- audit log
-- Staff actions (#64), as moderation functions will write them. The second
-- one is about a rumour that no longer exists: the log outlives its target.
INSERT INTO public.staff_actions (actor_id, action, target_type, target_id, reason, details, created_at) VALUES
  ('a0000000-0000-4000-8000-000000000004', 'rumour_resolved', 'rumour', 'e0000000-0000-4000-8000-000000000003',
   'Officieel bevestigd door de club', '{"outcome": "confirmed"}', now() - interval '15 days'),
  ('a0000000-0000-4000-8000-000000000004', 'rumour_rejected', 'rumour', 'e0000000-0000-4000-8000-0000000000ff',
   'Geen bron opgegeven', '{}', now() - interval '3 days');
