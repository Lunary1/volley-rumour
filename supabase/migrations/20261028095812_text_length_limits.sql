-- Length limits on text users write (GHSA-fjw6). The forms cap these with
-- zod (lib/schemas.ts), but the API writes the tables directly, so the
-- database enforces the same limits. Each check is added NOT VALID and then
-- validated; the owner checked production first and found no row over a limit
-- (2026-10-28).

-- ------------------------------------------------------------- classifieds
-- The title is a name (100 + 1 + 100) or a team name (200) plus "zoekt een
-- middenaanvaller"; the contact name is one of the two.
ALTER TABLE public.classifieds
  ADD CONSTRAINT classifieds_title_length CHECK (char_length(title) <= 250) NOT VALID,
  ADD CONSTRAINT classifieds_contact_name_length CHECK (char_length(contact_name) <= 250) NOT VALID,
  ADD CONSTRAINT classifieds_team_name_length CHECK (char_length(team_name) <= 200) NOT VALID,
  ADD CONSTRAINT classifieds_description_length CHECK (char_length(description) <= 2000) NOT VALID,
  -- POSITION_LABELS and PROVINCE_LABELS in lib/classifieds-utils.ts.
  ADD CONSTRAINT classifieds_position_check CHECK (position = ANY (ARRAY[
    'setter', 'libero', 'receptiehoek', 'middenaanvaller', 'opposite'
  ])) NOT VALID,
  ADD CONSTRAINT classifieds_province_check CHECK (province = ANY (ARRAY[
    'antwerpen', 'limburg', 'oost_vlaanderen', 'vlaams_brabant',
    'west_vlaanderen', 'henegouwen', 'waals_brabant', 'namen', 'luik',
    'luxemburg', 'frankrijk', 'zwitserland', 'turkije', 'nederland'
  ])) NOT VALID;

ALTER TABLE public.classifieds VALIDATE CONSTRAINT classifieds_title_length;
ALTER TABLE public.classifieds VALIDATE CONSTRAINT classifieds_contact_name_length;
ALTER TABLE public.classifieds VALIDATE CONSTRAINT classifieds_team_name_length;
ALTER TABLE public.classifieds VALIDATE CONSTRAINT classifieds_description_length;
ALTER TABLE public.classifieds VALIDATE CONSTRAINT classifieds_position_check;
ALTER TABLE public.classifieds VALIDATE CONSTRAINT classifieds_province_check;

-- ---------------------------------------------------------------- messages
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_length CHECK (char_length(content) <= 5000) NOT VALID,
  -- An email address and a phone number, no more.
  ADD CONSTRAINT messages_contact_shared_size CHECK (
    jsonb_typeof(contact_shared) = 'object'
    AND char_length(contact_shared::text) <= 500
  ) NOT VALID;

ALTER TABLE public.messages VALIDATE CONSTRAINT messages_content_length;
ALTER TABLE public.messages VALIDATE CONSTRAINT messages_contact_shared_size;

-- ---------------------------------------------------------------- profiles
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_length CHECK (char_length(username) <= 30) NOT VALID,
  ADD CONSTRAINT profiles_display_name_length CHECK (char_length(display_name) <= 100) NOT VALID;

ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_username_length;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_display_name_length;

-- ----------------------------------------------------------------- rumours
-- The player's name is first + " " + last name, 100 each.
ALTER TABLE public.rumours
  ADD CONSTRAINT rumours_player_name_length CHECK (char_length(player_name) <= 201) NOT VALID,
  ADD CONSTRAINT rumours_from_club_name_length CHECK (char_length(from_club_name) <= 200) NOT VALID,
  ADD CONSTRAINT rumours_to_club_name_length CHECK (char_length(to_club_name) <= 200) NOT VALID,
  ADD CONSTRAINT rumours_description_length CHECK (char_length(description) <= 2000) NOT VALID;

ALTER TABLE public.rumours VALIDATE CONSTRAINT rumours_player_name_length;
ALTER TABLE public.rumours VALIDATE CONSTRAINT rumours_from_club_name_length;
ALTER TABLE public.rumours VALIDATE CONSTRAINT rumours_to_club_name_length;
ALTER TABLE public.rumours VALIDATE CONSTRAINT rumours_description_length;

-- ------------------------------------------------------- sign-up trigger
-- Google sign-ups get a username from the email address and the display name
-- from Google: both are shortened to fit the limits above, so a long address
-- or name still signs up. Otherwise unchanged from 20261018181718.
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
    -- 25 characters leave room for the "_abcd" suffix within 30.
    base_username := trim(BOTH '_' FROM left(base_username, 25));

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
    left(COALESCE(NEW.raw_user_meta_data->>'full_name', generated_username), 100)
  );

  IF NEW.raw_user_meta_data->>'age_confirmed' = 'true'
     AND NEW.raw_user_meta_data->>'terms_accepted' = 'true' THEN
    INSERT INTO public.terms_acceptances (user_id, terms_version)
    VALUES (NEW.id, public.current_terms_version());
  END IF;

  RETURN NEW;
END;
$$;
