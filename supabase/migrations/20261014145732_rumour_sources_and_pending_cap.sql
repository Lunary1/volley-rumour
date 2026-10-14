-- Rumours name a source and carry the author's declarations (issue #67, J-09,
-- X-8, D-003), and one author can have at most 5 waiting for a moderator
-- (#54, D-013).
--
-- New columns:
--   source_type, source_url   where the rumour comes from; public on the card
--   declared_good_faith       "ik deel dit te goeder trouw"
--   declared_senior           "gaat over een seniorspeler/-trainer" (D-003)
--   gender, from_division,    asked by the form since v0 but never stored
--   to_division
--
-- Older rumours have none of these, so the columns stay nullable. The rules
-- for new rumours live in a trigger on INSERT rather than in CHECK
-- constraints: a NOT VALID constraint would still be checked on every UPDATE,
-- and would then block votes on, and approval of, rumours without a source.

ALTER TABLE public.rumours
  ADD COLUMN source_type text CHECK (source_type IN (
    'own_observation',
    'player_or_trainer',
    'club',
    'media'
  )),
  ADD COLUMN source_url text CHECK (
    char_length(source_url) <= 500 AND source_url ~* '^https?://[^\s]+$'
  ),
  ADD COLUMN declared_good_faith boolean,
  ADD COLUMN declared_senior boolean,
  ADD COLUMN gender text CHECK (gender IN ('male', 'female')),
  ADD COLUMN from_division text CHECK (from_division IN (
    'liga_heren', 'liga_dames',
    'nat1_heren', 'nat2_heren', 'nat3_heren',
    'nat1_dames', 'nat2_dames', 'nat3_dames',
    'promo1_heren', 'promo2_heren', 'promo3_heren', 'promo4_heren',
    'promo1_dames', 'promo2_dames', 'promo3_dames', 'promo4_dames'
  )),
  ADD COLUMN to_division text CHECK (to_division IN (
    'liga_heren', 'liga_dames',
    'nat1_heren', 'nat2_heren', 'nat3_heren',
    'nat1_dames', 'nat2_dames', 'nat3_dames',
    'promo1_heren', 'promo2_heren', 'promo3_heren', 'promo4_heren',
    'promo1_dames', 'promo2_dames', 'promo3_dames', 'promo4_dames'
  ));

-- Authors write the new columns when they submit; nobody updates rumours
-- through the API (issue #34).
GRANT INSERT (source_type, source_url, declared_good_faith, declared_senior,
              gender, from_division, to_division)
  ON public.rumours TO authenticated;

-- ---------------------------------------------------------------------------
-- Rules for rumours submitted through the API
-- ---------------------------------------------------------------------------
-- Only inserts by signed-in users are checked; the seed and server-side tools
-- run as other roles. SECURITY INVOKER on purpose: current_user is the caller,
-- and RLS lets an author count their own pending rumours.
--
-- The cap error has its own SQLSTATE, so the app can show a clear message.
-- Keep MAX_PENDING_RUMOURS in lib/rumours.ts in sync with the 5 below.
CREATE FUNCTION public.check_new_rumour()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  pending_count integer;
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF NEW.source_type IS NULL THEN
    RAISE EXCEPTION 'a rumour needs a source type'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.declared_good_faith IS NOT TRUE OR NEW.declared_senior IS NOT TRUE THEN
    RAISE EXCEPTION 'a rumour needs both declarations'
      USING ERRCODE = '23514';
  END IF;

  -- Serialise one author's submissions, so two at once can't both slip
  -- under the cap.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pending_rumours:' || NEW.creator_id::text, 0)
  );
  SELECT count(*) INTO pending_count
    FROM public.rumours
   WHERE creator_id = NEW.creator_id AND status = 'pending';
  IF pending_count >= 5 THEN
    RAISE EXCEPTION 'too many pending rumours'
      USING ERRCODE = 'VR001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_new_rumour
  BEFORE INSERT ON public.rumours
  FOR EACH ROW EXECUTE FUNCTION public.check_new_rumour();

REVOKE EXECUTE ON FUNCTION public.check_new_rumour() FROM PUBLIC, anon, authenticated;
