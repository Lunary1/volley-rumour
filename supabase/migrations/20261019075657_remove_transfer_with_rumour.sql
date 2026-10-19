-- Removing a rumour also deletes the transfer made when it was confirmed
-- (#151). A takedown usually means a person asked to be taken off the site, so
-- their name must not stay on /transfers. Always deleted, also when the
-- transfer had an official source: staff can add it again by hand (owner,
-- 2026-10-19).

-- ---------------------------------------------------------------------------
-- Helper: delete a removed rumour's transfer, logged
-- ---------------------------------------------------------------------------
-- Called by the removal functions below, in their transaction. Logged as its
-- own transfer_deleted entry with the row as it was, like delete_transfer(),
-- so the transfer's history stays in one place. Not callable through the API.
CREATE FUNCTION public.delete_transfer_of_removed_rumour(
  p_rumour_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  before public.transfers%ROWTYPE;
BEGIN
  DELETE FROM public.transfers WHERE source_rumour_id = p_rumour_id RETURNING * INTO before;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM public.log_staff_action(
    'transfer_deleted', 'transfer', before.id, p_reason,
    jsonb_build_object('before', to_jsonb(before), 'rumour_removed', p_rumour_id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_transfer_of_removed_rumour(uuid, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Remove after a report
-- ---------------------------------------------------------------------------
-- Same as in 20261014174640_user_reports.sql, plus the transfer.
CREATE OR REPLACE FUNCTION public.remove_reported_content(
  p_report_id uuid,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  note text := NULLIF(btrim(p_note), '');
  r public.reports%ROWTYPE;
  target uuid;
  report_ids uuid[];
  refs text[];
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can handle reports' USING ERRCODE = '42501';
  END IF;

  -- The row lock makes a concurrent second decision wait, then fail.
  SELECT * INTO r FROM public.reports
   WHERE id = p_report_id AND status = 'open'
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'report is not open' USING ERRCODE = 'P0002';
  END IF;
  IF r.target_type = 'conversation' THEN
    RAISE EXCEPTION 'conversations are not removed' USING ERRCODE = '22023';
  END IF;

  target := COALESCE(r.rumour_id, r.classified_id);

  IF r.target_type = 'rumour' THEN
    UPDATE public.rumours
       SET status = 'removed', removal_note = note, updated_at = now()
     WHERE id = target;

    WITH answered AS (
      UPDATE public.takedown_requests
         SET status = 'removed', decided_at = now()
       WHERE rumour_id = target AND status = 'open'
      RETURNING reference
    )
    SELECT array_agg(reference ORDER BY reference) INTO refs FROM answered;
  ELSE
    UPDATE public.classifieds
       SET removed_at = now(), removal_note = note, updated_at = now()
     WHERE id = target;
  END IF;

  WITH answered AS (
    UPDATE public.reports
       SET status = 'content_removed', decision_note = note, decided_at = now()
     WHERE status = 'open' AND target IN (rumour_id, classified_id)
    RETURNING id
  )
  SELECT array_agg(id) INTO report_ids FROM answered;

  PERFORM public.log_staff_action(
    'content_removed',
    r.target_type,
    target,
    'Na melding' || COALESCE(': ' || note, ''),
    jsonb_strip_nulls(jsonb_build_object(
      'reports', to_jsonb(report_ids),
      'takedown_requests', to_jsonb(refs)
    ))
  );

  IF r.target_type = 'rumour' THEN
    PERFORM public.delete_transfer_of_removed_rumour(
      target, 'Gerucht verwijderd na melding' || COALESCE(': ' || note, '')
    );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Remove after a takedown request
-- ---------------------------------------------------------------------------
-- Same as in 20261014174640_user_reports.sql, plus the transfer.
CREATE OR REPLACE FUNCTION public.remove_rumour_for_takedown(
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
  report_ids uuid[];
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

  -- The takedown note is for the requester, not the reporters.
  WITH answered AS (
    UPDATE public.reports
       SET status = 'content_removed', decided_at = now()
     WHERE rumour_id = target AND status = 'open'
    RETURNING id
  )
  SELECT array_agg(id) INTO report_ids FROM answered;

  PERFORM public.log_staff_action(
    'content_removed',
    'rumour',
    target,
    'Verwijderverzoek ' || array_to_string(refs, ', ') || COALESCE(': ' || note, ''),
    jsonb_strip_nulls(jsonb_build_object(
      'takedown_requests', to_jsonb(refs),
      'reports', to_jsonb(report_ids)
    ))
  );

  PERFORM public.delete_transfer_of_removed_rumour(
    target, 'Gerucht verwijderd na verwijderverzoek ' || array_to_string(refs, ', ')
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Rumours removed before this migration
-- ---------------------------------------------------------------------------
-- Not logged: the audit log needs a staff member as actor.
DELETE FROM public.transfers t
 USING public.rumours r
 WHERE r.id = t.source_rumour_id AND r.status = 'removed';
