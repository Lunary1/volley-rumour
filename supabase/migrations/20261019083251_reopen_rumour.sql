-- Staff reopen a rumour that was wrongly denied or marked "Niet bevestigd"
-- (issue #150, D-020, J-14).
--
--   denied / expired ──reopen_rumour(reason)──→ lopend
--
-- A wrong confirmation is already undone by deleting its transfer
-- (delete_transfer()); this is the same for the other two outcomes. The
-- author's track record is recounted by the on_rumour_resolution_change
-- trigger (#88), so a reopened denial stops counting against them at once.
-- Voting opens again with the status (check_vote_allowed, #78).

ALTER TABLE public.staff_actions DROP CONSTRAINT staff_actions_action_check;
ALTER TABLE public.staff_actions ADD CONSTRAINT staff_actions_action_check
  CHECK (action IN (
    'rumour_approved',
    'rumour_rejected',
    'rumour_resolved',
    'rumour_reopened',
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
    'contact_handled',
    'transfer_created',
    'transfer_updated',
    'transfer_deleted'
  ));

--   42501  not staff
--   P0002  the rumour doesn't exist or isn't denied or expired
--   22023  no reason, or a reason that is too long
CREATE FUNCTION public.reopen_rumour(p_rumour_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reason text := NULLIF(btrim(p_reason), '');
  r public.rumours%ROWTYPE;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can reopen rumours' USING ERRCODE = '42501';
  END IF;
  IF reason IS NULL OR char_length(reason) > 500 THEN
    RAISE EXCEPTION 'reopening needs a reason of at most 500 characters' USING ERRCODE = '22023';
  END IF;

  -- The row lock makes a concurrent reopen or takedown wait, then find the
  -- rumour in its new state.
  SELECT * INTO r FROM public.rumours WHERE id = p_rumour_id FOR UPDATE;
  IF NOT FOUND OR r.status NOT IN ('denied', 'expired') THEN
    RAISE EXCEPTION 'rumour is not denied or expired' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.rumours
     SET status = 'rumour', resolved_at = NULL, resolution_source_url = NULL, updated_at = now()
   WHERE id = r.id;

  PERFORM public.log_staff_action(
    'rumour_reopened',
    'rumour',
    r.id,
    reason,
    jsonb_strip_nulls(jsonb_build_object(
      'previous_status', r.status,
      'resolved_at', r.resolved_at,
      'resolution_source_url', r.resolution_source_url
    ))
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reopen_rumour(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_rumour(uuid, text) TO authenticated;
