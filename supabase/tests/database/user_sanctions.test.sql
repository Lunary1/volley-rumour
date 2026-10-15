-- Suspensions, the verified badge and the moderator role: admins only, every
-- change logged, and a suspended user can read but not post, vote, message or
-- edit their profile (issue #80, J-15, D-016). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(71);

-- An admin, a moderator, the user who gets suspended, another user and a user
-- whose suspension ran out.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000080a', 'sa_admin@example.test', '{"username": "sanc_test_admin"}'),
  ('00000000-0000-0000-0000-00000000080b', 'sa_mod@example.test', '{"username": "sanc_test_mod"}'),
  ('00000000-0000-0000-0000-00000000080c', 'sa_dader@example.test', '{"username": "sanc_test_dader"}'),
  ('00000000-0000-0000-0000-00000000080d', 'sa_ander@example.test', '{"username": "sanc_test_ander"}'),
  ('00000000-0000-0000-0000-00000000080e', 'sa_verlopen@example.test', '{"username": "sanc_test_verlopen"}');
UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-00000000080a';
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000080b';

-- The other user's public rumour, the suspended user's zoekertjes, and a
-- conversation between the two.
INSERT INTO public.rumours (id, creator_id, player_name, category, status) VALUES
  ('00000000-0000-0000-0000-0000000080f1', '00000000-0000-0000-0000-00000000080d', 'Schors Test', 'transfer', 'rumour');
INSERT INTO public.classifieds (id, user_id, type, title, contact_name) VALUES
  ('00000000-0000-0000-0000-0000000080e1', '00000000-0000-0000-0000-00000000080c', 'player_seeks_team', 'Mijn Zoekertje', 'Dader'),
  ('00000000-0000-0000-0000-0000000080e2', '00000000-0000-0000-0000-00000000080c', 'player_seeks_team', 'Weg Zoekertje', 'Dader');
INSERT INTO public.conversations (id, ad_id, ad_type, initiator_id, recipient_id) VALUES
  ('00000000-0000-0000-0000-0000000080c1', '00000000-0000-0000-0000-0000000080e1', 'classified',
   '00000000-0000-0000-0000-00000000080d', '00000000-0000-0000-0000-00000000080c');
INSERT INTO public.messages (id, conversation_id, sender_id, content) VALUES
  ('00000000-0000-0000-0000-0000000080a1', '00000000-0000-0000-0000-0000000080c1',
   '00000000-0000-0000-0000-00000000080d', 'Is de plaats nog vrij?');

-- A suspension that ended yesterday.
INSERT INTO public.user_suspensions (user_id, suspended_until, reason) VALUES
  ('00000000-0000-0000-0000-00000000080e', now() - interval '1 day', 'Oude schorsing');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- ------------------------------------------------------------ permissions
SELECT ok(
  NOT has_table_privilege('anon', 'public.user_suspensions', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.user_suspensions', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.user_suspensions', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.user_suspensions', 'DELETE'),
  'nobody writes suspensions through the API; visitors cannot read them');
SELECT ok(
  NOT has_function_privilege('anon', 'public.suspend_user(uuid, timestamptz, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.lift_suspension(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.set_verified_source(uuid, boolean, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.set_moderator(uuid, boolean, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.staff_list_users(text, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.staff_get_user(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.is_admin()', 'EXECUTE'),
  'visitors cannot call the sanction functions');
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.check_account_not_suspended()', 'EXECUTE'),
  'the suspension check is not callable through the API');

-- -------------------------------------------------------------- is_admin()
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080a');
SELECT is(public.is_admin(), true, 'an admin is an admin');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080b');
SELECT is(public.is_admin(), false, 'a moderator is not an admin');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080d');
SELECT is(public.is_admin(), false, 'a user is not an admin');

-- ---------------------------------------------------------------- suspend
SELECT throws_ok(
  $$SELECT public.suspend_user('00000000-0000-0000-0000-00000000080c', now() + interval '7 days', 'Spam')$$,
  '42501', NULL, 'a user cannot suspend anyone');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080b');
SELECT throws_ok(
  $$SELECT public.suspend_user('00000000-0000-0000-0000-00000000080c', now() + interval '7 days', 'Spam')$$,
  '42501', NULL, 'a moderator cannot suspend anyone (D-016)');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080a');
SELECT throws_ok(
  $$SELECT public.suspend_user('00000000-0000-0000-0000-00000000080c', now() + interval '7 days', '  ')$$,
  '22023', NULL, 'a suspension needs a reason');
SELECT throws_ok(
  $$SELECT public.suspend_user('00000000-0000-0000-0000-00000000080c', now() - interval '1 hour', 'Spam')$$,
  '22023', NULL, 'a suspension cannot end in the past');
SELECT throws_ok(
  $$SELECT public.suspend_user('00000000-0000-0000-0000-000000000999', now() + interval '7 days', 'Spam')$$,
  'P0002', NULL, 'an unknown user cannot be suspended');
SELECT throws_ok(
  $$SELECT public.suspend_user('00000000-0000-0000-0000-00000000080a', now() + interval '7 days', 'Spam')$$,
  'VR006', NULL, 'an admin cannot suspend themselves');
SELECT throws_ok(
  $$SELECT public.suspend_user('00000000-0000-0000-0000-00000000080b', now() + interval '7 days', 'Spam')$$,
  'VR006', NULL, 'a moderator cannot be suspended');
SELECT lives_ok(
  $$SELECT public.suspend_user('00000000-0000-0000-0000-00000000080c', now() + interval '7 days', 'Beledigende berichten')$$,
  'an admin suspends a user until a date');
RESET ROLE;

SELECT results_eq(
  $$SELECT actor_id, reason, details->>'until' IS NOT NULL, (details->>'replaced')::boolean
      FROM public.staff_actions
     WHERE action = 'user_suspended' AND target_id = '00000000-0000-0000-0000-00000000080c'$$,
  $$VALUES ('00000000-0000-0000-0000-00000000080a'::uuid, 'Beledigende berichten', true, false)$$,
  'the suspension is logged with the admin, the reason and the end date');

-- --------------------------------------------------------- who sees what
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080c');
SELECT is(
  (SELECT reason FROM public.user_suspensions),
  'Beledigende berichten',
  'the suspended user reads their own suspension and its reason');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080d');
SELECT is(
  (SELECT count(*)::int FROM public.user_suspensions),
  0,
  'other users cannot see who is suspended');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080b');
SELECT is(
  (SELECT count(*)::int FROM public.user_suspensions WHERE user_id = '00000000-0000-0000-0000-00000000080c'),
  1,
  'staff can see suspensions');
RESET ROLE;

-- --------------------------------------------- a suspended user is read-only
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080c');
SELECT throws_ok(
  $$INSERT INTO public.rumours (creator_id, player_name, category)
    VALUES ('00000000-0000-0000-0000-00000000080c', 'Nieuw Gerucht', 'transfer')$$,
  'VR005', NULL, 'a suspended user cannot post a rumour (checked before the source rules)');
SELECT throws_ok(
  $$INSERT INTO public.classifieds (user_id, type, title, contact_name)
    VALUES ('00000000-0000-0000-0000-00000000080c', 'player_seeks_team', 'Nieuw', 'Dader')$$,
  'VR005', NULL, 'a suspended user cannot post a zoekertje');
SELECT throws_ok(
  $$UPDATE public.classifieds SET title = 'Herschreven' WHERE id = '00000000-0000-0000-0000-0000000080e1'$$,
  'VR005', NULL, 'a suspended user cannot edit their zoekertje');
SELECT throws_ok(
  $$INSERT INTO public.rumour_votes (rumour_id, user_id, vote_type)
    VALUES ('00000000-0000-0000-0000-0000000080f1', '00000000-0000-0000-0000-00000000080c', true)$$,
  'VR005', NULL, 'a suspended user cannot vote');
SELECT throws_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES ('00000000-0000-0000-0000-0000000080c1', '00000000-0000-0000-0000-00000000080c', 'Nog iets')$$,
  'VR005', NULL, 'a suspended user cannot send a message');
