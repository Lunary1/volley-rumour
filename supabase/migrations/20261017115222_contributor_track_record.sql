-- Contributor track record (#88, D-005, J-10, J-14).
--
-- Reputation describes accuracy, not popularity: "12 van 15 geruchten
-- bevestigd", counted on rumours a moderator resolved. Confirmed counts for,
-- denied against; expired ("Niet bevestigd"), pending, rejected and removed
-- rumours don't count. Votes stay a neutral belief signal and award nothing.
--
-- 1. profiles.rumours_confirmed and rumours_denied, recounted by a trigger on
--    rumours whenever a status or creator changes. This is the one place the
--    track record is calculated; every resolution path (resolve_rumour,
--    expire_open_rumours, delete_transfer reopening a rumour, takedowns,
--    reports, account deletion) goes through it.
-- 2. Votes count on the rumour only; they no longer move anyone's score.
-- 3. The trust points go: trust_score, total_votes_received, and the unused
--    xp and level, with the functions that changed them.
-- 4. trusted_sources(): "Betrouwbare bronnen", at least 5 resolved rumours,
--    ranked by accuracy.

-- ------------------------------------------------------- 1. track record

ALTER TABLE public.profiles
  ADD COLUMN rumours_confirmed integer NOT NULL DEFAULT 0
    CHECK (rumours_confirmed >= 0),
  ADD COLUMN rumours_denied integer NOT NULL DEFAULT 0
    CHECK (rumours_denied >= 0);

COMMENT ON COLUMN public.profiles.rumours_confirmed IS
  'Rumours by this user a moderator confirmed (D-005); kept by the recount_track_record trigger';
COMMENT ON COLUMN public.profiles.rumours_denied IS
  'Rumours by this user a moderator denied (D-005); kept by the recount_track_record trigger';

CREATE FUNCTION public.recount_track_record(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Lock the profile first. In READ COMMITTED, the UPDATE below takes a fresh
  -- snapshot after the lock, so it sees a resolution another moderator
  -- committed while we waited.
  PERFORM 1 FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN; -- the profile is being deleted
  END IF;

  UPDATE public.profiles
     SET rumours_confirmed = (SELECT count(*) FROM public.rumours
                               WHERE creator_id = p_profile_id
                                 AND status = 'confirmed'),
         rumours_denied = (SELECT count(*) FROM public.rumours
                            WHERE creator_id = p_profile_id
                              AND status = 'denied')
   WHERE id = p_profile_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recount_track_record(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.on_rumour_resolution_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_counts boolean := TG_OP <> 'INSERT'
    AND OLD.status IN ('confirmed', 'denied');
  v_new_counts boolean := TG_OP <> 'DELETE'
    AND NEW.status IN ('confirmed', 'denied');
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.creator_id IS NOT DISTINCT FROM NEW.creator_id
     AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NULL;
  END IF;

  IF v_new_counts AND NEW.creator_id IS NOT NULL THEN
    PERFORM public.recount_track_record(NEW.creator_id);
  END IF;
  IF v_old_counts AND OLD.creator_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR NOT v_new_counts
          OR OLD.creator_id IS DISTINCT FROM NEW.creator_id) THEN
    PERFORM public.recount_track_record(OLD.creator_id);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.on_rumour_resolution_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_rumour_resolution_change
  AFTER INSERT OR DELETE OR UPDATE OF status, creator_id ON public.rumours
  FOR EACH ROW EXECUTE FUNCTION public.on_rumour_resolution_change();

-- Existing resolved rumours, counted once.
SELECT public.recount_track_record(creator_id)
  FROM public.rumours
 WHERE creator_id IS NOT NULL AND status IN ('confirmed', 'denied')
 GROUP BY creator_id;

-- ------------------------------------------------- 2 and 3. votes, points

-- The same as #78's function, without the creator's score.
CREATE OR REPLACE FUNCTION public.recount_rumour_votes(p_rumour_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Lock the rumour first, so the counts below see every committed vote.
  PERFORM 1 FROM public.rumours WHERE id = p_rumour_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN; -- the rumour itself is being deleted
  END IF;

  UPDATE public.rumours
     SET votes_true = (SELECT count(*) FROM public.rumour_votes
                        WHERE rumour_id = p_rumour_id AND vote_type = true),
         votes_false = (SELECT count(*) FROM public.rumour_votes
                         WHERE rumour_id = p_rumour_id AND vote_type = false)
   WHERE id = p_rumour_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recount_rumour_votes(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.on_vote_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.recount_rumour_votes(NEW.rumour_id);
  END IF;
  IF TG_OP = 'DELETE'
     OR (TG_OP = 'UPDATE' AND OLD.rumour_id IS DISTINCT FROM NEW.rumour_id) THEN
    PERFORM public.recount_rumour_votes(OLD.rumour_id);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.on_vote_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER on_vote_change ON public.rumour_votes;
CREATE TRIGGER on_vote_change
  AFTER INSERT OR DELETE OR UPDATE ON public.rumour_votes
  FOR EACH ROW EXECUTE FUNCTION public.on_vote_change();

DROP FUNCTION public.update_creator_trust_score();
DROP FUNCTION public.increment_trust_score(uuid, integer);
DROP FUNCTION public.decrement_trust_score(uuid, integer);

-- Dropping a column drops its column-level grants too (#111).
ALTER TABLE public.profiles
  DROP COLUMN trust_score,
  DROP COLUMN total_votes_received,
  DROP COLUMN xp,
  DROP COLUMN level;

-- The track record is public (D-005). Every other readable column keeps the
-- grant from 20261014112118_hide_staff_roles.sql.
GRANT SELECT (rumours_confirmed, rumours_denied)
  ON public.profiles TO anon, authenticated;

-- ----------------------------------------------- 4. Betrouwbare bronnen

-- Ranked by the share of resolved rumours that were confirmed; at equal
-- accuracy, more resolved rumours rank higher. The minimum of 5 keeps one
-- lucky guess off the list. SECURITY INVOKER: the columns are public.
CREATE FUNCTION public.trusted_sources(p_limit integer DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  is_verified_source boolean,
  rumours_confirmed integer,
  rumours_denied integer
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT p.id, p.username, p.avatar_url, p.is_verified_source,
         p.rumours_confirmed, p.rumours_denied
    FROM public.profiles p
   WHERE p.rumours_confirmed + p.rumours_denied >= 5
   ORDER BY p.rumours_confirmed::numeric
              / (p.rumours_confirmed + p.rumours_denied) DESC,
            p.rumours_confirmed + p.rumours_denied DESC,
            p.username
   LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.trusted_sources(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trusted_sources(integer) TO anon, authenticated;
