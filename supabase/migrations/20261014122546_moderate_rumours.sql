-- Moderators approve or reject pending rumours (issue #66, D-002, D-012).
--
--   pending ──approve_rumour()──→ rumour (lopend, public)
--      └─────reject_rumour()───→ rejected (author and staff only, with reason)
--
-- Both functions check staff, change the status and write the audit log entry
-- in one transaction, so a rumour is never approved or rejected unlogged
-- (#64). They only act on pending rumours: a second moderator acting on the
-- same rumour gets an error instead of overwriting the first decision.
--
-- Moderators may moderate their own rumours; the log shows who did it (D-012).

-- ---------------------------------------------------------------------------
-- Why a rumour was rejected, shown to its author
-- ---------------------------------------------------------------------------
-- The reason is a fixed code (Moderation Policy); the app shows the Dutch
-- label. The note is the moderator's own words: required for 'other', optional
-- otherwise (e.g. which rumour it duplicates).
--
-- Both are readable wherever the rumour is: RLS shows rejected rumours to the
-- author and staff only (#65). Neither is in the INSERT grant, so only
-- reject_rumour() writes them.
ALTER TABLE public.rumours
  ADD COLUMN rejection_reason text CHECK (rejection_reason IN (
    'no_source',
    'minor_or_not_senior',
    'offensive_or_personal',
    'duplicate',
    'incomplete',
    'other'
  )),
  ADD COLUMN rejection_note text CHECK (char_length(rejection_note) <= 500),
  ADD CONSTRAINT rumours_rejection_only_when_rejected CHECK (
    status = 'rejected' OR (rejection_reason IS NULL AND rejection_note IS NULL)
  );

-- ---------------------------------------------------------------------------
-- Approve
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.approve_rumour(p_rumour_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can moderate rumours'
      USING ERRCODE = '42501';
  END IF;

  -- The status condition makes a concurrent second decision a no-op: it
  -- waits for the first one's row lock, then no longer matches.
  UPDATE public.rumours
     SET status = 'rumour', updated_at = now()
   WHERE id = p_rumour_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rumour is not pending'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.log_staff_action('rumour_approved', 'rumour', p_rumour_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Reject
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_rumour(
  p_rumour_id uuid,
  p_reason text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  note text := NULLIF(btrim(p_note), '');
  label text;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can moderate rumours'
      USING ERRCODE = '42501';
  END IF;

  -- The audit log keeps the reason as the author read it, even if the labels
  -- in the app change later. Keep in sync with REJECTION_REASONS in
  -- lib/rumours.ts.
  label := CASE p_reason
    WHEN 'no_source' THEN 'Geen of onvoldoende bron'
    WHEN 'minor_or_not_senior' THEN 'Mogelijk minderjarige of geen senior niveau'
    WHEN 'offensive_or_personal' THEN 'Beledigend of persoonlijk'
    WHEN 'duplicate' THEN 'Dubbel gerucht'
    WHEN 'incomplete' THEN 'Onvolledig of onduidelijk'
    WHEN 'other' THEN 'Andere'
  END;
  IF label IS NULL THEN
    RAISE EXCEPTION 'unknown rejection reason'
      USING ERRCODE = '22023';
  END IF;
  IF p_reason = 'other' AND note IS NULL THEN
    RAISE EXCEPTION 'reason other needs a note'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.rumours
     SET status = 'rejected',
         rejection_reason = p_reason,
         rejection_note = note,
         updated_at = now()
   WHERE id = p_rumour_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rumour is not pending'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.log_staff_action(
    'rumour_rejected',
    'rumour',
    p_rumour_id,
    label || COALESCE(': ' || note, ''),
    jsonb_build_object('reason', p_reason)
  );
END;
$$;

-- Server actions call these with the moderator's session; the functions check
-- staff themselves.
REVOKE EXECUTE ON FUNCTION public.approve_rumour(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_rumour(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_rumour(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_rumour(uuid, text, text) TO authenticated;
