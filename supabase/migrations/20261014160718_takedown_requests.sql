-- Takedown requests: a person named in a rumour asks for its removal, without
-- an account (issue #68, J-12, D-014).
--
--   visitor ──submit_takedown_request()──→ open
--                                          ├─remove_rumour_for_takedown()─→ removed (rumour → removed)
--                                          └─reject_takedown_request()────→ rejected (rumour stays)
--
-- The rumour stays visible until a moderator decides (D-014). The requester
-- follows the request through a private status link: the app keeps the token,
-- the database only its SHA-256 hash. There is no email yet (#53).
--
-- Requests hold personal data of people who are often not users (name, email,
-- explanation). Only staff can read them, never the token or IP hashes, and
-- anonymise_expired_takedown_requests() wipes the personal fields 12 months
-- after the request (D-014).

-- ---------------------------------------------------------------------------
-- Rumour status 'removed'
-- ---------------------------------------------------------------------------
-- Removed rumours drop out of every public view: the SELECT policy only shows
-- rumour, confirmed and denied to everyone (#65). The author still sees it on
-- their profile, so they know it was removed; staff see it in the inbox.
ALTER TABLE public.rumours DROP CONSTRAINT rumours_status_check;
ALTER TABLE public.rumours ADD CONSTRAINT rumours_status_check
  CHECK (status IN ('pending', 'rumour', 'confirmed', 'denied', 'rejected', 'removed'));

-- ---------------------------------------------------------------------------
-- New audit log entries
-- ---------------------------------------------------------------------------
-- Removing the rumour is logged as content_removed on the rumour; rejecting a
-- request has its own action on the request.
ALTER TABLE public.staff_actions DROP CONSTRAINT staff_actions_action_check;
ALTER TABLE public.staff_actions ADD CONSTRAINT staff_actions_action_check
  CHECK (action IN (
    'rumour_approved',
    'rumour_rejected',
    'rumour_resolved',
    'content_removed',
    'takedown_rejected',
    'user_suspended',
    'user_unsuspended',
    'role_changed'
  ));
ALTER TABLE public.staff_actions DROP CONSTRAINT staff_actions_target_type_check;
ALTER TABLE public.staff_actions ADD CONSTRAINT staff_actions_target_type_check
  CHECK (target_type IN (
    'rumour',
    'classified',
    'conversation',
    'message',
    'user',
    'takedown_request'
  ));

-- ---------------------------------------------------------------------------
-- Requests
-- ---------------------------------------------------------------------------
-- The app never deletes rumours (removing one sets status 'removed'), so the
-- cascade only fires when someone deletes a rumour by hand in the dashboard.
CREATE TABLE public.takedown_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What the requester quotes, e.g. VR-7K3M9Q. Not secret.
  reference text NOT NULL UNIQUE CHECK (reference ~ '^VR-[2-9A-Z]{6}$'),
  -- SHA-256 of the status link's token.
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  rumour_id uuid NOT NULL REFERENCES public.rumours (id) ON DELETE CASCADE,
  -- Who asks: the person themselves, a parent, or a representative (agent,
  -- club). Keep in sync with TAKEDOWN_RELATIONS in lib/takedown.ts.
  relation text NOT NULL CHECK (relation IN ('self', 'parent', 'representative')),
  requester_name text CHECK (char_length(requester_name) BETWEEN 2 AND 100),
  requester_email text CHECK (char_length(requester_email) BETWEEN 3 AND 254),
  explanation text CHECK (char_length(explanation) BETWEEN 10 AND 2000),
  -- HMAC of the IP address with a key that changes daily, for the rate limit
  -- only: hashes from different days can't be linked.
  ip_hash text CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'removed', 'rejected')),
  -- The moderator's words to the requester, shown on the status page.
  decision_note text CHECK (char_length(decision_note) <= 500),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  anonymised_at timestamptz,
  CONSTRAINT takedown_requests_personal_data CHECK (
    anonymised_at IS NOT NULL
    OR (requester_name IS NOT NULL AND requester_email IS NOT NULL AND explanation IS NOT NULL)
  ),
  CONSTRAINT takedown_requests_decided CHECK ((status = 'open') = (decided_at IS NULL)),
  CONSTRAINT takedown_requests_rejection_note CHECK (status <> 'rejected' OR decision_note IS NOT NULL)
);

