-- Migration: Update handle_new_user trigger to support OAuth sign-ups (KAN-50)
--
-- Problem: Google OAuth users don't have `username` in raw_user_meta_data,
-- causing profile creation to fail (username NOT NULL constraint).
--
-- Solution: Auto-generate username from Google display name or email prefix,
-- with a random suffix if a collision occurs. Also sync avatar_url and display_name.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger if it doesn't already exist.
-- DROP + CREATE to ensure latest version is applied.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
