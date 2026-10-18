-- Profile pictures (issue #92, J-11): profiles store a path in the public
-- `avatars` bucket, never a URL, and only into the user's own folder. Each
-- user may only write files in their own folder. Google sign-ups no longer
-- copy Google's picture. Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;
CREATE FUNCTION pg_temp.rows_changed(stmt text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
CREATE FUNCTION pg_temp.returns_avatar_path(fn text) RETURNS boolean LANGUAGE sql AS $$
  SELECT 'avatar_path' = ANY (p.proargnames)
    FROM pg_proc p WHERE p.oid = fn::regprocedure;
$$;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000092a', 'av_anna@example.test',
   '{"provider": "email", "providers": ["email"]}', '{"username": "av_anna"}'),
  ('00000000-0000-0000-0000-00000000092b', 'av_bert@example.test',
   '{"provider": "email", "providers": ["email"]}', '{"username": "av_bert"}'),
  ('00000000-0000-0000-0000-00000000092c', 'av_google@example.test',
   '{"provider": "google", "providers": ["google"]}',
   '{"full_name": "Gi Google", "avatar_url": "https://lh3.googleusercontent.com/a/tracker"}');

-- ------------------------------------------------------------------ bucket
SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'avatars'),
  true,
  'the avatars bucket exists and is public'
);
SELECT is(
  (SELECT file_size_limit FROM storage.buckets WHERE id = 'avatars'),
  1048576::bigint,
  'it takes files up to 1 MB'
);
SELECT is(
  (SELECT allowed_mime_types FROM storage.buckets WHERE id = 'avatars'),
  ARRAY['image/webp'],
  'and only WebP, which the server makes'
);

-- ----------------------------------------------------------------- column
SELECT hasnt_column('public', 'profiles', 'avatar_url',
  'profiles no longer store an avatar URL');
SELECT is(
  (SELECT avatar_path FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000092c'),
  NULL,
  'a Google sign-up does not copy Google''s picture'
);

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000092a');

SELECT lives_ok(
  $$ UPDATE public.profiles
        SET avatar_path = '00000000-0000-0000-0000-00000000092a/3f2b8c1e-9d4a-4e6f-8a7b-1c2d3e4f5a6b.webp'
      WHERE id = '00000000-0000-0000-0000-00000000092a' $$,
  'a user can point to a picture in their own folder'
);
SELECT throws_ok(
  $$ UPDATE public.profiles
        SET avatar_path = 'https://tracker.example/pixel.gif'
      WHERE id = '00000000-0000-0000-0000-00000000092a' $$,
  '23514', NULL,
  'but not to an outside URL'
);
SELECT throws_ok(
  $$ UPDATE public.profiles
        SET avatar_path = '00000000-0000-0000-0000-00000000092b/3f2b8c1e-9d4a-4e6f-8a7b-1c2d3e4f5a6b.webp'
      WHERE id = '00000000-0000-0000-0000-00000000092a' $$,
  '23514', NULL,
  'nor to someone else''s folder'
);
SELECT throws_ok(
  $$ UPDATE public.profiles
        SET avatar_path = '00000000-0000-0000-0000-00000000092a/../x.webp'
      WHERE id = '00000000-0000-0000-0000-00000000092a' $$,
  '23514', NULL,
  'nor to any other name'
);

-- ---------------------------------------------------------------- storage
SELECT lives_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner_id)
     VALUES ('avatars', '00000000-0000-0000-0000-00000000092a/eigen.webp',
             '00000000-0000-0000-0000-00000000092a') $$,
  'a user can store a file in their own folder'
);
SELECT throws_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner_id)
     VALUES ('avatars', '00000000-0000-0000-0000-00000000092b/vreemd.webp',
             '00000000-0000-0000-0000-00000000092a') $$,
  '42501', NULL,
  'but not in someone else''s'
);
SELECT throws_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner_id)
     VALUES ('avatars', 'los.webp', '00000000-0000-0000-0000-00000000092a') $$,
  '42501', NULL,
  'nor outside any folder'
);
RESET ROLE;

INSERT INTO storage.objects (bucket_id, name, owner_id)
VALUES ('avatars', '00000000-0000-0000-0000-00000000092b/bert.webp',
        '00000000-0000-0000-0000-00000000092b');

SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000092a');
SELECT is(
  pg_temp.rows_changed($$ UPDATE storage.objects SET name = '00000000-0000-0000-0000-00000000092a/gestolen.webp'
                           WHERE name = '00000000-0000-0000-0000-00000000092b/bert.webp' $$),
  0,
  'a user cannot take over someone else''s file'
);
SELECT is(
  (SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'avatars'),
  1,
  'and only sees their own files through the API'
);
RESET ROLE;

-- Everyone, logged in or not, reads the path to build the picture's URL.
SET LOCAL ROLE anon;
SELECT is(
  (SELECT avatar_path FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000092a'),
  '00000000-0000-0000-0000-00000000092a/3f2b8c1e-9d4a-4e6f-8a7b-1c2d3e4f5a6b.webp',
  'visitors read the avatar path'
);
RESET ROLE;

-- --------------------------------------------------------------- deletion
SELECT pg_temp.act_as('00000000-0000-0000-0000-00000000092a');
SELECT is(
  public.delete_own_account(),
  '00000000-0000-0000-0000-00000000092a/3f2b8c1e-9d4a-4e6f-8a7b-1c2d3e4f5a6b.webp',
  'deleting the account returns the path, so the app removes the file'
);
RESET ROLE;

SELECT ok(
  pg_temp.returns_avatar_path('public.trusted_sources(integer)'),
  'trusted_sources() returns avatar_path'
);
SELECT ok(
  pg_temp.returns_avatar_path('public.staff_get_user(uuid)')
  AND pg_temp.returns_avatar_path('public.staff_list_users(text, text)'),
  'so do the staff user lookups'
);

SELECT * FROM finish();
ROLLBACK;
