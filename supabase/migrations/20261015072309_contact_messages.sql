-- Contact messages: the contact form stores what visitors send, and staff read
-- and handle it at /admin/contact (issue #81, D-017). Until now the form only
-- logged the submission on the server and reached nobody.
--
--   visitor ──submit_contact_message()──→ open ──handle_contact_message()──→ handled
--
-- Staff answer by email, by hand; there is no automatic email yet (#53).
-- Messages hold personal data (name, email, message). Only staff read them,
-- never the IP hash, and anonymise_expired_contact_messages() wipes the
-- personal fields 12 months after a message was handled (D-017).
--
-- Suspended users can still write: the contact form is how they appeal (D-016,
-- D-017). Messages come in through the service role, so the
-- check_account_not_suspended trigger isn't added here.

-- ---------------------------------------------------------------------------
-- New audit log entries
-- ---------------------------------------------------------------------------
ALTER TABLE public.staff_actions DROP CONSTRAINT staff_actions_action_check;
ALTER TABLE public.staff_actions ADD CONSTRAINT staff_actions_action_check
  CHECK (action IN (
    'rumour_approved',
    'rumour_rejected',
    'rumour_resolved',
    'content_removed',
    'takedown_rejected',
    'report_dismissed',
    'report_action_taken',
    'conversation_viewed',
    'user_suspended',
    'user_unsuspended',
    'role_changed',
    'badge_granted',
    'badge_revoked',
    'contact_handled'
  ));
ALTER TABLE public.staff_actions DROP CONSTRAINT staff_actions_target_type_check;
ALTER TABLE public.staff_actions ADD CONSTRAINT staff_actions_target_type_check
  CHECK (target_type IN (
    'rumour',
    'classified',
    'conversation',
    'message',
    'user',
    'takedown_request',
    'contact_message'
  ));

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Keep in sync with CONTACT_CATEGORIES in lib/contact.ts.
  category text NOT NULL CHECK (category IN ('question', 'account', 'privacy', 'partnership', 'other')),
  sender_name text CHECK (char_length(sender_name) BETWEEN 2 AND 100),
  sender_email text CHECK (char_length(sender_email) BETWEEN 3 AND 254),
  message text CHECK (char_length(message) BETWEEN 10 AND 5000),
  -- The account that sent it, if the sender was logged in. Staff see who
  -- appeals a suspension. Null once the account is deleted.
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  -- HMAC of the IP address with a key that changes daily, for the rate limit
  -- only (as takedown_requests).
  ip_hash text CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'handled')),
  -- An internal note from staff, e.g. "beantwoord per mail". Never shown to
  -- the sender.
  handled_note text CHECK (char_length(handled_note) <= 500),
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  anonymised_at timestamptz,
  CONSTRAINT contact_messages_personal_data CHECK (
    anonymised_at IS NOT NULL
    OR (sender_name IS NOT NULL AND sender_email IS NOT NULL AND message IS NOT NULL)
  ),
  CONSTRAINT contact_messages_handled CHECK ((status = 'open') = (handled_at IS NULL))
);

COMMENT ON TABLE public.contact_messages IS
  'Messages sent through the contact form (#81, D-017). Staff read; personal fields wiped 12 months after handling.';

CREATE INDEX contact_messages_status_idx ON public.contact_messages (status, created_at);
CREATE INDEX contact_messages_ip_idx ON public.contact_messages (ip_hash, created_at);
CREATE INDEX contact_messages_email_idx ON public.contact_messages (lower(sender_email), created_at);
CREATE INDEX contact_messages_user_idx ON public.contact_messages (user_id);

-- Staff read everything except the IP hash; nobody writes through the API.
-- Messages come in through the server (service role) and are handled through
-- the function below.
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.contact_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.contact_messages TO service_role;
GRANT SELECT (
  id, category, sender_name, sender_email, message, user_id, status,
  handled_note, handled_at, created_at, anonymised_at
) ON public.contact_messages TO authenticated;

CREATE POLICY "Staff can read contact messages" ON public.contact_messages
  FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

-- ---------------------------------------------------------------------------
-- Submit (server only)
-- ---------------------------------------------------------------------------
-- Called by the submitContactMessage server action with the service role,
-- because the IP hash and the account come from the server, not from the
-- visitor. Keep the limits in sync with CONTACT_LIMITS in lib/contact.ts.
--
--   VR002  too many messages from this IP today (5) or this email (3)
CREATE FUNCTION public.submit_contact_message(
  p_category text,
  p_name text,
  p_email text,
  p_message text,
  p_user_id uuid,
  p_ip_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  email text := lower(btrim(p_email));
  new_id uuid;
BEGIN
  -- Parallel submits from one IP or email wait for each other, so they can't
  -- slip past the limits together. Always IP first, then email: no deadlocks.
  PERFORM pg_advisory_xact_lock(hashtextextended('contact_ip:' || COALESCE(p_ip_hash, ''), 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('contact_email:' || email, 0));

  IF p_ip_hash IS NOT NULL AND (
    SELECT count(*) FROM public.contact_messages
     WHERE ip_hash = p_ip_hash AND created_at > now() - interval '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION 'too many contact messages from this address' USING ERRCODE = 'VR002';
  END IF;

  IF (
    SELECT count(*) FROM public.contact_messages
     WHERE lower(sender_email) = email AND created_at > now() - interval '24 hours'
  ) >= 3 THEN
    RAISE EXCEPTION 'too many contact messages from this email' USING ERRCODE = 'VR002';
  END IF;

  INSERT INTO public.contact_messages (
    category, sender_name, sender_email, message, user_id, ip_hash
  ) VALUES (
    p_category, btrim(p_name), btrim(p_email), btrim(p_message), p_user_id, p_ip_hash
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_contact_message(text, text, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contact_message(text, text, text, text, uuid, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Handle
-- ---------------------------------------------------------------------------
-- Marks an open message as handled, with an optional internal note, in one
-- transaction with the log entry.
CREATE FUNCTION public.handle_contact_message(
  p_message_id uuid,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  note text := NULLIF(btrim(p_note), '');
  msg_category text;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can handle contact messages'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.contact_messages
     SET status = 'handled', handled_note = note, handled_at = now()
   WHERE id = p_message_id AND status = 'open'
  RETURNING category INTO msg_category;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact message is not open' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.log_staff_action(
    'contact_handled',
    'contact_message',
    p_message_id,
    note,
    jsonb_build_object('category', msg_category)
  );
END;
$$;

-- Server actions call this with the staff member's session; the function
-- checks staff itself.
REVOKE EXECUTE ON FUNCTION public.handle_contact_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_contact_message(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Retention (D-017)
-- ---------------------------------------------------------------------------
-- Wipes name, email, message, account link and IP hash of messages handled
-- more than 12 months ago and returns how many. Category, status and dates
-- stay for the counts. Open messages are never wiped. Service role only; to
-- be scheduled before the first messages expire (October 2027).
CREATE FUNCTION public.anonymise_expired_contact_messages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  anonymised integer;
BEGIN
  UPDATE public.contact_messages
     SET sender_name = NULL,
         sender_email = NULL,
         message = NULL,
         user_id = NULL,
         ip_hash = NULL,
         handled_note = NULL,
         anonymised_at = now()
   WHERE anonymised_at IS NULL
     AND status = 'handled'
     AND handled_at < now() - interval '12 months';
  GET DIAGNOSTICS anonymised = ROW_COUNT;
  RETURN anonymised;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.anonymise_expired_contact_messages() FROM PUBLIC, anon, authenticated;
