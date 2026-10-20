-- Moderation emails (#181, D-037). Staff get a content-free email for every
-- new takedown request, report and contact message; a takedown requester gets
-- one email once a moderator decides, with a private link to the status page
-- (DSA art. 16(5)). The app sends the emails; the functions below decide who
-- gets one and are only callable with the service role.

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
-- Every staff account's address. The opt-out on the profile (email_opt_outs)
-- is for a user's own notifications and doesn't apply: handling the inboxes
-- within 72 hours is what the moderator role is for (D-036).
CREATE FUNCTION public.staff_notification_emails()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT u.email::text
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
   WHERE p.role IN ('moderator', 'admin')
     AND u.email IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.staff_notification_emails() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_notification_emails() TO service_role;

-- ---------------------------------------------------------------------------
-- Takedown decisions
-- ---------------------------------------------------------------------------
-- The status link's token is never stored, only its hash, so the decision
-- email carries a second link to the same status page. Staff can't read
-- either hash: neither column is in their SELECT grant.
ALTER TABLE public.takedown_requests
  ADD COLUMN email_token_hash text UNIQUE CHECK (email_token_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN decision_emailed_at timestamptz;

COMMENT ON COLUMN public.takedown_requests.email_token_hash IS
  'SHA-256 of the token in the status link sent with the decision email (#181).';
COMMENT ON COLUMN public.takedown_requests.decision_emailed_at IS
  'When the requester was emailed the decision (#181). Null: not yet.';

-- Requests decided before this migration were never promised an email.
UPDATE public.takedown_requests
   SET decision_emailed_at = decided_at
 WHERE status <> 'open';

-- Claims every decided request whose requester hasn't been emailed yet: gives
-- each a new status link token, marks it emailed and returns the address, the
-- reference and the token. Every way a takedown gets decided (the takedown
-- inbox, removing a reported rumour) is covered by calling this afterwards,
-- and a request is claimed once even when two calls overlap. If the email
-- then fails, it isn't retried: the requester still has the first link.
CREATE FUNCTION public.claim_takedown_decision_emails()
RETURNS TABLE (email text, reference text, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  t text;
BEGIN
  FOR r IN
    SELECT tr.id, tr.requester_email, tr.reference
      FROM public.takedown_requests tr
     WHERE tr.status <> 'open'
       AND tr.decision_emailed_at IS NULL
       AND tr.requester_email IS NOT NULL
       FOR UPDATE SKIP LOCKED
  LOOP
    -- 32 random bytes as base64url, like randomBytes(32) in the app. Two
    -- v4 UUIDs hold 244 random bits.
    t := translate(
      rtrim(encode(decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), '='),
      '+/', '-_'
    );
    UPDATE public.takedown_requests
       SET email_token_hash = encode(sha256(convert_to(t, 'UTF8')), 'hex'),
           decision_emailed_at = now()
     WHERE id = r.id;
    email := r.requester_email;
    reference := r.reference;
    token := t;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_takedown_decision_emails() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_takedown_decision_emails() TO service_role;
