-- Account deletion is all-or-nothing (issue #76, J-11, D-021).
--
-- deleteAccount used to run about 11 service-role writes in a row; if a later
-- one failed, earlier data was already gone (e.g. the profile deleted, the
-- auth user left behind). It is now one database function, so the whole
-- deletion commits or nothing does.
--
-- What goes, through the foreign keys from auth.users → profiles:
--   deleted   profile, zoekertjes (D-021), votes, blocks (both directions),
--             conversations with all their messages and archive rows,
--             suspension
--   kept      published rumours, without an author (creator_id SET NULL);
--             reports and contact messages, without the user (SET NULL);
--             the staff log (no foreign key, kept 2 years, D-011)
-- Rumours that never went public (pending, rejected) are deleted (owner,
-- 2026-10-18).

-- ------------------------------------------------- 1. rumours stay public

-- Was CASCADE: deleting a user anywhere (also in the dashboard) took their
-- published rumours with them.
ALTER TABLE public.rumours
  DROP CONSTRAINT rumours_creator_id_fkey,
  ADD CONSTRAINT rumours_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES public.profiles (id) ON DELETE SET NULL;

-- ---------------------------------------------------- 2. no orphaned ads

-- Accounts deleted before D-021 left their zoekertjes online without an
-- owner, often with the poster's name in the title. The owner chose to delete
-- them (2026-10-18). Conversations about them stay and show "Verwijderd
-- zoekertje"; reports about them go with them.
DELETE FROM public.classifieds WHERE user_id IS NULL;

-- From now on a zoekertje always has an owner, and goes when they do.
ALTER TABLE public.classifieds ALTER COLUMN user_id SET NOT NULL;

-- ------------------------------------------------------ 3. the function

-- Deletes the caller's own account. Returns the old avatar URL, so the
-- caller can remove a file it pointed at in Storage (files aren't rows).
-- Runs as its owner: users can't delete auth.users or write the audit log.
CREATE FUNCTION public.delete_own_account()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_provider text;
  v_avatar_url text;
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

  SELECT p.avatar_url INTO v_avatar_url
    FROM public.profiles AS p
   WHERE p.id = v_user_id;

  DELETE FROM public.rumours
   WHERE creator_id = v_user_id
     AND status IN ('pending', 'rejected');

  -- Everything else follows through the foreign keys (see the top).
  DELETE FROM auth.users WHERE id = v_user_id;

  -- A hash of the id only, no personal data: proof that a deletion happened.
  INSERT INTO public.deletion_audit_log (user_id_hash, auth_provider)
  VALUES (encode(sha256(convert_to(v_user_id::text, 'UTF8')), 'hex'),
          v_provider);

  RETURN v_avatar_url;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- ------------------------------------------------------ 4. the audit log

-- RLS without policies already kept the API out; the baseline's grants to
-- anon and authenticated were never needed.
REVOKE ALL ON TABLE public.deletion_audit_log FROM anon, authenticated;
