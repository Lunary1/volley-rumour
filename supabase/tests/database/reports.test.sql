-- User reports: logged-in users report what they can see, only staff read
-- reports and decide, a reported conversation is readable only through its
-- report, and every decision and read is logged (issues #69, #79, #87,
-- D-015). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(49);

-- An author, a reporter, a moderator and an outsider.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000069a', 'rp_auteur@example.test', '{"username": "rp_test_auteur"}'),
  ('00000000-0000-0000-0000-00000000069b', 'rp_melder@example.test', '{"username": "rp_test_melder"}'),
  ('00000000-0000-0000-0000-00000000069c', 'rp_staff@example.test', '{"username": "rp_test_staff"}'),
  ('00000000-0000-0000-0000-00000000069d', 'rp_buiten@example.test', '{"username": "rp_test_buiten"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000069c';

-- The author's public rumours 1 and 2, and one still waiting for a moderator.
INSERT INTO public.rumours (id, creator_id, player_name, category, status) VALUES
  ('00000000-0000-0000-0000-0000000069f1', '00000000-0000-0000-0000-00000000069a', 'Meld Test Een', 'transfer', 'rumour'),
  ('00000000-0000-0000-0000-0000000069f2', '00000000-0000-0000-0000-00000000069a', 'Meld Test Twee', 'transfer', 'rumour'),
  ('00000000-0000-0000-0000-0000000069f9', '00000000-0000-0000-0000-00000000069a', 'Meld Nog Niet Openbaar', 'transfer', 'pending');

-- The author's active zoekertje and an inactive one.
INSERT INTO public.classifieds (id, user_id, type, title, contact_name, is_active) VALUES
  ('00000000-0000-0000-0000-0000000069e1', '00000000-0000-0000-0000-00000000069a', 'player_seeks_team', 'Meld Zoekertje', 'Auteur', true),
  ('00000000-0000-0000-0000-0000000069e2', '00000000-0000-0000-0000-00000000069a', 'player_seeks_team', 'Oud Zoekertje', 'Auteur', false);

-- The reporter answers the author's zoekertje.
INSERT INTO public.conversations (id, ad_id, ad_type, initiator_id, recipient_id) VALUES
  ('00000000-0000-0000-0000-0000000069c1', '00000000-0000-0000-0000-0000000069e1', 'classified',
   '00000000-0000-0000-0000-00000000069b', '00000000-0000-0000-0000-00000000069a');
INSERT INTO public.messages (conversation_id, sender_id, content, created_at) VALUES
  ('00000000-0000-0000-0000-0000000069c1', '00000000-0000-0000-0000-00000000069b', 'Is de plaats nog vrij?', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-0000000069c1', '00000000-0000-0000-0000-00000000069a', 'Een onbeleefd antwoord.', now() - interval '1 hour');

-- An open takedown request about rumour 1.
INSERT INTO public.takedown_requests (reference, token_hash, rumour_id, relation, requester_name, requester_email, explanation)
VALUES ('VR-RPTSTA', md5('a') || md5('b'), '00000000-0000-0000-0000-0000000069f1', 'self',
        'Meld Test', 'meld@example.test', 'Dit gerucht klopt niet.');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- --------------------------------------------------------------- the table
SELECT hasnt_table('public', 'reported_conversations', 'the old reports table is gone');
SELECT ok(
  NOT has_table_privilege('anon', 'public.reports', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.reports', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.reports', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.reports', 'DELETE'),
  'nobody writes reports through the API; visitors cannot read them');
SELECT ok(
  NOT has_function_privilege('anon', 'public.submit_report(text, uuid, text, text)', 'EXECUTE'),
  'visitors cannot report');

-- ------------------------------------------------------------------ submit
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000069b');
SELECT lives_ok(
  $$SELECT public.submit_report('rumour', '00000000-0000-0000-0000-0000000069f1', 'incorrect')$$,
  'a user can report a public rumour');
SELECT throws_ok(
  $$SELECT public.submit_report('rumour', '00000000-0000-0000-0000-0000000069f1', 'offensive')$$,
  'VR003', NULL, 'one open report per user per item');
SELECT throws_ok(
  $$SELECT public.submit_report('rumour', '00000000-0000-0000-0000-0000000069f9', 'incorrect')$$,
  'P0002', NULL, 'a rumour that is not public cannot be reported');
SELECT throws_ok(
  $$SELECT public.submit_report('rumour', '00000000-0000-0000-0000-0000000069f2', 'harassment')$$,
  '22023', NULL, 'the reason comes from the list for the kind of item');
SELECT throws_ok(
  $$SELECT public.submit_report('rumour', '00000000-0000-0000-0000-0000000069f2', 'other', '  ')$$,
  '22023', NULL, '"Andere" needs an explanation');
SELECT lives_ok(
  $$SELECT public.submit_report('rumour', '00000000-0000-0000-0000-0000000069f2', 'other', 'Dit is een verzonnen verhaal.')$$,
  'a report with "Andere" and an explanation is accepted');
SELECT lives_ok(
  $$SELECT public.submit_report('classified', '00000000-0000-0000-0000-0000000069e1', 'spam')$$,
  'a user can report an active zoekertje');
SELECT throws_ok(
  $$SELECT public.submit_report('classified', '00000000-0000-0000-0000-0000000069e2', 'spam')$$,
  'P0002', NULL, 'an inactive zoekertje cannot be reported');
SELECT lives_ok(
  $$SELECT public.submit_report('conversation', '00000000-0000-0000-0000-0000000069c1', 'harassment', 'Onbeleefd.')$$,
  'a participant can report their conversation');
RESET ROLE;

SELECT results_eq(
  $$SELECT target_type, reporter_id, reported_user_id, status FROM public.reports
     WHERE conversation_id = '00000000-0000-0000-0000-0000000069c1'$$,
  $$VALUES ('conversation'::text, '00000000-0000-0000-0000-00000000069b'::uuid,
            '00000000-0000-0000-0000-00000000069a'::uuid, 'open'::text)$$,
  'a conversation report is about the other participant');
SELECT is(
  (SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000069f1'),
  'rumour', 'a reported rumour stays visible until a moderator decides (D-015)');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000069d');
SELECT throws_ok(
  $$SELECT public.submit_report('conversation', '00000000-0000-0000-0000-0000000069c1', 'spam')$$,
  'P0002', NULL, 'an outsider cannot report a conversation they are not in');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000069a');
SELECT throws_ok(
  $$SELECT public.submit_report('rumour', '00000000-0000-0000-0000-0000000069f1', 'incorrect')$$,
  'VR004', NULL, 'an author cannot report their own rumour');
SELECT throws_ok(
  $$SELECT public.submit_report('classified', '00000000-0000-0000-0000-0000000069e1', 'spam')$$,
  'VR004', NULL, 'an author cannot report their own zoekertje');
RESET ROLE;

-- At most 10 reports per user per day: the outsider already made 9 (closed).
INSERT INTO public.reports (target_type, rumour_id, reporter_id, reason, status, decided_at)
SELECT 'rumour', '00000000-0000-0000-0000-0000000069f2', '00000000-0000-0000-0000-00000000069d',
       'spam', 'dismissed', now()
FROM generate_series(1, 9);
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000069d');
SELECT lives_ok(
  $$SELECT public.submit_report('rumour', '00000000-0000-0000-0000-0000000069f2', 'incorrect')$$,
  'a tenth report on one day is accepted');
SELECT throws_ok(
  $$SELECT public.submit_report('classified', '00000000-0000-0000-0000-0000000069e1', 'spam')$$,
  'VR002', NULL, 'an eleventh report on one day is refused');
RESET ROLE;

-- ------------------------------------------------------------- who may read
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000069b');
SELECT is(
  (SELECT count(*)::int FROM public.reports), 0,
  'a user cannot read reports, not even their own');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000069c');
SELECT is(
  (SELECT count(*)::int FROM public.reports WHERE status = 'open'), 5,
  'staff read every open report');
SELECT is(
  (SELECT count(*)::int FROM public.messages WHERE conversation_id = '00000000-0000-0000-0000-0000000069c1'), 0,
  'staff cannot read messages directly');
RESET ROLE;

-- Report ids for the checks below, looked up before switching roles.
SELECT set_config('rp.conversation',
  (SELECT id::text FROM public.reports WHERE conversation_id = '00000000-0000-0000-0000-0000000069c1'), true);
SELECT set_config('rp.rumour1',
  (SELECT id::text FROM public.reports WHERE rumour_id = '00000000-0000-0000-0000-0000000069f1'), true);
SELECT set_config('rp.classified',
  (SELECT id::text FROM public.reports WHERE classified_id = '00000000-0000-0000-0000-0000000069e1'), true);
SELECT set_config('rp.rumour2',
  (SELECT id::text FROM public.reports
    WHERE rumour_id = '00000000-0000-0000-0000-0000000069f2' AND reporter_id = '00000000-0000-0000-0000-00000000069b'), true);

-- ------------------------------------------------------------ who may decide
SELECT ok(
  NOT has_function_privilege('anon', 'public.remove_reported_content(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.close_report(uuid, text, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_reported_conversation(uuid)', 'EXECUTE'),
  'visitors cannot call the staff functions');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000069b');
SELECT throws_ok(
  $$SELECT * FROM public.get_reported_conversation(current_setting('rp.conversation')::uuid)$$,
  '42501', NULL, 'a user cannot read a conversation through a report');
SELECT throws_ok(
  $$SELECT public.remove_reported_content(current_setting('rp.rumour1')::uuid)$$,
  '42501', NULL, 'a user cannot remove reported content');
SELECT throws_ok(
  $$SELECT public.close_report(current_setting('rp.rumour1')::uuid, 'dismissed')$$,
  '42501', NULL, 'a user cannot close a report');
RESET ROLE;

-- ------------------------------------------------------- read conversation
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000069c');
SELECT results_eq(
  $$SELECT sender_username, body FROM public.get_reported_conversation(current_setting('rp.conversation')::uuid)$$,
  $$VALUES ('rp_test_melder'::text, 'Is de plaats nog vrij?'::text),
           ('rp_test_auteur'::text, 'Een onbeleefd antwoord.'::text)$$,
  'staff read the reported conversation through its report, oldest first');
SELECT results_eq(
  $$SELECT actor_id, action, target_type, details ->> 'report' FROM public.staff_actions
     WHERE target_id = '00000000-0000-0000-0000-0000000069c1'$$,
  $$VALUES ('00000000-0000-0000-0000-00000000069c'::uuid, 'conversation_viewed'::text, 'conversation'::text,
            current_setting('rp.conversation'))$$,
  'reading it is logged, with the report');
SELECT throws_ok(
  $$SELECT * FROM public.get_reported_conversation(current_setting('rp.rumour1')::uuid)$$,
  'P0002', NULL, 'a rumour report gives no access to any conversation');

-- --------------------------------------------------------- close: conversation
SELECT throws_ok(
  $$SELECT public.remove_reported_content(current_setting('rp.conversation')::uuid)$$,
  '22023', NULL, 'conversations are not removed');
SELECT throws_ok(
  $$SELECT public.close_report(current_setting('rp.conversation')::uuid, 'action_taken', ' ')$$,
  '22023', NULL, 'a measure needs a note saying what was done');
SELECT lives_ok(
  $$SELECT public.close_report(current_setting('rp.conversation')::uuid, 'action_taken', 'Gewaarschuwd per e-mail.')$$,
  'a moderator closes a conversation report with a measure');
SELECT throws_ok(
  $$SELECT * FROM public.get_reported_conversation(current_setting('rp.conversation')::uuid)$$,
  'P0002', NULL, 'once the report is closed, the conversation is private again');
SELECT throws_ok(
  $$SELECT public.close_report(current_setting('rp.conversation')::uuid, 'dismissed')$$,
  'P0002', NULL, 'a report cannot be decided twice');

-- --------------------------------------------------------- remove: rumour
SELECT throws_ok(
  $$SELECT public.close_report(current_setting('rp.rumour1')::uuid, 'action_taken', 'Iets')$$,
  '22023', NULL, 'reported content is removed, not closed with a measure');
SELECT lives_ok(
  $$SELECT public.remove_reported_content(current_setting('rp.rumour1')::uuid, 'Geen bron voor deze bewering.')$$,
  'a moderator removes a reported rumour');
SELECT results_eq(
  $$SELECT status, removal_note FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000069f1'$$,
  $$VALUES ('removed'::text, 'Geen bron voor deze bewering.'::text)$$,
  'the rumour is removed, with the note for the author');
SELECT is(
  (SELECT status FROM public.takedown_requests WHERE reference = 'VR-RPTSTA'),
  'removed', 'an open takedown request about the rumour is answered too');
SELECT results_eq(
  $$SELECT action, target_type, details -> 'takedown_requests' FROM public.staff_actions
     WHERE target_id = '00000000-0000-0000-0000-0000000069f1'$$,
  $$VALUES ('content_removed'::text, 'rumour'::text, '["VR-RPTSTA"]'::jsonb)$$,
  'the removal is logged once');

-- ------------------------------------------------------ remove: zoekertje
SELECT lives_ok(
  $$SELECT public.remove_reported_content(current_setting('rp.classified')::uuid)$$,
  'a moderator removes a reported zoekertje');
SELECT is(
  (SELECT count(*)::int FROM public.reports
    WHERE classified_id = '00000000-0000-0000-0000-0000000069e1' AND status = 'content_removed'),
  1, 'the report is closed as content removed');
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000069e1'), 0,
  'visitors no longer see the removed zoekertje');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000069a');
SELECT isnt(
  (SELECT removed_at FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000069e1'), NULL,
  'the author still sees their zoekertje, as removed');
SELECT throws_ok(
  $$UPDATE public.classifieds SET removed_at = NULL WHERE id = '00000000-0000-0000-0000-0000000069e1'$$,
  '42501', NULL, 'the author cannot undo the removal');
RESET ROLE;

-- ---------------------------------------------------------- close: dismiss
-- Rumour 2 has two open reports (the reporter's and the outsider's).
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000069c');
SELECT lives_ok(
  $$SELECT public.close_report(current_setting('rp.rumour2')::uuid, 'dismissed')$$,
  'a moderator closes a report without action');
SELECT is(
  (SELECT count(*)::int FROM public.reports
    WHERE rumour_id = '00000000-0000-0000-0000-0000000069f2' AND status = 'open'),
  0, 'every open report about the item is closed with it');
SELECT results_eq(
  $$SELECT action, jsonb_array_length(details -> 'reports') FROM public.staff_actions
     WHERE target_id = '00000000-0000-0000-0000-0000000069f2'$$,
  $$VALUES ('report_dismissed'::text, 2)$$,
  'closing is logged once, with every report it closed');
SELECT is(
  (SELECT status FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000069f2'),
  'rumour', 'a dismissed report leaves the rumour visible');
RESET ROLE;

-- ----------------------------------------- takedown removals close reports
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000069b');
SELECT public.submit_report('rumour', '00000000-0000-0000-0000-0000000069f2', 'private_info');
RESET ROLE;
INSERT INTO public.takedown_requests (reference, token_hash, rumour_id, relation, requester_name, requester_email, explanation)
VALUES ('VR-RPTSTB', md5('c') || md5('d'), '00000000-0000-0000-0000-0000000069f2', 'self',
        'Meld Test', 'meld2@example.test', 'Dit gerucht klopt niet.');
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000069c');
SELECT public.remove_rumour_for_takedown(
  (SELECT id FROM public.takedown_requests WHERE reference = 'VR-RPTSTB'));
RESET ROLE;
SELECT is(
  (SELECT status FROM public.reports
    WHERE rumour_id = '00000000-0000-0000-0000-0000000069f2' AND reason = 'private_info'),
  'content_removed', 'removing a rumour for a takedown request closes its open reports');

SELECT * FROM finish();
ROLLBACK;