COMMENT ON TABLE public.takedown_requests IS
  'Requests to remove a rumour, from the person it is about (#68, D-014). Staff read; personal fields wiped after 12 months.';

CREATE INDEX takedown_requests_status_idx ON public.takedown_requests (status, created_at);
CREATE INDEX takedown_requests_rumour_idx ON public.takedown_requests (rumour_id);
CREATE INDEX takedown_requests_ip_idx ON public.takedown_requests (ip_hash, created_at);
CREATE INDEX takedown_requests_email_idx ON public.takedown_requests (lower(requester_email), created_at);
-- One open request per email per rumour; a second one adds nothing.
CREATE UNIQUE INDEX takedown_requests_one_open_per_email
  ON public.takedown_requests (rumour_id, lower(requester_email))
  WHERE status = 'open';

-- Staff read everything except the hashes; nobody writes through the API.
-- Requests come in through the server (service role) and decisions through
-- the functions below.
ALTER TABLE public.takedown_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.takedown_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.takedown_requests TO service_role;
GRANT SELECT (
  id, reference, rumour_id, relation, requester_name, requester_email,
  explanation, status, decision_note, decided_at, created_at, anonymised_at
) ON public.takedown_requests TO authenticated;

CREATE POLICY "Staff can read takedown requests" ON public.takedown_requests
  FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

-- ---------------------------------------------------------------------------
-- Submit (server only)
-- ---------------------------------------------------------------------------
-- Called by the requestTakedown server action with the service role, because
-- the IP hash must come from the server, not from the visitor. Checks that
-- the rumour is public and applies the rate limits; returns the reference.
-- Keep the limits in sync with TAKEDOWN_LIMITS in lib/takedown.ts.
--
--   VR002  too many requests from this IP today (5) or this email (3)
--   VR003  this email already has an open request for this rumour
--   P0002  the rumour doesn't exist or isn't public
CREATE FUNCTION public.submit_takedown_request(
  p_rumour_id uuid,
  p_relation text,
  p_name text,
  p_email text,
  p_explanation text,
  p_token_hash text,
  p_ip_hash text
)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  email text := lower(btrim(p_email));
  ref text;
