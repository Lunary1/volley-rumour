-- Moderators resolve live rumours and manage confirmed transfers (issue #70,
-- D-020, J-14). Also gives transfers one set of types (#82).
--
--   rumour (lopend) ──resolve_rumour('confirmed', url)──→ confirmed + transfer
--                   ├─resolve_rumour('denied')──────────→ denied
--                   ├─resolve_rumour('expired')─────────→ expired ("Niet bevestigd")
--                   └─expire_open_rumours()─────────────→ expired, all at once
--
--   create_transfer() / update_transfer() / delete_transfer()
--     add a transfer that didn't come from a rumour, or correct or remove one.
--     Removing a transfer that came from a rumour puts the rumour back to
--     lopend, so it can be resolved again.
--
-- Only staff may do any of this (D-020: moderators only; D-006). Every
-- function checks is_staff(), does the work and writes the audit log entry in
-- one transaction (D-011). Transfers stay closed to direct writes (#34).
--
-- Expired rumours are public, like confirmed and denied ones, and neutral in
-- the author's track record (D-005, #88). Voting already closes on every
-- status but lopend (check_vote_allowed, #78).

-- ---------------------------------------------------------------------------
-- Statuses
-- ---------------------------------------------------------------------------
ALTER TABLE public.rumours DROP CONSTRAINT rumours_status_check;
ALTER TABLE public.rumours ADD CONSTRAINT rumours_status_check
  CHECK (status IN ('pending', 'rumour', 'confirmed', 'denied', 'expired', 'rejected', 'removed'));

-- When a moderator resolved the rumour, and the official source for it.
-- Rumours resolved before #70 have neither. Not in the INSERT grant, so only
-- the functions below write them.
ALTER TABLE public.rumours
  ADD COLUMN resolved_at timestamptz,
  ADD COLUMN resolution_source_url text CHECK (char_length(resolution_source_url) <= 500);

DROP POLICY "Public rumours, own rumours and staff" ON public.rumours;
CREATE POLICY "Public rumours, own rumours and staff" ON public.rumours
  FOR SELECT USING (
    status IN ('rumour', 'confirmed', 'denied', 'expired')
    OR creator_id = (SELECT auth.uid())
    OR (SELECT public.is_staff())
  );

-- ---------------------------------------------------------------------------
-- Transfers
-- ---------------------------------------------------------------------------
-- category is the transfer's type everywhere (#82): player_male,
-- player_female, trainer_male, trainer_female, player_retirement,
-- trainer_retirement. Keep in sync with TRANSFER_CATEGORIES in
-- lib/transfers.ts.
ALTER TABLE public.transfers
  ADD COLUMN source_url text CHECK (char_length(source_url) <= 500);

-- One transfer per rumour, however often it is confirmed.
CREATE UNIQUE INDEX transfers_source_rumour_id_key
  ON public.transfers (source_rumour_id)
  WHERE source_rumour_id IS NOT NULL;

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
    'contact_handled',
    'transfer_created',
    'transfer_updated',
    'transfer_deleted'
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
    'contact_message',
    'transfer'
  ));

-- ---------------------------------------------------------------------------
-- Checks shared by the functions below
-- ---------------------------------------------------------------------------
-- A source link must be http(s) and at most 500 characters. Returns the
-- trimmed link, or NULL when there is none.
CREATE FUNCTION public.checked_source_url(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  url text := NULLIF(btrim(p_url), '');
BEGIN
  IF url IS NOT NULL AND (url !~* '^https?://[^\s]+$' OR char_length(url) > 500) THEN
    RAISE EXCEPTION 'invalid source url' USING ERRCODE = '22023';
  END IF;
  RETURN url;
END;
$$;

-- Checks what a moderator enters for a transfer.
CREATE FUNCTION public.check_transfer_fields(
  p_player_name text,
  p_category text,
  p_from_club text,
  p_to_club text,
  p_division text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF char_length(btrim(COALESCE(p_player_name, ''))) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
  END IF;
  IF p_category IS NULL OR p_category NOT IN (
    'player_male', 'player_female', 'trainer_male', 'trainer_female',
    'player_retirement', 'trainer_retirement'
  ) THEN
    RAISE EXCEPTION 'invalid transfer type' USING ERRCODE = '22023';
  END IF;
  -- Someone who stops has no new club; everyone else does.
  IF p_category NOT LIKE '%retirement' AND NULLIF(btrim(p_to_club), '') IS NULL THEN
    RAISE EXCEPTION 'a transfer needs a new club' USING ERRCODE = '22023';
  END IF;
  IF char_length(p_from_club) > 100 OR char_length(p_to_club) > 100 THEN
    RAISE EXCEPTION 'club name too long' USING ERRCODE = '22023';
  END IF;
  -- Senior divisions only (D-003), as on rumours.
  IF p_division IS NOT NULL AND p_division NOT IN (
    'liga_heren', 'liga_dames',
    'nat1_heren', 'nat2_heren', 'nat3_heren',
    'nat1_dames', 'nat2_dames', 'nat3_dames',
    'promo1_heren', 'promo2_heren', 'promo3_heren', 'promo4_heren',
    'promo1_dames', 'promo2_dames', 'promo3_dames', 'promo4_dames'
  ) THEN
    RAISE EXCEPTION 'invalid division' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.checked_source_url(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_transfer_fields(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resolve one rumour
-- ---------------------------------------------------------------------------
-- p_outcome   confirmed, denied or expired
-- p_source_url  required to confirm (an official club, federation or press
--             link, D-020); optional to deny; shown on the rumour
-- p_category  the transfer's type, required to confirm; must fit the rumour
--             (a player transfer is player_male or player_female, etc.)
-- p_note      the moderator's own words, in the audit log only
--
-- Returns the new transfer's id when confirming, otherwise NULL.
--
--   42501  not staff
--   P0002  the rumour doesn't exist or isn't lopend (already resolved: a
--          second confirmation never makes a second transfer)
--   22023  invalid outcome, link, type or note
CREATE FUNCTION public.resolve_rumour(
  p_rumour_id uuid,
  p_outcome text,
  p_source_url text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  url text;
  note text := NULLIF(btrim(p_note), '');
  r public.rumours%ROWTYPE;
  retirement boolean;
  transfer_id uuid;
  label text;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can resolve rumours' USING ERRCODE = '42501';
  END IF;

  IF p_outcome IS NULL OR p_outcome NOT IN ('confirmed', 'denied', 'expired') THEN
    RAISE EXCEPTION 'invalid outcome' USING ERRCODE = '22023';
  END IF;
  url := public.checked_source_url(p_source_url);
  IF p_outcome = 'confirmed' AND url IS NULL THEN
    RAISE EXCEPTION 'confirming needs an official source' USING ERRCODE = '22023';
  END IF;
  IF char_length(note) > 500 THEN
    RAISE EXCEPTION 'note too long' USING ERRCODE = '22023';
  END IF;

  -- The row lock makes a second, concurrent decision wait, then find the
  -- rumour no longer lopend.
  SELECT * INTO r FROM public.rumours WHERE id = p_rumour_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'rumour' THEN
    RAISE EXCEPTION 'rumour is not lopend' USING ERRCODE = 'P0002';
  END IF;

  IF p_outcome = 'confirmed' THEN
    -- In parentheses: PL/pgSQL would otherwise end the IF at the CASE's THEN.
    IF p_category IS NULL OR NOT (CASE r.category
      WHEN 'transfer' THEN p_category IN ('player_male', 'player_female')
      WHEN 'trainer_transfer' THEN p_category IN ('trainer_male', 'trainer_female')
      ELSE p_category = r.category
    END) THEN
      RAISE EXCEPTION 'transfer type does not fit the rumour' USING ERRCODE = '22023';
    END IF;
    retirement := p_category LIKE '%retirement';

    PERFORM public.check_transfer_fields(
      r.player_name, p_category, r.from_club_name,
      CASE WHEN retirement THEN NULL ELSE r.to_club_name END,
      CASE WHEN retirement THEN r.from_division ELSE r.to_division END
    );

    INSERT INTO public.transfers (
      player_name, from_club, to_club, category, division,
      source_rumour_id, source_url, confirmed_at
    ) VALUES (
      r.player_name, r.from_club_name,
      CASE WHEN retirement THEN NULL ELSE r.to_club_name END,
      p_category,
      CASE WHEN retirement THEN r.from_division ELSE r.to_division END,
      r.id, url, now()
    )
    RETURNING id INTO transfer_id;
  END IF;

  UPDATE public.rumours
     SET status = p_outcome,
         resolved_at = now(),
         resolution_source_url = url,
         updated_at = now()
   WHERE id = r.id;

  label := CASE p_outcome
    WHEN 'confirmed' THEN 'Bevestigd'
    WHEN 'denied' THEN 'Ontkracht'
    ELSE 'Niet bevestigd'
  END;
  PERFORM public.log_staff_action(
    'rumour_resolved',
    'rumour',
    r.id,
    label || COALESCE(': ' || note, ''),
    jsonb_strip_nulls(jsonb_build_object(
      'outcome', p_outcome,
      'source_url', url,
      'transfer_id', transfer_id
    ))
  );

  RETURN transfer_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- End of a transfer window: every lopend rumour becomes "Niet bevestigd"
-- ---------------------------------------------------------------------------
-- Returns how many rumours were expired. Each gets its own log entry, so a
-- rumour's history stays complete.
CREATE FUNCTION public.expire_open_rumours()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  expired_id uuid;
  expired integer := 0;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can resolve rumours' USING ERRCODE = '42501';
  END IF;

  FOR expired_id IN
    UPDATE public.rumours
       SET status = 'expired', resolved_at = now(), updated_at = now()
     WHERE status = 'rumour'
    RETURNING id
  LOOP
    PERFORM public.log_staff_action(
      'rumour_resolved',
      'rumour',
      expired_id,
      'Niet bevestigd: einde transferperiode',
      jsonb_build_object('outcome', 'expired', 'bulk', true)
    );
    expired := expired + 1;
  END LOOP;

  RETURN expired;
END;
$$;

-- ---------------------------------------------------------------------------
-- Transfers staff add, correct or remove
-- ---------------------------------------------------------------------------
--   42501  not staff
--   P0002  the transfer doesn't exist
--   22023  invalid field (see check_transfer_fields), link or date
CREATE FUNCTION public.create_transfer(
  p_player_name text,
  p_category text,
  p_from_club text,
  p_to_club text,
  p_division text,
  p_confirmed_on date,
  p_source_url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  url text;
  new_id uuid;
  retirement boolean := p_category LIKE '%retirement';
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can manage transfers' USING ERRCODE = '42501';
  END IF;

  PERFORM public.check_transfer_fields(p_player_name, p_category, p_from_club, p_to_club, p_division);
  url := public.checked_source_url(p_source_url);
  -- A transfer that didn't come from a rumour is only added when it is
  -- official (D-020).
  IF url IS NULL THEN
    RAISE EXCEPTION 'a transfer needs an official source' USING ERRCODE = '22023';
  END IF;
  IF p_confirmed_on IS NULL OR p_confirmed_on > (now() AT TIME ZONE 'Europe/Brussels')::date THEN
    RAISE EXCEPTION 'invalid date' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.transfers (
    player_name, from_club, to_club, category, division, source_url, confirmed_at
  ) VALUES (
    btrim(p_player_name),
    NULLIF(btrim(p_from_club), ''),
    CASE WHEN retirement THEN NULL ELSE btrim(p_to_club) END,
    p_category,
    p_division,
    url,
    p_confirmed_on::timestamp AT TIME ZONE 'Europe/Brussels'
  )
  RETURNING id INTO new_id;

  PERFORM public.log_staff_action(
    'transfer_created', 'transfer', new_id, NULL,
    jsonb_build_object('player_name', btrim(p_player_name), 'source_url', url)
  );

  RETURN new_id;
END;
$$;

CREATE FUNCTION public.update_transfer(
  p_transfer_id uuid,
  p_player_name text,
  p_category text,
  p_from_club text,
  p_to_club text,
  p_division text,
  p_confirmed_on date,
  p_source_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  url text;
  before public.transfers%ROWTYPE;
  retirement boolean := p_category LIKE '%retirement';
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can manage transfers' USING ERRCODE = '42501';
  END IF;

  PERFORM public.check_transfer_fields(p_player_name, p_category, p_from_club, p_to_club, p_division);
  url := public.checked_source_url(p_source_url);
  IF url IS NULL THEN
    RAISE EXCEPTION 'a transfer needs an official source' USING ERRCODE = '22023';
  END IF;
  IF p_confirmed_on IS NULL OR p_confirmed_on > (now() AT TIME ZONE 'Europe/Brussels')::date THEN
    RAISE EXCEPTION 'invalid date' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO before FROM public.transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.transfers
     SET player_name = btrim(p_player_name),
         from_club = NULLIF(btrim(p_from_club), ''),
         to_club = CASE WHEN retirement THEN NULL ELSE btrim(p_to_club) END,
         category = p_category,
         division = p_division,
         source_url = url,
         confirmed_at = p_confirmed_on::timestamp AT TIME ZONE 'Europe/Brussels'
   WHERE id = p_transfer_id;

  -- What it said before, so a correction can be traced and undone.
  PERFORM public.log_staff_action(
    'transfer_updated', 'transfer', p_transfer_id, NULL,
    jsonb_build_object('before', to_jsonb(before))
  );
END;
$$;

CREATE FUNCTION public.delete_transfer(p_transfer_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reason text := NULLIF(btrim(p_reason), '');
  before public.transfers%ROWTYPE;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can manage transfers' USING ERRCODE = '42501';
  END IF;
  IF char_length(reason) > 500 THEN
    RAISE EXCEPTION 'reason too long' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.transfers WHERE id = p_transfer_id RETURNING * INTO before;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer not found' USING ERRCODE = 'P0002';
  END IF;

  -- A confirmation that was a mistake: the rumour is lopend again, so a
  -- moderator can resolve it the right way. A rumour removed since (takedown,
  -- report) stays removed.
  UPDATE public.rumours
     SET status = 'rumour', resolved_at = NULL, resolution_source_url = NULL, updated_at = now()
   WHERE id = before.source_rumour_id AND status = 'confirmed';

  PERFORM public.log_staff_action(
    'transfer_deleted', 'transfer', p_transfer_id, reason,
    jsonb_build_object('before', to_jsonb(before))
  );
END;
$$;

-- Server actions call these with the moderator's session; the functions check
-- staff themselves.
REVOKE EXECUTE ON FUNCTION public.resolve_rumour(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.expire_open_rumours() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_transfer(text, text, text, text, text, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_transfer(uuid, text, text, text, text, text, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_transfer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_rumour(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_open_rumours() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transfer(text, text, text, text, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_transfer(uuid, text, text, text, text, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_transfer(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Expired rumours are public, so they can be reported and taken down too
-- ---------------------------------------------------------------------------
-- Unchanged from #68 and #69 except for 'expired' in the list of public
-- statuses.

CREATE OR REPLACE FUNCTION public.submit_takedown_request(
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
     WHERE id = p_rumour_id AND status IN ('rumour', 'confirmed', 'denied', 'expired')
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

CREATE OR REPLACE FUNCTION public.submit_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_explanation text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
  explanation text := NULLIF(btrim(p_explanation), '');
  author uuid;
  report_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'log in to report' USING ERRCODE = '42501';
  END IF;

  IF p_target_type = 'conversation' THEN
    IF p_reason IS NULL OR p_reason NOT IN ('harassment', 'offensive', 'spam', 'inappropriate', 'other') THEN
      RAISE EXCEPTION 'invalid reason' USING ERRCODE = '22023';
    END IF;
  ELSIF p_target_type IN ('rumour', 'classified') THEN
    IF p_reason IS NULL OR p_reason NOT IN ('incorrect', 'offensive', 'private_info', 'spam', 'minor', 'other') THEN
      RAISE EXCEPTION 'invalid reason' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid target type' USING ERRCODE = '22023';
  END IF;
  IF p_reason = 'other' AND explanation IS NULL THEN
    RAISE EXCEPTION 'explain the report' USING ERRCODE = '22023';
  END IF;

  -- Parallel reports from one user wait for each other, so they can't slip
  -- past the limit together.
  PERFORM pg_advisory_xact_lock(hashtextextended('report:' || uid::text, 0));

  -- Only what the user can see: public rumours, visible zoekertjes, their own
  -- conversations. For a conversation, the author is the other participant.
  IF p_target_type = 'rumour' THEN
    SELECT creator_id INTO author FROM public.rumours
     WHERE id = p_target_id AND status IN ('rumour', 'confirmed', 'denied', 'expired');
  ELSIF p_target_type = 'classified' THEN
    SELECT user_id INTO author FROM public.classifieds
     WHERE id = p_target_id AND is_active AND removed_at IS NULL;
  ELSE
    SELECT CASE WHEN initiator_id = uid THEN recipient_id ELSE initiator_id END INTO author
      FROM public.conversations
     WHERE id = p_target_id AND uid IN (initiator_id, recipient_id);
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'item not found' USING ERRCODE = 'P0002';
  END IF;
  IF author = uid THEN
    RAISE EXCEPTION 'cannot report own content' USING ERRCODE = 'VR004';
  END IF;

  IF (
    SELECT count(*) FROM public.reports
     WHERE reporter_id = uid AND created_at > now() - interval '24 hours'
  ) >= 10 THEN
    RAISE EXCEPTION 'too many reports today' USING ERRCODE = 'VR002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reports
     WHERE reporter_id = uid AND status = 'open'
       AND p_target_id IN (rumour_id, classified_id, conversation_id)
  ) THEN
    RAISE EXCEPTION 'an open report for this item exists' USING ERRCODE = 'VR003';
  END IF;

  INSERT INTO public.reports (
    target_type, rumour_id, classified_id, conversation_id,
    reporter_id, reported_user_id, reason, explanation
  ) VALUES (
    p_target_type,
    CASE WHEN p_target_type = 'rumour' THEN p_target_id END,
    CASE WHEN p_target_type = 'classified' THEN p_target_id END,
    CASE WHEN p_target_type = 'conversation' THEN p_target_id END,
    uid, author, p_reason, left(explanation, 1000)
  )
  RETURNING id INTO report_id;

  RETURN report_id;
END;
$$;
