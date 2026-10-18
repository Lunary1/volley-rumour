-- Zoekertjes: no contact email, contact through an online ad only, and ads
-- expire on 31 August with at least 30 days online (issues #83 and #84,
-- D-022, D-024, D-030). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(40);

-- a posts the ads, b contacts a, c is someone else, m is a moderator, s is
-- suspended.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000083a', 'zk83_a@example.test', '{"username": "zk83_poster"}'),
  ('00000000-0000-0000-0000-00000000083b', 'zk83_b@example.test', '{"username": "zk83_contact"}'),
  ('00000000-0000-0000-0000-00000000083c', 'zk83_c@example.test', '{"username": "zk83_other"}'),
  ('00000000-0000-0000-0000-00000000083d', 'zk83_m@example.test', '{"username": "zk83_moderator"}'),
  ('00000000-0000-0000-0000-00000000083e', 'zk83_s@example.test', '{"username": "zk83_suspended"}');
UPDATE public.profiles SET role = 'moderator' WHERE id = '00000000-0000-0000-0000-00000000083d';
INSERT INTO public.user_suspensions (user_id, suspended_until, reason) VALUES
  ('00000000-0000-0000-0000-00000000083e', NULL, 'Test');

INSERT INTO public.classifieds (id, user_id, type, title, contact_name, is_active, expires_at, removed_at) VALUES
  ('00000000-0000-0000-0000-0000000083e1', '00000000-0000-0000-0000-00000000083a',
   'team_seeks_player', 'Online', 'VC A', true, now() + interval '10 days', NULL),
  ('00000000-0000-0000-0000-0000000083e2', '00000000-0000-0000-0000-00000000083a',
   'team_seeks_player', 'Gevonden', 'VC A', false, now() + interval '10 days', NULL),
  ('00000000-0000-0000-0000-0000000083e3', '00000000-0000-0000-0000-00000000083a',
   'team_seeks_player', 'Verlopen', 'VC A', true, now() - interval '1 day', NULL),
  ('00000000-0000-0000-0000-0000000083e4', '00000000-0000-0000-0000-00000000083a',
   'team_seeks_player', 'Verwijderd', 'VC A', true, now() + interval '10 days', now()),
  ('00000000-0000-0000-0000-0000000083e5', '00000000-0000-0000-0000-00000000083e',
   'team_seeks_player', 'Van geschorste', 'VC S', true, now() - interval '1 day', NULL);

-- An earlier conversation about the ad that has since expired.
INSERT INTO public.conversations (id, ad_id, ad_type, initiator_id, recipient_id) VALUES
  ('00000000-0000-0000-0000-0000000083c1', '00000000-0000-0000-0000-0000000083e3', 'classified',
   '00000000-0000-0000-0000-00000000083b', '00000000-0000-0000-0000-00000000083a'),
  ('00000000-0000-0000-0000-0000000083c2', '00000000-0000-0000-0000-0000000083e4', 'classified',
   '00000000-0000-0000-0000-00000000083b', '00000000-0000-0000-0000-00000000083a');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;
CREATE FUNCTION pg_temp.act_as_visitor() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
$$;
CREATE FUNCTION pg_temp.visible_titles() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(title, ', ' ORDER BY title), '')
    FROM public.classifieds
   WHERE id::text LIKE '00000000-0000-0000-0000-0000000083e%';
$$;

-- ------------------------------------------------------ no contact email
SELECT hasnt_column('public', 'classifieds', 'contact_email',
  'the contact email is gone (D-022, D-030)');

-- ------------------------------------------------------ the expiry rule
SELECT is(public.classified_expiry('2026-10-18 12:00+02'), '2027-09-01 00:00+02'::timestamptz,
  'an autumn ad runs until the end of next 31 August');
SELECT is(public.classified_expiry('2026-03-10 12:00+01'), '2026-09-01 00:00+02'::timestamptz,
  'a spring ad runs until the end of this 31 August');
SELECT is(public.classified_expiry('2026-08-01 10:00+02'), '2026-09-01 00:00+02'::timestamptz,
  'an ad from 1 August runs to the end of the month, over 30 days');
SELECT is(public.classified_expiry('2026-08-15 12:00+02'), '2026-09-14 12:00+02'::timestamptz,
  'an ad from mid-August runs 30 days');