SELECT throws_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    VALUES ('00000000-0000-0000-0000-0000000080e1', 'classified',
            '00000000-0000-0000-0000-00000000080c', '00000000-0000-0000-0000-00000000080a')$$,
  'VR005', NULL, 'a suspended user cannot start a conversation');
SELECT throws_ok(
  $$UPDATE public.profiles SET username = 'nieuwe_naam' WHERE id = '00000000-0000-0000-0000-00000000080c'$$,
  'VR005', NULL, 'a suspended user cannot edit their profile');

SELECT is(
  (SELECT count(*)::int FROM public.rumours WHERE id = '00000000-0000-0000-0000-0000000080f1'),
  1,
  'a suspended user can still read');
SELECT lives_ok(
  $$UPDATE public.messages SET is_read = true, read_at = now() WHERE id = '00000000-0000-0000-0000-0000000080a1'$$,
  'a suspended user can still mark messages as read');
SELECT lives_ok(
  $$UPDATE public.conversations SET is_archived = true WHERE id = '00000000-0000-0000-0000-0000000080c1'$$,
  'a suspended user can still archive a conversation');
SELECT lives_ok(
  $$SELECT public.submit_report('rumour', '00000000-0000-0000-0000-0000000080f1', 'incorrect')$$,
  'a suspended user can still report');
