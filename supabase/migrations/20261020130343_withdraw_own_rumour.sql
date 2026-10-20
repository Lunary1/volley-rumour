-- Authors withdraw their own rumour, and edit it while it is pending (#192,
-- D-042, J-09, J-10).
--
--   pending ──withdraw_rumour()──→ withdrawn
--   rumour (lopend) ──withdraw_rumour()──→ withdrawn
--   pending ──UPDATE by its author──→ pending, edited
--
-- Confirmed, denied and expired rumours are the track record (D-005) and
-- can't be withdrawn. Published rumours can't be edited: the author withdraws
-- one and submits a new one, which goes through the queue again.
--
-- Withdrawing sets a status instead of deleting the row: takedown requests
-- and reports reference the rumour ON DELETE CASCADE and must stay in the
-- staff inbox. The SELECT policy only shows rumour, confirmed, denied and
-- expired to everyone, so a withdrawn rumour is already hidden from everyone
-- but its author and staff, like removed. The pending cap (check_new_rumour)
-- counts pending only, and the track record counts confirmed and denied
-- only, so neither changes.
--
-- Suspended users may still withdraw (it only removes content), but not edit
-- (VR005): withdraw_rumour() runs as its owner, which the
-- check_account_not_suspended trigger lets through.

-- ---------------------------------------------------------------------------
-- Status and dates
-- ---------------------------------------------------------------------------
ALTER TABLE public.rumours DROP CONSTRAINT rumours_status_check;
ALTER TABLE public.rumours ADD CONSTRAINT rumours_status_check
  CHECK (status IN ('pending', 'rumour', 'confirmed', 'denied', 'expired',
                    'rejected', 'removed', 'withdrawn'));

-- Not in any grant, so only the functions below write them.
ALTER TABLE public.rumours
  ADD COLUMN withdrawn_at timestamptz,
  ADD COLUMN anonymised_at timestamptz;

COMMENT ON COLUMN public.rumours.withdrawn_at IS
  'When the author withdrew the rumour (#192, D-042); its text is wiped 12 months later';
COMMENT ON COLUMN public.rumours.anonymised_at IS
  'When wipe_withdrawn_rumours() wiped the text of this withdrawn rumour';

-- ---------------------------------------------------------------------------
-- Withdraw
-- ---------------------------------------------------------------------------
-- The author only, from pending or lopend. Not a staff action, so no audit
-- log entry: the rumour keeps its withdrawn_at.
--   P0002  not found, or not the caller's rumour
--   VR013  the rumour isn't pending or lopend any more
CREATE FUNCTION public.withdraw_rumour(p_rumour_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'log in to withdraw a rumour' USING ERRCODE = '42501';
  END IF;

  -- The row lock makes a moderator's decision at the same moment wait, or
  -- this one see the new status.
  SELECT status INTO v_status
    FROM public.rumours
   WHERE id = p_rumour_id AND creator_id = v_uid
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rumour not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status NOT IN ('pending', 'rumour') THEN
    RAISE EXCEPTION 'only a pending or lopend rumour can be withdrawn'
      USING ERRCODE = 'VR013';
  END IF;

  UPDATE public.rumours
     SET status = 'withdrawn', withdrawn_at = now(), updated_at = now()
   WHERE id = p_rumour_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.withdraw_rumour(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_rumour(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Edit while pending
-- ---------------------------------------------------------------------------
-- The same columns the author fills in when submitting. Status, creator,
-- votes, featuring and the moderator's fields stay out of reach.
GRANT UPDATE (player_name, from_club_name, to_club_name, description,
              category, gender, from_division, to_division,
              source_type, source_url, declared_good_faith, declared_senior)
  ON public.rumours TO authenticated;

CREATE POLICY "Authors edit their own pending rumours" ON public.rumours
  FOR UPDATE TO authenticated
  USING (creator_id = (SELECT auth.uid()) AND status = 'pending')
  WITH CHECK (creator_id = (SELECT auth.uid()) AND status = 'pending');

-- An edit passes the same checks as a submission (check_new_rumour), except
-- the pending cap. The column checks (source link, divisions, gender) apply
-- to every UPDATE already. Only edits through the API are checked; the
-- moderation functions run as their owner.
CREATE FUNCTION public.check_rumour_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- The policy already limits edits to pending rumours; this keeps it so if
  -- a later policy widens UPDATE.
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'only a pending rumour can be edited'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.source_type IS NULL THEN
    RAISE EXCEPTION 'a rumour needs a source type'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.declared_good_faith IS NOT TRUE OR NEW.declared_senior IS NOT TRUE THEN
    RAISE EXCEPTION 'a rumour needs both declarations'
      USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rumour_edit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER check_rumour_edit
  BEFORE UPDATE ON public.rumours
  FOR EACH ROW EXECUTE FUNCTION public.check_rumour_edit();

-- Suspended users can't edit (VR005). The trigger fired on INSERT only.
DROP TRIGGER check_account_not_suspended ON public.rumours;
CREATE TRIGGER check_account_not_suspended
  BEFORE INSERT OR UPDATE ON public.rumours
  FOR EACH ROW EXECUTE FUNCTION public.check_account_not_suspended();

-- ---------------------------------------------------------------------------
-- Retention (D-042, like takedowns in D-014)
-- ---------------------------------------------------------------------------
-- Wipes the name, clubs, description and source link of rumours withdrawn
-- more than 12 months ago and returns how many. The row stays, so reports
-- and takedown requests about it keep their reference. Service role only;
-- to be scheduled with the other retention functions.
CREATE FUNCTION public.wipe_withdrawn_rumours()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  wiped integer;
BEGIN
  UPDATE public.rumours
     SET player_name = 'Ingetrokken gerucht',
         from_club_name = NULL,
         to_club_name = NULL,
         description = NULL,
         source_url = NULL,
         anonymised_at = now()
   WHERE anonymised_at IS NULL
     AND withdrawn_at < now() - interval '12 months';
  GET DIAGNOSTICS wiped = ROW_COUNT;
  RETURN wiped;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wipe_withdrawn_rumours() FROM PUBLIC, anon, authenticated;
