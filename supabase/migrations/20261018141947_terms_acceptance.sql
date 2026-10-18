-- #75 (D-003): every user confirms they are 16 or older and accepts the terms
-- before they use the site. Email sign-up asks it on the form; Google users
-- and accounts from before this migration are asked once, on /welkom, the
-- next time they come in (the proxy sends them there).
--
-- One row per user and terms version: when the user accepted, and which
-- version. Accepting always includes the 16+ confirmation, because the form
-- asks both together. A new terms version asks everyone again.

-- ---------------------------------------------------------------------------
-- The current terms version
-- ---------------------------------------------------------------------------
-- The date on /voorwaarden. Change both together, in a new migration, when
-- the terms change.
CREATE FUNCTION public.current_terms_version()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT '2026-10-18'
$$;

REVOKE EXECUTE ON FUNCTION public.current_terms_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_terms_version() TO authenticated;

-- ---------------------------------------------------------------------------
-- Acceptances
-- ---------------------------------------------------------------------------
-- Belongs to the account, not the profile, and is deleted with it. Users read their own rows; nobody writes them
-- through the API (accept_terms() and the sign-up trigger do).
CREATE TABLE public.terms_acceptances (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, terms_version)
);

COMMENT ON TABLE public.terms_acceptances IS
  'The user confirmed being 16 or older and accepted this terms version (#75, D-003).';

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.terms_acceptances FROM anon, authenticated;
GRANT SELECT ON public.terms_acceptances TO authenticated;

CREATE POLICY "Users read their own acceptances" ON public.terms_acceptances
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- Has the caller accepted the current version?
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: RLS lets the caller read their own rows.
CREATE FUNCTION public.has_accepted_terms()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.terms_acceptances
    WHERE user_id = (SELECT auth.uid())
      AND terms_version = public.current_terms_version()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_accepted_terms() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_accepted_terms() TO authenticated;

-- ---------------------------------------------------------------------------
-- Accept the current version (from /welkom)
-- ---------------------------------------------------------------------------
-- The version and the time come from the database, not the caller. Accepting
-- twice keeps the first row. Suspended users may accept too: it isn't content.
CREATE FUNCTION public.accept_terms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not logged in'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.terms_acceptances (user_id, terms_version)
  VALUES ((SELECT auth.uid()), public.current_terms_version())
  ON CONFLICT (user_id, terms_version) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_terms() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_terms() TO authenticated;

-- ---------------------------------------------------------------------------
-- Email sign-up records the acceptance with the account
-- ---------------------------------------------------------------------------
-- The sign-up form sends both checkboxes as user metadata. Without both (a
-- Google sign-up, or a sign-up through the API that skips the form) no row is
-- made, and /welkom asks. Unchanged from the baseline apart from that.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  generated_username text;
  base_username text;
BEGIN
  -- Get username from metadata (email/password signup) or generate from email (OAuth)
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );

  -- Sanitise: lowercase, replace non-alphanumeric with underscore, trim underscores
  base_username := lower(regexp_replace(base_username, '[^a-zA-Z0-9_]', '_', 'g'));
  base_username := trim(BOTH '_' FROM base_username);

  -- Fallback if the result is empty
  IF base_username = '' OR base_username IS NULL THEN
    base_username := 'gebruiker';
  END IF;

  -- Ensure uniqueness by appending random suffix if needed
  generated_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = generated_username) LOOP
    generated_username := base_username || '_' || substr(md5(random()::text), 1, 4);
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    generated_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', generated_username),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  IF NEW.raw_user_meta_data->>'age_confirmed' = 'true'
     AND NEW.raw_user_meta_data->>'terms_accepted' = 'true' THEN
    INSERT INTO public.terms_acceptances (user_id, terms_version)
    VALUES (NEW.id, public.current_terms_version());
  END IF;

  RETURN NEW;
END;
$$;