SELECT is(public.classified_expiry('2026-08-31 23:30+02'), '2026-09-30 23:30+02'::timestamptz,
  'late on 31 August, Belgian time: still 30 days');
SELECT is(public.classified_expiry('2026-09-01 00:30+02'), '2027-09-01 00:00+02'::timestamptz,
  'from 1 September, Belgian time: the next season');

-- ------------------------------------------------------------- posting
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000083a');

SELECT lives_ok(
  $$INSERT INTO public.classifieds (user_id, type, title, contact_name)
    VALUES ('00000000-0000-0000-0000-00000000083a', 'team_seeks_player', 'Nieuw', 'VC A')$$,
  'a user posts an ad');
SELECT is(
  (SELECT expires_at FROM public.classifieds WHERE title = 'Nieuw'),
  public.classified_expiry(now()),
  'a new ad gets its expiry date from the rule');
SELECT throws_ok(
  $$INSERT INTO public.classifieds (user_id, type, title, contact_name, expires_at)
    VALUES ('00000000-0000-0000-0000-00000000083a', 'team_seeks_player', 'Eeuwig', 'VC A', '2099-01-01')$$,
  '42501', NULL, 'users cannot choose the expiry date');
SELECT throws_ok(
  $$UPDATE public.classifieds SET expires_at = '2099-01-01' WHERE title = 'Online'$$,
  '42501', NULL, 'nor change it');
RESET ROLE;
DELETE FROM public.classifieds WHERE title = 'Nieuw';

-- ------------------------------------------------------------ who sees what
SELECT pg_temp.act_as_visitor();
SELECT is(pg_temp.visible_titles(), 'Online',
  'visitors see only online ads: not found, expired or removed');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000083c');
SELECT is(pg_temp.visible_titles(), 'Online', 'other users too');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000083a');
SELECT is(pg_temp.visible_titles(), 'Gevonden, Online, Verlopen, Verwijderd',
  'the owner sees all their ads');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000083d');
SELECT is(pg_temp.visible_titles(), 'Gevonden, Online, Van geschorste, Verlopen, Verwijderd',
  'staff see every ad');
RESET ROLE;

-- ----------------------------------------------------------- contact
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000083b');

SELECT lives_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    VALUES ('00000000-0000-0000-0000-0000000083e1', 'classified',
            '00000000-0000-0000-0000-00000000083b', '00000000-0000-0000-0000-00000000083a')$$,
  'a user contacts the poster of an online ad');
SELECT throws_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    VALUES ('00000000-0000-0000-0000-0000000083e2', 'classified',
            '00000000-0000-0000-0000-00000000083b', '00000000-0000-0000-0000-00000000083a')$$,
  'VR011', NULL, 'not about an ad marked gevonden');
SELECT throws_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    VALUES ('00000000-0000-0000-0000-0000000083e5', 'classified',
            '00000000-0000-0000-0000-00000000083b', '00000000-0000-0000-0000-00000000083e')$$,
  'VR011', NULL, 'not about an expired ad');
SELECT throws_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    VALUES ('00000000-0000-0000-0000-0000000083e4', 'classified',
            '00000000-0000-0000-0000-00000000083b', '00000000-0000-0000-0000-00000000083c')$$,
  'VR011', NULL, 'not about a removed ad');
SELECT throws_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    VALUES ('00000000-0000-0000-0000-0000000083e1', 'classified',
            '00000000-0000-0000-0000-00000000083b', '00000000-0000-0000-0000-00000000083c')$$,
  'VR011', NULL, 'only with the person who posted the ad');
SELECT throws_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    VALUES (gen_random_uuid(), 'classified',
            '00000000-0000-0000-0000-00000000083b', '00000000-0000-0000-0000-00000000083a')$$,
  'VR011', NULL, 'not about an ad that does not exist');
SELECT lives_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES ('00000000-0000-0000-0000-0000000083c1', '00000000-0000-0000-0000-00000000083b', 'Nog interesse?')$$,
  'an existing conversation goes on after the ad expired');