SELECT lives_ok(
  $$INSERT INTO public.blocked_users (blocker_id, blocked_id)
    VALUES ('00000000-0000-0000-0000-00000000080c', '00000000-0000-0000-0000-00000000080e')$$,
  'a suspended user can still block someone');
SELECT lives_ok(
  $$DELETE FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000080e2'$$,
  'a suspended user can still delete their own zoekertje');
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000080e2'),
  0,
  'and the zoekertje is gone');
SELECT is(
  (SELECT title FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000080e1'),
  'Mijn Zoekertje',
  'existing content stays as it was');

-- Others are not affected, also when they write to the suspended user.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080d');
SELECT lives_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES ('00000000-0000-0000-0000-0000000080c1', '00000000-0000-0000-0000-00000000080d', 'Hallo?')$$,
  'others can still message a suspended user');
SELECT lives_ok(
  $$UPDATE public.profiles SET display_name = 'Ander' WHERE id = '00000000-0000-0000-0000-00000000080d'$$,
  'others can still edit their profile');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080e');
SELECT lives_ok(
  $$UPDATE public.profiles SET display_name = 'Weer Vrij' WHERE id = '00000000-0000-0000-0000-00000000080e'$$,
  'a suspension that ran out no longer applies');
RESET ROLE;

-- An indefinite suspension replaces the running one.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080a');
SELECT lives_ok(
  $$SELECT public.suspend_user('00000000-0000-0000-0000-00000000080c', NULL, 'Herhaald na waarschuwing')$$,
  'an admin can suspend indefinitely, replacing the running suspension');
RESET ROLE;
SELECT is(
  (SELECT suspended_until FROM public.user_suspensions WHERE user_id = '00000000-0000-0000-0000-00000000080c'),
  NULL,
  'an indefinite suspension has no end date');
SELECT results_eq(
  $$SELECT details->'until' = 'null'::jsonb, (details->>'replaced')::boolean
      FROM public.staff_actions
     WHERE action = 'user_suspended' AND target_id = '00000000-0000-0000-0000-00000000080c'
       AND reason = 'Herhaald na waarschuwing'$$,
  $$VALUES (true, true)$$,
  'the log shows it is indefinite and replaced a running suspension');

-- ------------------------------------------------------------ staff lists
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080d');
SELECT throws_ok(
  $$SELECT * FROM public.staff_list_users()$$,
  '42501', NULL, 'a user cannot list users with their roles');
SELECT throws_ok(
  $$SELECT * FROM public.staff_get_user('00000000-0000-0000-0000-00000000080c')$$,
  '42501', NULL, 'a user cannot look up a user as staff');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080b');
SELECT results_eq(
  $$SELECT username, role FROM public.staff_list_users('SANC_TEST', 'staff')$$,
  $$VALUES ('sanc_test_admin', 'admin'), ('sanc_test_mod', 'moderator')$$,
  'staff search users case-insensitively and filter on staff');
SELECT results_eq(
  $$SELECT username, suspension_reason FROM public.staff_list_users('sanc_test', 'suspended')$$,
  $$VALUES ('sanc_test_dader', 'Herhaald na waarschuwing')$$,
  'the suspended filter shows running suspensions only');
SELECT results_eq(
  $$SELECT is_suspended, suspended_until FROM public.staff_get_user('00000000-0000-0000-0000-00000000080c')$$,
  $$VALUES (true, NULL::timestamptz)$$,
  'a moderator sees that a user is suspended');
SELECT is(
  (SELECT is_suspended FROM public.staff_get_user('00000000-0000-0000-0000-00000000080e')),
  false,
  'a suspension that ran out does not count');
SELECT throws_ok(
  $$SELECT * FROM public.staff_list_users(NULL, 'iedereen')$$,
  '22023', NULL, 'an unknown filter is refused');

-- -------------------------------------------------------------------- lift
SELECT throws_ok(
  $$SELECT public.lift_suspension('00000000-0000-0000-0000-00000000080c')$$,
  '42501', NULL, 'a moderator cannot lift a suspension');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080a');
SELECT lives_ok(
  $$SELECT public.lift_suspension('00000000-0000-0000-0000-00000000080c', 'Na uitleg')$$,
  'an admin lifts a suspension');
SELECT throws_ok(
  $$SELECT public.lift_suspension('00000000-0000-0000-0000-00000000080c')$$,
  'VR007', NULL, 'a user who is not suspended cannot be lifted');
SELECT throws_ok(
  $$SELECT public.lift_suspension('00000000-0000-0000-0000-00000000080e')$$,
  'VR007', NULL, 'nor can one whose suspension ran out');
