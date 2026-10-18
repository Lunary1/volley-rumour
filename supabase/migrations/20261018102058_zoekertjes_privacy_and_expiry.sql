-- Zoekertjes: contact through messaging only, and ads expire (issues #83 and
-- #84, J-01, J-04, J-05, D-022, D-024, D-030).
--
-- 1. The contact email goes. The form stopped asking for it in #71, but every
--    older ad's email was readable by anyone through the API (R-7, #50). The
--    owner chose to drop it rather than hide it (D-030).
-- 2. Every ad gets an expiry date: the next 31 August, at least 30 days after
--    posting (D-024). Ads online today run until 31 August 2027 (D-030).
--    The owner renews an expired ad with renew_classified().
-- 3. Other users and visitors see only ads that are online: active, not
--    removed and not expired. Owners and staff still see every ad.
-- 4. A conversation about a zoekertje can only be started with its poster,
--    while the ad is online.
--
-- No column-level SELECT grant is needed: once the email is gone, every
-- column of an ad that others can read is shown on the ad page or is empty
-- for them (removed_at, removal_note).

-- ------------------------------------------------- 1. no contact email

-- Drops the column grants from #34 with it.
ALTER TABLE public.classifieds DROP COLUMN contact_email;

-- ------------------------------------------------------- 2. expiry date

-- When an ad posted at `posted` expires: the end of the next 31 August in
-- Belgian time, or 30 days after posting when that is later.
CREATE FUNCTION public.classified_expiry(posted timestamptz)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT greatest(
    make_date(
      extract(year FROM d)::int + CASE WHEN extract(month FROM d) >= 9 THEN 1 ELSE 0 END,
      9, 1
    )::timestamp AT TIME ZONE 'Europe/Brussels',
    posted + interval '30 days'
  )
  FROM (SELECT (posted AT TIME ZONE 'Europe/Brussels')::date AS d) AS local;
$$;

-- Ads online today count as posted now (D-030), so none disappears at
-- launch. Users can't set the column: it isn't in their INSERT or UPDATE
-- grant, so the default always applies.
ALTER TABLE public.classifieds
  ADD COLUMN expires_at timestamptz NOT NULL DEFAULT public.classified_expiry(now());

-- Puts the caller's own expired ad back online with a new expiry date by the
-- same rule (D-024). Also undoes "gevonden": renewing means the poster is
-- looking again. Ads a moderator removed can't be renewed. Returns the new
-- date.
CREATE FUNCTION public.renew_classified(p_classified_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
  new_expiry timestamptz;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not logged in' USING ERRCODE = '42501';
  END IF;

  -- The check_account_not_suspended trigger only acts for the
  -- authenticated role, and this function runs as its owner.
  IF EXISTS (
    SELECT 1
      FROM public.user_suspensions
     WHERE user_id = uid
       AND (suspended_until IS NULL OR suspended_until > now())
  ) THEN
    RAISE EXCEPTION 'account is suspended' USING ERRCODE = 'VR005';
  END IF;

  UPDATE public.classifieds
     SET expires_at = public.classified_expiry(now()),
         is_active = true,
         updated_at = now()
   WHERE id = p_classified_id
     AND user_id = uid
     AND removed_at IS NULL
     AND expires_at <= now()
  RETURNING expires_at INTO new_expiry;

  IF new_expiry IS NULL THEN
    RAISE EXCEPTION 'no expired zoekertje of yours with this id'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN new_expiry;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.renew_classified(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_classified(uuid) TO authenticated;

-- -------------------------------------------------------- 3. who sees what

DROP POLICY "Visible classifieds, own classifieds and staff" ON public.classifieds;
CREATE POLICY "Online classifieds, own classifieds and staff" ON public.classifieds
  FOR SELECT USING (
    (removed_at IS NULL AND is_active AND expires_at > now())
    OR user_id = (SELECT auth.uid())
    OR (SELECT public.is_staff())
  );

-- Conversations keep showing which ad they are about after it went offline.
-- Returns the title of each of p_ids that the caller has a conversation
-- about, unless a moderator removed the ad, and whether it is still online
-- (the page links to it only then).
CREATE FUNCTION public.conversation_classified_titles(p_ids uuid[])
RETURNS TABLE (id uuid, title text, online boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, c.title, coalesce(c.is_active, false) AND c.expires_at > now()
    FROM public.classifieds c
   WHERE c.id = ANY (p_ids)
     AND c.removed_at IS NULL
     AND EXISTS (
       SELECT 1
         FROM public.conversations conv
        WHERE conv.ad_type = 'classified'
          AND conv.ad_id = c.id
          AND (SELECT auth.uid()) IN (conv.initiator_id, conv.recipient_id)
     );
$$;

REVOKE EXECUTE ON FUNCTION public.conversation_classified_titles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conversation_classified_titles(uuid[]) TO authenticated;

-- ---------------------------------------- 4. contact through an online ad

-- A user starts a conversation about a zoekertje with its poster, while the
-- ad is online (D-022). Before, any ad id and any recipient were accepted.
-- Runs as the caller, so RLS hides ads they can't see anyway. Named to fire
-- after check_account_not_suspended and check_not_blocked (name order), so
-- those errors come first. Service-role and test setup inserts are left
-- alone, like the suspension check.
CREATE FUNCTION public.validate_conversation_ad()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'authenticated' AND NEW.ad_type = 'classified' AND NOT EXISTS (
    SELECT 1
      FROM public.classifieds c
     WHERE c.id = NEW.ad_id
       AND c.user_id = NEW.recipient_id
       AND c.removed_at IS NULL
       AND c.is_active
       AND c.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'zoekertje is not online or not posted by the recipient'
      USING ERRCODE = 'VR011';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_conversation_ad() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER validate_conversation_ad
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.validate_conversation_ad();
