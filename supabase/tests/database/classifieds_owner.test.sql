-- Owners edit, close ("gevonden") and delete their own zoekertjes; nobody
-- else can, an ad a moderator removed can't be edited, and suspended users
-- can delete but not edit (issue #72, J-05, J-08, D-016). Run with
-- `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000072a', 'zk_owner@example.test', '{"username": "zk_test_owner"}'),
  ('00000000-0000-0000-0000-00000000072b', 'zk_other@example.test', '{"username": "zk_test_other"}'),
  ('00000000-0000-0000-0000-00000000072c', 'zk_suspended@example.test', '{"username": "zk_test_suspended"}');

INSERT INTO public.classifieds (id, user_id, type, title, contact_name, description, removed_at) VALUES
  ('00000000-0000-0000-0000-0000000072e1', '00000000-0000-0000-0000-00000000072a',
   'team_seeks_player', 'VC Eigen zoekt een libero', 'VC Eigen', 'Origineel', NULL),
  ('00000000-0000-0000-0000-0000000072e2', '00000000-0000-0000-0000-00000000072a',
   'team_seeks_player', 'Verwijderd door moderator', 'VC Eigen', 'Gemeld', now()),
  ('00000000-0000-0000-0000-0000000072e3', '00000000-0000-0000-0000-00000000072c',
   'player_seeks_team', 'Geschorste Speler', 'Geschorste Speler', 'Origineel', NULL);

INSERT INTO public.conversations (id, ad_id, ad_type, initiator_id, recipient_id) VALUES
  ('00000000-0000-0000-0000-0000000072c1', '00000000-0000-0000-0000-0000000072e1', 'classified',
   '00000000-0000-0000-0000-00000000072b', '00000000-0000-0000-0000-00000000072a');

INSERT INTO public.user_suspensions (user_id, suspended_until, reason)
VALUES ('00000000-0000-0000-0000-00000000072c', NULL, 'Test');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- ------------------------------------------------------------ someone else
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000072b');
UPDATE public.classifieds SET description = 'Overgenomen'
WHERE id = '00000000-0000-0000-0000-0000000072e1';
DELETE FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000072e1';
RESET ROLE;

SELECT is(
  (SELECT description FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000072e1'),
  'Origineel', 'another user cannot edit the ad');
SELECT ok(
  EXISTS (SELECT 1 FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000072e1'),
  'nor delete it');

-- ------------------------------------------------------------------- owner
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000072a');
SELECT lives_ok(
  $$UPDATE public.classifieds
    SET description = 'Aangepast', gender = 'dames', division = 'nat2_dames', updated_at = now()
    WHERE id = '00000000-0000-0000-0000-0000000072e1'$$,
  'the owner edits their ad');
SELECT lives_ok(
  $$UPDATE public.classifieds SET is_active = false WHERE id = '00000000-0000-0000-0000-0000000072e1'$$,
  'and marks it gevonden');
SELECT throws_ok(
  $$UPDATE public.classifieds SET type = 'player_seeks_team' WHERE id = '00000000-0000-0000-0000-0000000072e1'$$,
  '42501', NULL, 'the owner cannot change the type');
SELECT throws_ok(
  $$UPDATE public.classifieds SET removed_at = NULL WHERE id = '00000000-0000-0000-0000-0000000072e2'$$,
  '42501', NULL, 'nor undo a moderator''s removal');
UPDATE public.classifieds SET description = 'Herschreven'
WHERE id = '00000000-0000-0000-0000-0000000072e2';
RESET ROLE;

SELECT is(
  (SELECT description || ' ' || gender || ' ' || is_active::text
   FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000072e1'),
  'Aangepast dames false', 'the edit and the gevonden mark are stored');
SELECT is(
  (SELECT description FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000072e2'),
  'Gemeld', 'an ad a moderator removed cannot be edited');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000072a');
SELECT lives_ok(
  $$DELETE FROM public.classifieds WHERE id IN ('00000000-0000-0000-0000-0000000072e1', '00000000-0000-0000-0000-0000000072e2')$$,
  'the owner deletes their ads, removed ones included');
RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM public.classifieds WHERE user_id = '00000000-0000-0000-0000-00000000072a'),
  0, 'both are gone');
SELECT ok(
  EXISTS (SELECT 1 FROM public.conversations WHERE id = '00000000-0000-0000-0000-0000000072c1'),
  'the conversation about the deleted ad stays');

-- --------------------------------------------------------------- suspended
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000072c');
SELECT throws_ok(
  $$UPDATE public.classifieds SET description = 'Geschorst' WHERE id = '00000000-0000-0000-0000-0000000072e3'$$,
  'VR005', NULL, 'a suspended user cannot edit their ad');
SELECT lives_ok(
  $$DELETE FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000072e3'$$,
  'but can delete it (D-016)');
RESET ROLE;

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000072e3'),
  'and it is gone');

SELECT * FROM finish();
ROLLBACK;
