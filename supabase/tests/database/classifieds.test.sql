-- Zoekertjes store the team's gender and the trainer diploma; the gender
-- matches the division, and new ads use senior divisions only (issue #71,
-- J-04, J-08, D-003). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000071a', 'zk_poster@example.test', '{"username": "zk_test_poster"}');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- ------------------------------------------------------------- privileges
SELECT ok(
  has_column_privilege('authenticated', 'public.classifieds', 'gender', 'INSERT')
  AND has_column_privilege('authenticated', 'public.classifieds', 'trainer_diploma', 'INSERT'),
  'a user sets gender and diploma when posting');
SELECT ok(
  has_column_privilege('authenticated', 'public.classifieds', 'gender', 'UPDATE')
  AND has_column_privilege('authenticated', 'public.classifieds', 'trainer_diploma', 'UPDATE'),
  'and when editing their ad');
SELECT ok(
  NOT has_column_privilege('anon', 'public.classifieds', 'gender', 'INSERT'),
  'visitors cannot post');
SELECT ok(
  has_column_privilege('anon', 'public.classifieds', 'gender', 'SELECT')
  AND has_column_privilege('anon', 'public.classifieds', 'trainer_diploma', 'SELECT'),
  'everyone reads gender and diploma on the ad');

-- ------------------------------------------------------------------ posting
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000071a');

SELECT lives_ok(
  $$INSERT INTO public.classifieds (user_id, type, title, contact_name, team_name, position, gender, division, province)
    VALUES ('00000000-0000-0000-0000-00000000071a',
            'player_seeks_team', 'Zoë Proef', 'Zoë Proef', 'VC Proef', 'libero', 'dames', 'nat2_dames', 'limburg')$$,
  'a player posts an ad with gender and a matching division');
SELECT lives_ok(
  $$INSERT INTO public.classifieds (user_id, type, title, contact_name, team_name, trainer_diploma, gender, division, province)
    VALUES ('00000000-0000-0000-0000-00000000071a', 'team_seeks_trainer', 'VC Proef zoekt een trainer',
            'VC Proef', 'VC Proef', 'trainer_b', 'heren', 'promo4_heren', 'antwerpen')$$,
  'a team asks for a minimum diploma');
SELECT lives_ok(
  $$INSERT INTO public.classifieds (user_id, type, title, contact_name)
    VALUES ('00000000-0000-0000-0000-00000000071a', 'team_seeks_player', 'Zonder geslacht', 'VC Proef')$$,
  'gender and division stay optional in the database, like older ads');

SELECT throws_ok(
  $$INSERT INTO public.classifieds (user_id, type, title, contact_name, gender)
    VALUES ('00000000-0000-0000-0000-00000000071a', 'team_seeks_player', 'Gemengd', 'VC Proef', 'gemengd')$$,
  '23514', NULL, 'gender is heren or dames');
SELECT throws_ok(
  $$INSERT INTO public.classifieds (user_id, type, title, contact_name, gender, division)
    VALUES ('00000000-0000-0000-0000-00000000071a', 'team_seeks_player', 'Verkeerd', 'VC Proef', 'heren', 'nat2_dames')$$,
  '23514', NULL, 'the gender matches the division');
SELECT throws_ok(
  $$INSERT INTO public.classifieds (user_id, type, title, contact_name, division)
    VALUES ('00000000-0000-0000-0000-00000000071a', 'team_seeks_player', 'Jeugd', 'VC Proef', 'u17_heren')$$,
  '23514', NULL, 'only senior divisions (D-003)');
SELECT throws_ok(
  $$INSERT INTO public.classifieds (user_id, type, title, contact_name, trainer_diploma)
    VALUES ('00000000-0000-0000-0000-00000000071a', 'trainer_seeks_team', 'Onbekend', 'Proef', 'trainer_z')$$,
  '23514', NULL, 'only known diplomas');
SELECT throws_ok(
  $$INSERT INTO public.classifieds (user_id, type, title, contact_name, trainer_diploma)
    VALUES ('00000000-0000-0000-0000-00000000071a', 'player_seeks_team', 'Speler', 'Proef', 'trainer_b')$$,
  '23514', NULL, 'a diploma only goes on trainer ads');

-- ------------------------------------------------------------------ editing
SELECT throws_ok(
  $$UPDATE public.classifieds SET gender = 'heren'
    WHERE title = 'Zoë Proef'$$,
  '23514', NULL, 'an edit cannot make gender and division disagree');
SELECT lives_ok(
  $$UPDATE public.classifieds SET gender = 'heren', division = 'liga_heren'
    WHERE title = 'Zoë Proef'$$,
  'an edit that changes both is fine');

SELECT * FROM finish();
ROLLBACK;
