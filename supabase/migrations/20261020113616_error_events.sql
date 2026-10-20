-- Error monitoring (#186, D-041). Production errors are recorded here instead
-- of a third-party service (D-023): one row per distinct error, with how often
-- and when it happened. The app records server errors from Next's
-- onRequestError hook and browser errors from the error pages, through
-- record_error_event() with the service role, and emails an alert when the
-- function says one is due. Staff read the rows on /admin/fouten. Rows are
-- deleted 90 days after the error was last seen.

CREATE TABLE public.error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Hash the app computes from source, kind, route and message: the same
  -- error on the same route is one row.
  fingerprint text NOT NULL UNIQUE CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  source text NOT NULL CHECK (source IN ('server', 'client')),
  kind text NOT NULL CHECK (kind IN ('render', 'route', 'action', 'proxy', 'client')),
  -- The route pattern (e.g. /zoekertjes/[id]), never a URL with tokens or a
  -- query string.
  route text NOT NULL CHECK (char_length(route) <= 200),
  message text NOT NULL CHECK (char_length(message) <= 500),
  -- Next's digest of the last occurrence, to find it in the Vercel logs.
  digest text CHECK (char_length(digest) <= 100),
  count integer NOT NULL DEFAULT 1 CHECK (count > 0),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  -- When the last alert email went out. Null: none (the hourly cap was hit).
  alerted_at timestamptz
);

CREATE INDEX error_events_last_seen_at_idx ON public.error_events (last_seen_at DESC);
CREATE INDEX error_events_first_seen_at_idx ON public.error_events (first_seen_at);
CREATE INDEX error_events_alerted_at_idx ON public.error_events (alerted_at);

COMMENT ON TABLE public.error_events IS
  'Production errors, one row per distinct error (#186, D-041). Written by record_error_event() only; staff read; deleted 90 days after last seen.';

ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.error_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.error_events TO service_role;
GRANT SELECT ON public.error_events TO authenticated;

CREATE POLICY "Staff can read error events" ON public.error_events
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- Records one occurrence and returns whether to send an alert email. An alert
-- is due for a new error, and for a known one that comes back after a quiet
-- hour, but never more than 10 in an hour, so an outage or someone sending
-- made-up browser errors can't flood the mailbox. For the same reason no more
-- than 100 new errors are stored per hour; occurrences of known errors are
-- always counted.
CREATE FUNCTION public.record_error_event(
  p_fingerprint text,
  p_source text,
  p_kind text,
  p_route text,
  p_message text,
  p_digest text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  alerts_left boolean;
  previous_seen_at timestamptz;
  alert boolean;
BEGIN
  DELETE FROM public.error_events
   WHERE last_seen_at < now() - interval '90 days';

  alerts_left := (
    SELECT count(*) < 10
      FROM public.error_events
     WHERE alerted_at > now() - interval '1 hour'
  );

  SELECT e.last_seen_at INTO previous_seen_at
    FROM public.error_events e
   WHERE e.fingerprint = p_fingerprint
     FOR UPDATE;
  IF FOUND THEN
    alert := previous_seen_at < now() - interval '1 hour' AND alerts_left;
    UPDATE public.error_events e
       SET count = e.count + 1,
           last_seen_at = now(),
           digest = coalesce(left(p_digest, 100), e.digest),
           alerted_at = CASE WHEN alert THEN now() ELSE e.alerted_at END
     WHERE e.fingerprint = p_fingerprint;
    RETURN alert;
  END IF;

  IF (
    SELECT count(*) >= 100
      FROM public.error_events
     WHERE first_seen_at > now() - interval '1 hour'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.error_events AS e
    (fingerprint, source, kind, route, message, digest, alerted_at)
  VALUES (
    p_fingerprint, p_source, p_kind, left(p_route, 200), left(p_message, 500),
    left(p_digest, 100), CASE WHEN alerts_left THEN now() END
  )
  -- Two occurrences at once: the second only counts.
  ON CONFLICT (fingerprint) DO UPDATE
    SET count = e.count + 1,
        last_seen_at = now()
  RETURNING (xmax = 0 AND alerts_left) INTO alert;
  RETURN alert;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_error_event(text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_error_event(text, text, text, text, text, text)
  TO service_role;
