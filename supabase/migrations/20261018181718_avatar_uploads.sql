-- Profile pictures are uploaded, not linked (#92, J-11).
--
-- A free-text avatar URL let anyone make every visitor of a page load an
-- image from their own server, which can track those visitors. Profiles now
-- store a path inside the public `avatars` bucket instead of a URL, so a
-- picture can only come from our own Storage. The app builds the URL.
--
-- Uploads go through the uploadAvatar server action, which re-encodes the
-- picture to a 400x400 WebP without metadata (no camera or location data).
-- The bucket only takes those files; the policies keep each user to their
-- own folder, named after their user id.

-- ------------------------------------------------------------- 1. bucket

-- Public: pictures are shown to logged-out visitors too. Upserted so a
-- bucket made by hand in the dashboard gets the same limits.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 1048576, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------- 2. policies

-- A public bucket serves its files without a SELECT policy. This one lets
-- users see their own files, which Storage needs to replace or delete them.
CREATE POLICY "Users read their own avatar files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "Users upload avatars to their own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "Users update their own avatar files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "Users delete their own avatar files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ------------------------------------------------------ 3. profiles column

-- Every existing value is an external URL (typed in, or Google's picture at
-- sign-up). They go: nobody has an uploaded picture yet.
ALTER TABLE public.profiles RENAME COLUMN avatar_url TO avatar_path;
UPDATE public.profiles SET avatar_path = NULL WHERE avatar_path IS NOT NULL;

-- Only a file in the user's own folder, with the name the server action
-- gives it. The column grants follow the rename.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_path_own_folder
  CHECK (
    avatar_path IS NULL
    OR avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.webp$')
  );

-- ---------------------------------------------- 4. functions that use it

-- Google sign-ups no longer copy Google's picture URL.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  chosen_username text := NEW.raw_user_meta_data->>'username';
  generated_username text;
  base_username text;
BEGIN
  IF chosen_username IS NOT NULL THEN
    -- Email sign-up: the form allows letters, digits and _ only.
    generated_username := lower(trim(chosen_username));
    IF generated_username !~ '^[a-z0-9_]{3,30}$' THEN
      RAISE EXCEPTION 'Invalid username'
        USING ERRCODE = 'VR012';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE lower(username) = generated_username
    ) THEN
      RAISE EXCEPTION 'Username already taken'
        USING ERRCODE = 'VR012';
    END IF;
  ELSE
    -- OAuth: generate one from the email address.
    base_username := split_part(NEW.email, '@', 1);

    -- Sanitise: lowercase, replace non-alphanumeric with underscore, trim underscores
    base_username := lower(regexp_replace(base_username, '[^a-zA-Z0-9_]', '_', 'g'));
    base_username := trim(BOTH '_' FROM base_username);

    -- Fallback if the result is empty
    IF base_username = '' OR base_username IS NULL THEN
      base_username := 'gebruiker';
    END IF;

    -- Ensure uniqueness by appending random suffix if needed
    generated_username := base_username;
    WHILE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE lower(username) = generated_username
    ) LOOP
      generated_username := base_username || '_' || substr(md5(random()::text), 1, 4);
    END LOOP;
  END IF;

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    generated_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', generated_username)
  );

  IF NEW.raw_user_meta_data->>'age_confirmed' = 'true'
     AND NEW.raw_user_meta_data->>'terms_accepted' = 'true' THEN
    INSERT INTO public.terms_acceptances (user_id, terms_version)
    VALUES (NEW.id, public.current_terms_version());
  END IF;

  RETURN NEW;
END;
$$;

-- Returns the old avatar path, so the caller can remove the file from
-- Storage (files aren't rows). Otherwise unchanged from #157.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_provider text;
  v_avatar_path text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not logged in'
      USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(u.raw_app_meta_data ->> 'provider',
                  u.raw_app_meta_data -> 'providers' ->> 0)
    INTO v_provider
    FROM auth.users AS u
   WHERE u.id = v_user_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT p.avatar_path INTO v_avatar_path
    FROM public.profiles AS p
   WHERE p.id = v_user_id;

  DELETE FROM public.rumours
   WHERE creator_id = v_user_id
     AND status IN ('pending', 'rejected');

  -- Everything else follows through the foreign keys (see #157).
  DELETE FROM auth.users WHERE id = v_user_id;

  -- A hash of the id only, no personal data: proof that a deletion happened.
  INSERT INTO public.deletion_audit_log (user_id_hash, auth_provider)
  VALUES (encode(sha256(convert_to(v_user_id::text, 'UTF8')), 'hex'),
          v_provider);

  RETURN v_avatar_path;
END;
$$;

-- The return columns are renamed, so these are dropped and made again.
DROP FUNCTION public.trusted_sources(integer);
CREATE FUNCTION public.trusted_sources(p_limit integer DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_path text,
  is_verified_source boolean,
  rumours_confirmed integer,
  rumours_denied integer
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT p.id, p.username, p.avatar_path, p.is_verified_source,
         p.rumours_confirmed, p.rumours_denied
    FROM public.profiles p
   WHERE p.rumours_confirmed + p.rumours_denied >= 5
   ORDER BY p.rumours_confirmed::numeric
              / (p.rumours_confirmed + p.rumours_denied) DESC,
            p.rumours_confirmed + p.rumours_denied DESC,
            p.username
   LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.trusted_sources(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trusted_sources(integer) TO anon, authenticated;

DROP FUNCTION public.staff_list_users(text, text);
CREATE FUNCTION public.staff_list_users(
  p_search text DEFAULT NULL,
  p_filter text DEFAULT 'all'
)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  created_at timestamptz,
  role text,
  is_verified_source boolean,
  is_suspended boolean,
  suspended_until timestamptz,
  suspension_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  search text := lower(NULLIF(btrim(p_search), ''));
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can list users' USING ERRCODE = '42501';
  END IF;
  IF p_filter IS NULL OR p_filter NOT IN ('all', 'suspended', 'staff', 'verified') THEN
    RAISE EXCEPTION 'invalid filter' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
    SELECT p.id, p.username, p.display_name, p.avatar_path, p.created_at,
           p.role, p.is_verified_source,
           s.user_id IS NOT NULL, s.suspended_until, s.reason
      FROM public.profiles p
      LEFT JOIN public.user_suspensions s
        ON s.user_id = p.id
       AND (s.suspended_until IS NULL OR s.suspended_until > now())
     WHERE (search IS NULL
            OR strpos(lower(p.username), search) > 0
            OR strpos(lower(COALESCE(p.display_name, '')), search) > 0)
       AND CASE p_filter
             WHEN 'suspended' THEN s.user_id IS NOT NULL
             WHEN 'staff' THEN p.role IN ('moderator', 'admin')
             WHEN 'verified' THEN p.is_verified_source
             ELSE true
           END
     ORDER BY lower(p.username)
     LIMIT 100;
END;
$$;

DROP FUNCTION public.staff_get_user(uuid);
CREATE FUNCTION public.staff_get_user(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  created_at timestamptz,
  role text,
  is_verified_source boolean,
  is_suspended boolean,
  suspended_until timestamptz,
  suspension_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can look up users' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT p.id, p.username, p.display_name, p.avatar_path, p.created_at,
           p.role, p.is_verified_source,
           s.user_id IS NOT NULL, s.suspended_until, s.reason
      FROM public.profiles p
      LEFT JOIN public.user_suspensions s
        ON s.user_id = p.id
       AND (s.suspended_until IS NULL OR s.suspended_until > now())
     WHERE p.id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.staff_list_users(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.staff_get_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_list_users(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_get_user(uuid) TO authenticated;