BEGIN
  -- Parallel submits from one IP or email wait for each other, so they can't
  -- slip past the limits together. Always IP first, then email: no deadlocks.
  PERFORM pg_advisory_xact_lock(hashtextextended('takedown_ip:' || COALESCE(p_ip_hash, ''), 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('takedown_email:' || email, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.rumours
     WHERE id = p_rumour_id AND status IN ('rumour', 'confirmed', 'denied')
  ) THEN
    RAISE EXCEPTION 'rumour not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_ip_hash IS NOT NULL AND (
    SELECT count(*) FROM public.takedown_requests
     WHERE ip_hash = p_ip_hash AND created_at > now() - interval '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION 'too many takedown requests from this address' USING ERRCODE = 'VR002';
  END IF;

  IF (
    SELECT count(*) FROM public.takedown_requests
     WHERE lower(requester_email) = email AND created_at > now() - interval '24 hours'
  ) >= 3 THEN
    RAISE EXCEPTION 'too many takedown requests from this email' USING ERRCODE = 'VR002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.takedown_requests
     WHERE rumour_id = p_rumour_id AND lower(requester_email) = email AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'an open request for this rumour exists' USING ERRCODE = 'VR003';
  END IF;

  LOOP
    SELECT 'VR-' || string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      INTO ref
      FROM generate_series(1, 6);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.takedown_requests WHERE reference = ref);
  END LOOP;

  INSERT INTO public.takedown_requests (
    reference, token_hash, rumour_id, relation, requester_name, requester_email,
    explanation, ip_hash
  ) VALUES (
    ref, p_token_hash, p_rumour_id, p_relation, btrim(p_name), btrim(p_email),
    btrim(p_explanation), p_ip_hash
  );

  RETURN ref;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_takedown_request(uuid, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_takedown_request(uuid, text, text, text, text, text, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Decide: remove the rumour
-- ---------------------------------------------------------------------------
-- Removes the rumour from every public view and answers every open request
-- about it with the same decision, in one transaction with the log entry.
CREATE FUNCTION public.remove_rumour_for_takedown(
  p_request_id uuid,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  note text := NULLIF(btrim(p_note), '');
  target uuid;
  refs text[];
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can handle takedown requests'
      USING ERRCODE = '42501';
  END IF;

  -- The row lock makes a concurrent second decision wait, then fail.
  SELECT rumour_id INTO target
    FROM public.takedown_requests
   WHERE id = p_request_id AND status = 'open'
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'takedown request is not open' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.rumours SET status = 'removed', updated_at = now() WHERE id = target;

  WITH answered AS (
    UPDATE public.takedown_requests
       SET status = 'removed', decision_note = note, decided_at = now()
     WHERE rumour_id = target AND status = 'open'
    RETURNING reference
  )
  SELECT array_agg(reference ORDER BY reference) INTO refs FROM answered;

  PERFORM public.log_staff_action(
    'content_removed',
    'rumour',
    target,
    'Verwijderverzoek ' || array_to_string(refs, ', ') || COALESCE(': ' || note, ''),
    jsonb_build_object('takedown_requests', to_jsonb(refs))
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Decide: reject the request
-- ---------------------------------------------------------------------------
-- The rumour stays. The requester reads the note on the status page, so it is
-- required.
CREATE FUNCTION public.reject_takedown_request(
  p_request_id uuid,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  note text := NULLIF(btrim(p_note), '');
  ref text;
  target uuid;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can handle takedown requests'
      USING ERRCODE = '42501';
  END IF;
  IF note IS NULL THEN
    RAISE EXCEPTION 'a rejection needs a note' USING ERRCODE = '22023';
  END IF;

  UPDATE public.takedown_requests
     SET status = 'rejected', decision_note = note, decided_at = now()
   WHERE id = p_request_id AND status = 'open'
  RETURNING reference, rumour_id INTO ref, target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'takedown request is not open' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.log_staff_action(
    'takedown_rejected',
    'takedown_request',
    p_request_id,
    'Verwijderverzoek ' || ref || ' afgewezen: ' || note,
    jsonb_build_object('reference', ref, 'rumour_id', target)
  );
END;
$$;

-- Server actions call these with the moderator's session; the functions check
-- staff themselves.
REVOKE EXECUTE ON FUNCTION public.remove_rumour_for_takedown(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_takedown_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_rumour_for_takedown(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_takedown_request(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Retention (D-014)
-- ---------------------------------------------------------------------------
-- Wipes name, email, explanation and IP hash of decided requests older than
-- 12 months and returns how many. The reference, rumour, decision and dates
-- stay, so the status link still shows the outcome. Service role only; to be
-- scheduled before the first requests expire (October 2027).
CREATE FUNCTION public.anonymise_expired_takedown_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  anonymised integer;
BEGIN
  UPDATE public.takedown_requests
     SET requester_name = NULL,
         requester_email = NULL,
         explanation = NULL,
         ip_hash = NULL,
         anonymised_at = now()
   WHERE anonymised_at IS NULL
     AND status <> 'open'
     AND created_at < now() - interval '12 months';
  GET DIAGNOSTICS anonymised = ROW_COUNT;
  RETURN anonymised;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.anonymise_expired_takedown_requests() FROM PUBLIC, anon, authenticated;