-- --------------------------------------------- titles in conversations
SELECT is(
  (SELECT title || ' ' || online::text FROM public.conversation_classified_titles(
     ARRAY['00000000-0000-0000-0000-0000000083e3']::uuid[])),
  'Verlopen false',
  'a participant still sees the title of an expired ad, marked offline');
SELECT is(
  (SELECT title || ' ' || online::text FROM public.conversation_classified_titles(
     ARRAY['00000000-0000-0000-0000-0000000083e1']::uuid[])),
  'Online true',
  'and of an online one');
SELECT is(
  (SELECT count(*)::int FROM public.conversation_classified_titles(
     ARRAY['00000000-0000-0000-0000-0000000083e4']::uuid[])),
  0, 'not of an ad a moderator removed');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000083c');
SELECT is(
  (SELECT count(*)::int FROM public.conversation_classified_titles(
     ARRAY['00000000-0000-0000-0000-0000000083e2', '00000000-0000-0000-0000-0000000083e3']::uuid[])),
  0, 'someone outside the conversation sees no titles');
RESET ROLE;

SELECT ok(
  NOT has_function_privilege('anon', 'public.conversation_classified_titles(uuid[])', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.renew_classified(uuid)', 'EXECUTE'),
  'visitors cannot call the title or renew functions');
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.validate_conversation_ad()', 'EXECUTE'),
  'the contact check is not callable');

-- ------------------------------------------------------------- renewing
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000083c');
SELECT throws_ok(
  $$SELECT public.renew_classified('00000000-0000-0000-0000-0000000083e3')$$,
  'P0002', NULL, 'nobody else can renew an ad');
RESET ROLE;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000083a');
SELECT throws_ok(
  $$SELECT public.renew_classified('00000000-0000-0000-0000-0000000083e1')$$,
  'P0002', NULL, 'an ad that has not expired is not renewed');
SELECT throws_ok(
  $$SELECT public.renew_classified('00000000-0000-0000-0000-0000000083e4')$$,
  'P0002', NULL, 'an ad a moderator removed is not renewed');
RESET ROLE;
UPDATE public.classifieds SET is_active = false, expires_at = now() - interval '2 days'
 WHERE id = '00000000-0000-0000-0000-0000000083e4';
UPDATE public.classifieds SET removed_at = now() - interval '1 day'
 WHERE id = '00000000-0000-0000-0000-0000000083e4';
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000083a');
SELECT throws_ok(
  $$SELECT public.renew_classified('00000000-0000-0000-0000-0000000083e4')$$,
  'P0002', NULL, 'not even once it has expired too');

SELECT is(
  public.renew_classified('00000000-0000-0000-0000-0000000083e3'),
  public.classified_expiry(now()),
  'the owner renews an expired ad by the same rule');
RESET ROLE;
SELECT is(
  (SELECT is_active::text || ' ' || (updated_at = now())::text
     FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000083e3'),
  'true true', 'the renewed ad is online again');
SELECT pg_temp.act_as_visitor();
SELECT is(pg_temp.visible_titles(), 'Online, Verlopen', 'and visitors see it again');
RESET ROLE;

-- A gevonden ad that expired: renewing puts it back online too.
UPDATE public.classifieds SET expires_at = now() - interval '1 day'
 WHERE id = '00000000-0000-0000-0000-0000000083e2';
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000083a');
SELECT lives_ok(
  $$SELECT public.renew_classified('00000000-0000-0000-0000-0000000083e2')$$,
  'the owner renews an expired ad they had marked gevonden');
RESET ROLE;
SELECT ok(
  (SELECT is_active FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000083e2'),
  'which puts it back online');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000083e');
SELECT throws_ok(
  $$SELECT public.renew_classified('00000000-0000-0000-0000-0000000083e5')$$,
  'VR005', NULL, 'a suspended user cannot renew');
RESET ROLE;
SELECT ok(
  (SELECT expires_at < now() FROM public.classifieds WHERE id = '00000000-0000-0000-0000-0000000083e5'),
  'and their ad stays expired');

SELECT set_config('request.jwt.claims', '', true);
SELECT throws_ok(
  $$SELECT public.renew_classified('00000000-0000-0000-0000-0000000083e3')$$,
  '42501', NULL, 'renewing needs a logged-in user');

SELECT * FROM finish();
ROLLBACK;