RESET ROLE;
SELECT is(
  (SELECT reason FROM public.staff_actions
    WHERE action = 'user_unsuspended' AND target_id = '00000000-0000-0000-0000-00000000080c'),
  'Na uitleg',
  'lifting is logged with the note');
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080c');
SELECT lives_ok(
  $$UPDATE public.profiles SET display_name = 'Weer Welkom' WHERE id = '00000000-0000-0000-0000-00000000080c'$$,
  'after lifting, the user can write again');
RESET ROLE;

-- ---------------------------------------------------------- verified badge
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080b');
SELECT throws_ok(
  $$SELECT public.set_verified_source('00000000-0000-0000-0000-00000000080d', true)$$,
  '42501', NULL, 'a moderator cannot grant the verified badge (D-016)');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080d');
SELECT throws_ok(
  $$UPDATE public.profiles SET is_verified_source = true WHERE id = '00000000-0000-0000-0000-00000000080d'$$,
  '42501', NULL, 'a user cannot give themselves the badge');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080a');
SELECT lives_ok(
  $$SELECT public.set_verified_source('00000000-0000-0000-0000-00000000080d', true, 'Clubsecretaris')$$,
  'an admin grants the verified badge');
SELECT throws_ok(
  $$SELECT public.set_verified_source('00000000-0000-0000-0000-00000000080d', true)$$,
  'VR007', NULL, 'granting it twice is refused');
SELECT throws_ok(
  $$SELECT public.set_verified_source('00000000-0000-0000-0000-000000000999', true)$$,
  'P0002', NULL, 'an unknown user cannot get the badge');
RESET ROLE;
SELECT is(
  (SELECT is_verified_source FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000080d'),
  true,
  'the user has the badge');
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080a');
SELECT lives_ok(
  $$SELECT public.set_verified_source('00000000-0000-0000-0000-00000000080d', false)$$,
  'an admin revokes the verified badge');
RESET ROLE;
SELECT results_eq(
  $$SELECT action, reason FROM public.staff_actions
     WHERE action IN ('badge_granted', 'badge_revoked') AND target_id = '00000000-0000-0000-0000-00000000080d'
     ORDER BY action DESC$$,
  $$VALUES ('badge_revoked', NULL::text), ('badge_granted', 'Clubsecretaris')$$,
  'granting and revoking the badge are logged');

-- ---------------------------------------------------------- moderator role
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080b');
SELECT throws_ok(
  $$SELECT public.set_moderator('00000000-0000-0000-0000-00000000080d', true)$$,
  '42501', NULL, 'a moderator cannot make someone a moderator');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080a');
SELECT lives_ok(
  $$SELECT public.set_moderator('00000000-0000-0000-0000-00000000080d', true, 'Helpt tijdens de transferperiode')$$,
  'an admin makes a user a moderator');
SELECT throws_ok(
  $$SELECT public.set_moderator('00000000-0000-0000-0000-00000000080d', true)$$,
  'VR007', NULL, 'making a moderator a moderator again is refused');
SELECT throws_ok(
  $$SELECT public.suspend_user('00000000-0000-0000-0000-00000000080d', NULL, 'Spam')$$,
  'VR006', NULL, 'the new moderator cannot be suspended while staff');
SELECT throws_ok(
  $$SELECT public.set_moderator('00000000-0000-0000-0000-00000000080a', false)$$,
  'VR006', NULL, 'an admin cannot change their own role');
SELECT lives_ok(
  $$SELECT public.suspend_user('00000000-0000-0000-0000-00000000080c', now() + interval '1 day', 'Opnieuw')$$,
  'an admin suspends the other user again');
SELECT throws_ok(
  $$SELECT public.set_moderator('00000000-0000-0000-0000-00000000080c', true)$$,
  'VR006', NULL, 'a suspended user cannot become a moderator');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080d');
SELECT is(public.is_staff(), true, 'the new moderator is staff');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080a');
SELECT lives_ok(
  $$SELECT public.set_moderator('00000000-0000-0000-0000-00000000080d', false)$$,
  'an admin takes the moderator role away');
RESET ROLE;
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000080d');
SELECT is(public.is_staff(), false, 'without the role they are no longer staff');
RESET ROLE;
SELECT results_eq(
  $$SELECT details->>'from', details->>'to' FROM public.staff_actions
     WHERE action = 'role_changed' AND target_id = '00000000-0000-0000-0000-00000000080d'
     ORDER BY created_at, details->>'to'$$,
  $$VALUES ('user', 'moderator'), ('moderator', 'user')$$,
  'both role changes are logged with the old and new role');

SELECT * FROM finish();
ROLLBACK;
