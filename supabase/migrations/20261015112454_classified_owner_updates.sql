-- Owners edit, close ("gevonden") and delete their own zoekertjes (issue #72,
-- J-05, J-08).
--
-- The UPDATE and DELETE policies from the baseline already limit both to the
-- owner, and the column grants keep `type`, `user_id` and `removed_at` out of
-- reach. What's new: an ad a moderator removed (#69) can no longer be edited,
-- so its author can't rewrite what was reported. Deleting it stays allowed.
-- Suspended users can't edit but can still delete (D-016): the
-- check_account_not_suspended trigger fires on INSERT and UPDATE only.

DROP POLICY "Users can update own classifieds" ON public.classifieds;
CREATE POLICY "Users can update own classifieds" ON public.classifieds
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()) AND removed_at IS NULL)
  WITH CHECK (user_id = (SELECT auth.uid()) AND removed_at IS NULL);
