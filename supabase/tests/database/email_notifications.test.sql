-- Email notifications (issue #98, D-025): who gets an email about a new
-- message or a decision on their rumour, and who may turn emails off.
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

-- The ad owner, the user who answers, and an outsider.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000098a', 'en_eigenaar@example.test', '{"username": "en_test_eigenaar"}'),
  ('00000000-0000-0000-0000-00000000098b', 'en_reageerder@example.test', '{"username": "en_test_reageerder"}'),
  ('00000000-0000-0000-0000-00000000098c', 'en_ander@example.test', '{"username": "en_test_ander"}');
INSERT INTO public.classifieds (id, user_id, type, title, contact_name) VALUES
  ('00000000-0000-0000-0000-0000000098e1', '00000000-0000-0000-0000-00000000098a', 'team_seeks_player', 'Meldingen', 'Eigenaar');
INSERT INTO public.conversations (id, ad_id, ad_type, initiator_id, recipient_id) VALUES
  ('00000000-0000-0000-0000-0000000098c1', '00000000-0000-0000-0000-0000000098e1', 'classified',
   '00000000-0000-0000-0000-00000000098b', '00000000-0000-0000-0000-00000000098a');
INSERT INTO public.rumours (id, creator_id, player_name, category, status, from_club_name, to_club_name) VALUES
  ('00000000-0000-0000-0000-0000000098f1', '00000000-0000-0000-0000-00000000098b', 'Mats Melding', 'transfer', 'rumour', 'Club A', 'Club B');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- A message from the answerer to the owner, sent `ago` before now.
CREATE FUNCTION pg_temp.message(id uuid, sender uuid, ago interval) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.messages (id, conversation_id, sender_id, content, created_at)
  VALUES (id, '00000000-0000-0000-0000-0000000098c1', sender, 'Geheime inhoud', now() - ago)
  RETURNING id;
$$;

-- Only the server, with the service role, may look up addresses.
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.message_notification_email(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.message_notification_email(uuid)', 'EXECUTE'),
  'users cannot look up who gets a message email');
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.rumour_notification_email(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.rumour_notification_email(uuid)', 'EXECUTE'),
  'users cannot look up who gets a rumour email');
SELECT ok(
  has_function_privilege('service_role', 'public.message_notification_email(uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.rumour_notification_email(uuid)', 'EXECUTE'),
  'the service role can');

-- A first message to someone who isn't around: email the recipient.
SELECT pg_temp.message('00000000-0000-0000-0000-000000009801', '00000000-0000-0000-0000-00000000098b', '1 hour');
SELECT is(
  public.message_notification_email('00000000-0000-0000-0000-000000009801'),
  'en_eigenaar@example.test', 'the first unread message emails the recipient');

-- A second one while the first is still unread: no second email.
SELECT pg_temp.message('00000000-0000-0000-0000-000000009802', '00000000-0000-0000-0000-00000000098b', '30 minutes');
SELECT is(
  public.message_notification_email('00000000-0000-0000-0000-000000009802'),
  NULL, 'no email while an earlier message is unread');

-- The owner read them a while ago; a new message emails again.
UPDATE public.messages SET is_read = true, read_at = now() - interval '20 minutes'
 WHERE id IN ('00000000-0000-0000-0000-000000009801', '00000000-0000-0000-0000-000000009802');
SELECT pg_temp.message('00000000-0000-0000-0000-000000009803', '00000000-0000-0000-0000-00000000098b', '0');
SELECT is(
  public.message_notification_email('00000000-0000-0000-0000-000000009803'),
  'en_eigenaar@example.test', 'after reading, the next message emails again');

-- Read in the last 10 minutes: the owner is chatting, no email.
UPDATE public.messages SET is_read = true, read_at = now() - interval '2 minutes'
 WHERE id = '00000000-0000-0000-0000-000000009803';
SELECT pg_temp.message('00000000-0000-0000-0000-000000009804', '00000000-0000-0000-0000-00000000098b', '0');
SELECT is(
  public.message_notification_email('00000000-0000-0000-0000-000000009804'),
  NULL, 'no email to someone who read a message here in the last 10 minutes');

-- The owner just replied: no email for the answer to it.
SELECT pg_temp.message('00000000-0000-0000-0000-000000009805', '00000000-0000-0000-0000-00000000098a', '1 minute');
UPDATE public.messages SET is_read = true, read_at = now() - interval '1 hour';
SELECT pg_temp.message('00000000-0000-0000-0000-000000009806', '00000000-0000-0000-0000-00000000098b', '0');
SELECT is(
  public.message_notification_email('00000000-0000-0000-0000-000000009806'),
  NULL, 'no email to someone who sent a message here in the last 10 minutes');

-- An already read message never emails.
SELECT is(
  public.message_notification_email('00000000-0000-0000-0000-000000009801'),
  NULL, 'a read message sends no email');

-- The author of a rumour hears about the decision.
SELECT is(
  public.rumour_notification_email('00000000-0000-0000-0000-0000000098f1'),
  'en_reageerder@example.test', 'a rumour decision emails its author');

-- Turning emails off.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000098b');
SELECT lives_ok(
  $$INSERT INTO public.email_opt_outs (user_id) VALUES ('00000000-0000-0000-0000-00000000098b')$$,
  'a user can turn their emails off');
SELECT throws_ok(
  $$INSERT INTO public.email_opt_outs (user_id) VALUES ('00000000-0000-0000-0000-00000000098a')$$,
  '42501', NULL, 'a user cannot turn someone else''s emails off');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000098c');
SELECT is(
  (SELECT count(*)::int FROM public.email_opt_outs),
  0, 'others do not see who turned emails off');
DELETE FROM public.email_opt_outs WHERE user_id = '00000000-0000-0000-0000-00000000098b';

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.email_opt_outs),
  1, 'an outsider cannot turn someone''s emails back on');

-- No emails for someone who turned them off.
SELECT is(
  public.rumour_notification_email('00000000-0000-0000-0000-0000000098f1'),
  NULL, 'no rumour email after turning emails off');
UPDATE public.messages SET is_read = true, read_at = now() - interval '1 hour';
DELETE FROM public.messages WHERE sender_id = '00000000-0000-0000-0000-00000000098b'
   AND created_at > now() - interval '10 minutes';
SELECT pg_temp.message('00000000-0000-0000-0000-000000009807', '00000000-0000-0000-0000-00000000098a', '30 minutes');
SELECT is(
  public.message_notification_email('00000000-0000-0000-0000-000000009807'),
  NULL, 'no message email after turning emails off');

-- Turning them back on.
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000098b');
DELETE FROM public.email_opt_outs WHERE user_id = '00000000-0000-0000-0000-00000000098b';
RESET ROLE;
SELECT is(
  public.message_notification_email('00000000-0000-0000-0000-000000009807'),
  'en_reageerder@example.test', 'emails come back after turning them on');

-- Deleting the account deletes the opt-out.
INSERT INTO public.email_opt_outs (user_id) VALUES ('00000000-0000-0000-0000-00000000098c');
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000098c';
SELECT is(
  (SELECT count(*)::int FROM public.email_opt_outs WHERE user_id = '00000000-0000-0000-0000-00000000098c'),
  0, 'an account deletion removes the opt-out');

SELECT * FROM finish();
ROLLBACK;
