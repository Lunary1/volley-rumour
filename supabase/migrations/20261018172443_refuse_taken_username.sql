-- #89: a username chosen on the sign-up form is taken or refused, never
-- quietly changed.
--
-- Until now the sign-up trigger appended a random suffix to a taken username,
-- so "jan" silently became "jan_ab12". The sign-up server action checks first
-- and shows "Deze gebruikersnaam bestaat al"; this trigger is the backstop for
-- two sign-ups racing for the same name. It refuses with SQLSTATE VR012, which
-- rolls back the whole sign-up (Supabase Auth reports a generic database
-- error, and the action checks the name again to say why).
--
-- The check ignores case, so "Jan" and "jan" can't both exist through
-- sign-up. Google sign-ups don't choose a username: theirs comes from the
-- email address and still gets a suffix when taken. Everything else is
-- unchanged from 20261018141947_terms_acceptance.sql.

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
