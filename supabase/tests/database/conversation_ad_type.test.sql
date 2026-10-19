-- Only zoekertjes start conversations: `transfer_talk` is gone (issue #152,
-- D-004). Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

-- a posts the ad, b contacts a, c is someone else.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000152a', 'ct152_a@example.test', '{"username": "ct152_poster"}'),
  ('00000000-0000-0000-0000-00000000152b', 'ct152_b@example.test', '{"username": "ct152_contact"}'),
  ('00000000-0000-0000-0000-00000000152c', 'ct152_c@example.test', '{"username": "ct152_other"}');

INSERT INTO public.classifieds (id, user_id, type, title, contact_name) VALUES
  ('00000000-0000-0000-0000-0000000152e1', '00000000-0000-0000-0000-00000000152a',
   'team_seeks_player', 'Online', 'VC A');

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000152b');

-- Before #152 this went through: the contact check only looked at
-- `classified` rows.
SELECT throws_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    VALUES (gen_random_uuid(), 'transfer_talk',
            '00000000-0000-0000-0000-00000000152b', '00000000-0000-0000-0000-00000000152c')$$,
  'VR011', NULL, 'transfer_talk does not open a conversation with anyone about anything');
SELECT throws_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    VALUES ('00000000-0000-0000-0000-0000000152e1', 'transfer_talk',
            '00000000-0000-0000-0000-00000000152b', '00000000-0000-0000-0000-00000000152a')$$,
  '23514', NULL, 'nor about an online zoekertje');
SELECT lives_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    VALUES ('00000000-0000-0000-0000-0000000152e1', 'classified',
            '00000000-0000-0000-0000-00000000152b', '00000000-0000-0000-0000-00000000152a')$$,
  'a zoekertje still starts a conversation');
RESET ROLE;

SELECT throws_ok(
  $$INSERT INTO public.conversations (ad_id, ad_type, initiator_id, recipient_id)
    VALUES ('00000000-0000-0000-0000-0000000152e1', 'transfer_talk',
            '00000000-0000-0000-0000-00000000152c', '00000000-0000-0000-0000-00000000152a')$$,
  '23514', NULL, 'not even outside the API');
SELECT is(
  (SELECT count(*)::int FROM public.conversations WHERE ad_type <> 'classified'),
  0, 'every conversation is about a zoekertje');

SELECT * FROM finish();
ROLLBACK;
