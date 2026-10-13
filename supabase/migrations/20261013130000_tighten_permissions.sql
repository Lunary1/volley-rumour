-- Least-privilege permissions for the public API (issue #34).
--
-- RLS decides which rows a user may touch; column privileges decide which
-- columns. Users keep exactly the writes the app performs today. Everything
-- else (roles, scores, statuses, featured flags, vote counts) is written only
-- by the service role or by SECURITY DEFINER triggers.

-- ---------------------------------------------------------------------------
-- 1. Table privileges no API role needs
-- ---------------------------------------------------------------------------
-- TRUNCATE, REFERENCES and TRIGGER are Supabase defaults that the app never uses.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. profiles: users edit their public profile fields only
-- ---------------------------------------------------------------------------
-- role, trust_score, total_votes_received, xp, level, is_verified_source,
-- instagram_url and source_description are managed by staff / the server.
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT INSERT (id, username, display_name, avatar_url) ON public.profiles TO authenticated;
GRANT UPDATE (username, display_name, avatar_url, updated_at) ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. rumours: users create rumours; status, votes and featuring are server-side
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON public.rumours FROM anon, authenticated;
GRANT INSERT (creator_id, player_name, from_club_id, to_club_id, from_club_name, to_club_name, description, category)
  ON public.rumours TO authenticated;

-- There is no edit flow for rumours. Editing returns with moderation (D-002),
-- through a server action.
DROP POLICY IF EXISTS "Users can update own rumours" ON public.rumours;

-- ---------------------------------------------------------------------------
-- 4. transfers: created only when staff confirm a rumour (service role)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "transfers_insert_for_auth" ON public.transfers;
REVOKE INSERT, UPDATE, DELETE ON public.transfers FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. classifieds: owners manage their ad; featuring is server-side
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON public.classifieds FROM anon, authenticated;
GRANT INSERT (user_id, type, title, description, contact_name, contact_email, team_name, position, province, division, is_active)
  ON public.classifieds TO authenticated;
GRANT UPDATE (title, description, contact_name, contact_email, team_name, position, province, division, is_active, updated_at)
  ON public.classifieds TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. conversations: participants may archive and bump the timestamp
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON public.conversations FROM anon, authenticated;
GRANT INSERT (ad_id, ad_type, initiator_id, recipient_id) ON public.conversations TO authenticated;
GRANT UPDATE (is_archived, updated_at) ON public.conversations TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. messages: content is immutable; only the recipient marks it as read
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON public.messages FROM anon, authenticated;
GRANT INSERT (conversation_id, sender_id, content, contact_shared) ON public.messages TO authenticated;
GRANT UPDATE (is_read, read_at) ON public.messages TO authenticated;

DROP POLICY IF EXISTS "Users can update read status of their messages" ON public.messages;
CREATE POLICY "Recipients can mark messages as read" ON public.messages
  FOR UPDATE
  USING (
    sender_id <> (SELECT auth.uid())
    AND conversation_id IN (
      SELECT c.id FROM public.conversations c
      WHERE (SELECT auth.uid()) = c.initiator_id OR (SELECT auth.uid()) = c.recipient_id
    )
  )
  WITH CHECK (
    sender_id <> (SELECT auth.uid())
    AND conversation_id IN (
      SELECT c.id FROM public.conversations c
      WHERE (SELECT auth.uid()) = c.initiator_id OR (SELECT auth.uid()) = c.recipient_id
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Functions
-- ---------------------------------------------------------------------------
-- Trust-score helpers and trigger functions are server-only. Triggers keep
-- working: EXECUTE is checked when a trigger is created, not when it fires.
REVOKE EXECUTE ON FUNCTION public.increment_trust_score(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_trust_score(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_creator_trust_score() FROM PUBLIC, anon, authenticated;

-- Unused, and they reference columns that don't exist.
DROP FUNCTION IF EXISTS public.increment_upvotes(uuid);
DROP FUNCTION IF EXISTS public.increment_downvotes(uuid);

-- Pin search_path on the remaining SECURITY DEFINER functions (bodies use
-- schema-qualified names). get_interest_count stays callable: the coming-soon
-- page uses it.
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.get_interest_count() SET search_path = '';
