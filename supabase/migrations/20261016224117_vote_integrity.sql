-- Vote integrity (#78, X-4, J-10).
--
-- 1. Counting. The on_vote_change trigger recounted from NEW.rumour_id, which
--    is null on DELETE, so a removed vote (an account deletion) never lowered
--    the counts. Two votes at once could also lose one: each recount ran on a
--    snapshot taken before the other vote committed. The new function locks
--    the rumour row first, so every recount sees every committed vote, and it
--    handles DELETE.
-- 2. Rules. No votes on your own rumour (VR009) and only on lopende rumours
--    (VR010): pending, rejected, removed and resolved (confirmed/denied) ones
--    are closed. Checked for API users only, like check_new_rumour(), so the
--    seed and the service role can still write any vote.
-- 3. Privacy. Votes were readable by everyone, anon included. Users now see
--    only their own votes; the totals stay on the rumour. Votes can be cast
--    and changed, not withdrawn: no flow deletes a vote, and withdrawing one
--    would change a resolved rumour's tally.
--
-- What the counts mean for reputation follows #47 (D-005); the trust-score
-- formula is unchanged.

-- ------------------------------------------------------------- 1. counting

CREATE OR REPLACE FUNCTION public.recount_rumour_votes(p_rumour_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_creator_id uuid;
BEGIN
  -- Lock the rumour first. In READ COMMITTED, the statements below take a
  -- fresh snapshot after the lock, so they count votes committed while we
  -- waited.
  SELECT creator_id INTO v_creator_id
    FROM public.rumours
   WHERE id = p_rumour_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN; -- the rumour itself is being deleted
  END IF;

  UPDATE public.rumours
     SET votes_true = (SELECT count(*) FROM public.rumour_votes
                        WHERE rumour_id = p_rumour_id AND vote_type = true),
         votes_false = (SELECT count(*) FROM public.rumour_votes
                         WHERE rumour_id = p_rumour_id AND vote_type = false)
   WHERE id = p_rumour_id;

  IF v_creator_id IS NULL THEN
    RETURN; -- the creator's account is gone
  END IF;

  -- The same for the creator: votes on their other rumours may be counting
  -- at the same time.
  PERFORM 1 FROM public.profiles WHERE id = v_creator_id FOR UPDATE;
  UPDATE public.profiles
     SET trust_score = (SELECT COALESCE(SUM(votes_true - votes_false), 0)
                          FROM public.rumours WHERE creator_id = v_creator_id),
         total_votes_received = (SELECT COALESCE(SUM(votes_true + votes_false), 0)
                                   FROM public.rumours WHERE creator_id = v_creator_id)
   WHERE id = v_creator_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recount_rumour_votes(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_creator_trust_score()
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

REVOKE EXECUTE ON FUNCTION public.update_creator_trust_score() FROM PUBLIC, anon, authenticated;

-- Counts that missed a deleted vote are fixed once here.
SELECT public.recount_rumour_votes(id) FROM public.rumours;

-- ---------------------------------------------------------------- 2. rules

CREATE FUNCTION public.check_vote_allowed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_rumour record;
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- As the voter: a rumour they can't see is as closed as a resolved one.
  SELECT creator_id, status INTO v_rumour
    FROM public.rumours
   WHERE id = NEW.rumour_id;

  IF v_rumour.creator_id = NEW.user_id THEN
    RAISE EXCEPTION 'you cannot vote on your own rumour'
      USING ERRCODE = 'VR009';
  END IF;
  IF v_rumour.status IS DISTINCT FROM 'rumour' THEN
    RAISE EXCEPTION 'voting on this rumour is closed'
      USING ERRCODE = 'VR010';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_vote_allowed() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER check_vote_allowed
  BEFORE INSERT OR UPDATE ON public.rumour_votes
  FOR EACH ROW EXECUTE FUNCTION public.check_vote_allowed();

-- -------------------------------------------------------------- 3. privacy

DROP POLICY "Votes are viewable by everyone" ON public.rumour_votes;
DROP POLICY "Users can delete own votes" ON public.rumour_votes;
DROP POLICY "Authenticated users can vote" ON public.rumour_votes;
DROP POLICY "Users can update own votes" ON public.rumour_votes;

CREATE POLICY "Users read their own votes"
  ON public.rumour_votes FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users cast their own votes"
  ON public.rumour_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users change their own votes"
  ON public.rumour_votes FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.rumour_votes FROM anon, authenticated;
GRANT SELECT ON public.rumour_votes TO authenticated;
GRANT INSERT (rumour_id, user_id, vote_type) ON public.rumour_votes TO authenticated;
GRANT UPDATE (vote_type) ON public.rumour_votes TO authenticated;
