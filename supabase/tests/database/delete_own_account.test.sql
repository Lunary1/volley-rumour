-- Deleting your account is all-or-nothing: delete_own_account() removes the
-- account in one transaction, deletes its zoekertjes and unpublished rumours,
-- keeps published rumours and reports without the user, and writes a hashed
-- audit entry (issue #76, J-11, D-021). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(26);

-- The leaver (suspended: deletion must still work) and someone they dealt with.
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000076a', 'da_weg@example.test',
   '{"provider": "google", "providers": ["google"]}', '{"username": "da_test_weg"}'),
  ('00000000-0000-0000-0000-00000000076b', 'da_blijft@example.test',
   '{"provider": "email", "providers": ["email"]}', '{"username": "da_test_blijft"}');

INSERT INTO public.rumours (
  id, creator_id, player_name, category, status, from_club_name, to_club_name
) VALUES
  ('00000000-0000-0000-0000-0000000076f1', '00000000-0000-0000-0000-00000000076a', 'Pia Publiek', 'transfer', 'rumour', 'Club A', 'Club B'),
  ('00000000-0000-0000-0000-0000000076f2', '00000000-0000-0000-0000-00000000076a', 'Wim Wacht', 'transfer', 'pending', 'Club A', 'Club B'),
  ('00000000-0000-0000-0000-0000000076f3', '00000000-0000-0000-0000-00000000076a', 'Rik Afgewezen', 'transfer', 'rejected', 'Club A', 'Club B'),
  ('00000000-0000-0000-0000-0000000076f4', '00000000-0000-0000-0000-00000000076a', 'Bea Bevestigd', 'transfer', 'confirmed', 'Club A', 'Club B'),
  ('00000000-0000-0000-0000-0000000076f5', '00000000-0000-0000-0000-00000000076b', 'Olaf Ander', 'transfer', 'rumour', 'Club A', 'Club B');

INSERT INTO public.classifieds (id, user_id, type, title, contact_name, description) VALUES
  ('00000000-0000-0000-0000-0000000076e1', '00000000-0000-0000-0000-00000000076a',
   'player_seeks_team', 'Da Weg zoekt een ploeg', 'Da Weg', 'Mijn echte naam staat erin'),
  ('00000000-0000-0000-0000-0000000076e2', '00000000-0000-0000-0000-00000000076b',
   'team_seeks_player', 'VC Blijft zoekt een libero', 'VC Blijft', 'Blijft staan');

INSERT INTO public.rumour_votes (user_id, rumour_id, vote_type) VALUES
  ('00000000-0000-0000-0000-00000000076a', '00000000-0000-0000-0000-0000000076f5', true);

INSERT INTO public.conversations (id, ad_id, ad_type, initiator_id, recipient_id) VALUES
  ('00000000-0000-0000-0000-0000000076c1', '00000000-0000-0000-0000-0000000076e2', 'classified',
   '00000000-0000-0000-0000-00000000076a', '00000000-0000-0000-0000-00000000076b');
INSERT INTO public.messages (conversation_id, sender_id, content) VALUES
  ('00000000-0000-0000-0000-0000000076c1', '00000000-0000-0000-0000-00000000076a', 'Is de plaats nog vrij?'),
  ('00000000-0000-0000-0000-0000000076c1', '00000000-0000-0000-0000-00000000076b', 'Ja, kom eens langs.');
INSERT INTO public.conversation_archives (conversation_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000076c1', '00000000-0000-0000-0000-00000000076b');

INSERT INTO public.blocked_users (blocker_id, blocked_id) VALUES
  ('00000000-0000-0000-0000-00000000076b', '00000000-0000-0000-0000-00000000076a');

INSERT INTO public.reports (id, target_type, rumour_id, reporter_id, reported_user_id, reason) VALUES
  ('00000000-0000-0000-0000-0000000076d1', 'rumour', '00000000-0000-0000-0000-0000000076f5',
   '00000000-0000-0000-0000-00000000076a', '00000000-0000-0000-0000-00000000076b', 'incorrect'),
  ('00000000-0000-0000-0000-0000000076d2', 'rumour', '00000000-0000-0000-0000-0000000076f1',
   '00000000-0000-0000-0000-00000000076b', '00000000-0000-0000-0000-00000000076a', 'incorrect');

INSERT INTO public.user_suspensions (user_id, suspended_until, reason)
VALUES ('00000000-0000-0000-0000-00000000076a', NULL, 'Test');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- ---------------------------------------------------------------- access
SELECT ok(
  NOT has_function_privilege('anon', 'public.delete_own_account()', 'EXECUTE'),
  'visitors cannot call delete_own_account');
SELECT ok(
  has_function_privilege('authenticated', 'public.delete_own_account()', 'EXECUTE'),
  'logged-in users can');
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.deletion_audit_log', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.deletion_audit_log', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.deletion_audit_log', 'INSERT'),
  'nobody reads or writes the deletion log through the API');
