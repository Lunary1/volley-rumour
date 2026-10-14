-- New rumours wait for a moderator before anyone else can see them
-- (issue #65, D-002, X-1).
--
-- Lifecycle (Moderation Policy):
--   pending ──approve──→ rumour (lopend) ──→ confirmed / denied
--      └─────reject───→ rejected
--
-- Only rumour, confirmed and denied are public. A pending or rejected rumour
-- is visible to its author and to staff only. Approving and rejecting come
-- with the moderation queue (#66), as SECURITY DEFINER functions that log the
-- action.
--
-- Rumours that are already live stay live; only new rumours start pending.

ALTER TABLE public.rumours DROP CONSTRAINT rumours_status_check;
ALTER TABLE public.rumours ADD CONSTRAINT rumours_status_check
  CHECK (status IN ('pending', 'rumour', 'confirmed', 'denied', 'rejected'));

-- status isn't in the INSERT grant (issue #34), so every new rumour gets this
-- default and authors can't set or change it.
ALTER TABLE public.rumours ALTER COLUMN status SET DEFAULT 'pending';

DROP POLICY "Rumours are viewable by everyone" ON public.rumours;
CREATE POLICY "Public rumours, own rumours and staff" ON public.rumours
  FOR SELECT USING (
    status IN ('rumour', 'confirmed', 'denied')
    OR creator_id = (SELECT auth.uid())
    OR (SELECT public.is_staff())
  );
