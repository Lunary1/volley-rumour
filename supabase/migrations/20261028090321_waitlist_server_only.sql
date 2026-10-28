-- Waitlist sign-ups go through the server, with a rate limit (GHSA-9v4r).
--
--   visitor ──subscribeToWaitlist()──→ subscribe_to_waitlist(email, ip_hash)
--
-- Until now the browser could insert rows straight through the API: any
-- string, any number of rows, with its own source and date. The server
-- action now calls subscribe_to_waitlist() with the service role and the
-- daily IP hash, like the contact form (submit_contact_message).
--
-- Expand first (D-043): the code on main still inserts the email itself, so
-- this migration keeps that working but narrows it to the email column and
-- a valid address. A later migration removes the direct insert and its
-- policy once this code is live.
--
-- Undo: DROP FUNCTION public.subscribe_to_waitlist(text, text);
--       ALTER TABLE public.waitlist_subscribers DROP CONSTRAINT waitlist_subscribers_email_check;
--       GRANT ALL ON public.waitlist_subscribers TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Valid addresses only
-- ---------------------------------------------------------------------------
-- Looser than the form's check, so every address it ever accepted passes.
ALTER TABLE public.waitlist_subscribers
  ADD CONSTRAINT waitlist_subscribers_email_check
  CHECK (char_length(email) <= 254 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  NOT VALID;
ALTER TABLE public.waitlist_subscribers
  VALIDATE CONSTRAINT waitlist_subscribers_email_check;

-- ---------------------------------------------------------------------------
-- The API may only insert an email (until the follow-up removes that too)
-- ---------------------------------------------------------------------------
-- Source, date and IP hash are no longer the caller's to set, and nobody
-- reads, changes or deletes rows through the API (RLS already refused that).
REVOKE ALL ON public.waitlist_subscribers FROM anon, authenticated;
GRANT INSERT (email) ON public.waitlist_subscribers TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Subscribe
-- ---------------------------------------------------------------------------
-- Called by the server action with the service role. Errors:
--   22023  not a valid email address
--   VR002  too many sign-ups from this IP address today (10)
-- An address that is already on the list (in any case) succeeds silently,
-- so the form doesn't reveal who signed up.
CREATE FUNCTION public.subscribe_to_waitlist(p_email text, p_ip_hash text)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_email text := btrim(p_email);
BEGIN
  IF v_email IS NULL OR char_length(v_email) > 254
     OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid email address' USING ERRCODE = '22023';
  END IF;

  -- Parallel sign-ups from one IP wait for each other, so they can't slip
  -- past the limit together.
  PERFORM pg_advisory_xact_lock(hashtextextended('waitlist_ip:' || COALESCE(p_ip_hash, ''), 0));

  IF EXISTS (
    SELECT 1 FROM public.waitlist_subscribers w WHERE lower(w.email) = lower(v_email)
  ) THEN
    RETURN;
  END IF;

  -- A club's wifi can carry a few teammates, so the limit isn't tight.
  IF p_ip_hash IS NOT NULL AND (
    SELECT count(*) FROM public.waitlist_subscribers w
     WHERE w.ip_hash = p_ip_hash AND w.subscribed_at > now() - interval '24 hours'
  ) >= 10 THEN
    RAISE EXCEPTION 'too many sign-ups from this address' USING ERRCODE = 'VR002';
  END IF;

  INSERT INTO public.waitlist_subscribers (email, ip_hash)
  VALUES (v_email, p_ip_hash)
  ON CONFLICT ON CONSTRAINT waitlist_subscribers_email_key DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.subscribe_to_waitlist(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.subscribe_to_waitlist(text, text)
  TO service_role;