SELECT col_not_null('public', 'classifieds', 'user_id', 'every zoekertje has an owner');

-- ------------------------------------------------------- all-or-nothing
-- The last step fails: nothing may be gone afterwards.
CREATE FUNCTION pg_temp.fail() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'simulated failure';
END;
$$;
CREATE TRIGGER fail_audit BEFORE INSERT ON public.deletion_audit_log
  FOR EACH ROW EXECUTE FUNCTION pg_temp.fail();

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000076a');
SELECT throws_ok(
  $$SELECT public.delete_own_account()$$,
  'P0001', 'simulated failure', 'a failing step fails the whole deletion');
RESET ROLE;

SELECT ok(
  EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000076a')
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000076a')
  AND EXISTS (SELECT 1 FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000076e1')
  AND EXISTS (SELECT 1 FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000076f2')
  AND (SELECT creator_id FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000076f1')
      = '00000000-0000-0000-0000-00000000076a'
  AND (SELECT count(*) FROM public.messages
        WHERE conversation_id = '00000000-0000-0000-0000-0000000076c1') = 2,
  'and leaves the account and its data exactly as they were');

DROP TRIGGER fail_audit ON public.deletion_audit_log;

-- --------------------------------------------------------------- delete
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000076a');
SELECT lives_ok(
  $$SELECT public.delete_own_account()$$,
  'a suspended user deletes their own account');
RESET ROLE;

SELECT ok(
  NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000076a'),
  'the login is gone');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000076a'),
  'the profile is gone');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000076e1'),
  'their zoekertje is deleted (D-021)');
SELECT is(
  (SELECT creator_id FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000076f1'),
  NULL, 'a published rumour stays, without its author');
SELECT is(
  (SELECT creator_id FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000076f4'),
  NULL, 'so does a confirmed one');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.rumours
               WHERE id IN ('00000000-0000-0000-0000-0000000076f2',
                            '00000000-0000-0000-0000-0000000076f3')),
  'pending and rejected rumours are deleted');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.rumour_votes WHERE user_id = '00000000-0000-0000-0000-00000000076a'),
  'their votes are deleted');
SELECT is(
  (SELECT votes_true FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000076f5'),
  0, 'and the rumour they voted on is recounted');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.blocked_users WHERE blocked_id = '00000000-0000-0000-0000-00000000076a'),
  'blocks involving them are deleted');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = '00000000-0000-0000-0000-0000000076c1'),
  'their conversations are deleted');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = '00000000-0000-0000-0000-0000000076c1')
  AND NOT EXISTS (SELECT 1 FROM public.conversation_archives
                   WHERE conversation_id = '00000000-0000-0000-0000-0000000076c1'),
  'with every message and archive row');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.user_suspensions WHERE user_id = '00000000-0000-0000-0000-00000000076a'),
  'their suspension is deleted');
SELECT is(
  (SELECT reporter_id FROM public.reports WHERE id = '00000000-0000-0000-0000-0000000076d1'),
  NULL, 'a report they filed stays, without them');
SELECT is(
  (SELECT reported_user_id FROM public.reports WHERE id = '00000000-0000-0000-0000-0000000076d2'),
  NULL, 'a report about them stays, without them');
SELECT is(
  (SELECT auth_provider FROM public.deletion_audit_log
    WHERE user_id_hash = encode(sha256(convert_to('00000000-0000-0000-0000-00000000076a', 'UTF8')), 'hex')),
  'google', 'the deletion log has the hashed id and the login method');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.deletion_audit_log
               WHERE user_id_hash = '00000000-0000-0000-0000-00000000076a'),
  'and not the id itself');
SELECT ok(
  EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000076b')
  AND EXISTS (SELECT 1 FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000076e2')
  AND EXISTS (SELECT 1 FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000076f5'),
  'the other user keeps their account, zoekertje and rumour');

-- --------------------------------------------------------------- misuse
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000076a');
SELECT throws_ok(
  $$SELECT public.delete_own_account()$$,
  'P0002', NULL, 'a deleted account cannot be deleted twice');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.delete_own_account()$$,
  '42501', NULL, 'visitors are refused');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
