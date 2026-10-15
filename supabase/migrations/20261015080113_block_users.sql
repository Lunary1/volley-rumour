-- Blocking (issue #73, J-07, D-018). A block stops new messages and new
-- conversations in both directions, enforced by the database rather than the
-- server action: RLS only shows a block to the user who made it, so the
-- sender could never see it.
--
-- Blocking is the user's own action, not a moderation step: nothing is
-- logged, and suspended users may still block and unblock (D-016).

-- ---------------------------------------------------------------------------
-- blocked_users: the blocker adds, reads and removes their own blocks
-- ---------------------------------------------------------------------------
-- Nobody blocks themselves. Rows like that do nothing, so they go.
DELETE FROM public.blocked_users WHERE blocker_id = blocked_id;
ALTER TABLE public.blocked_users
  ADD CONSTRAINT blocked_users_not_self CHECK (blocker_id <> blocked_id);

-- The baseline granted everything, also to anon, and had one policy for all
-- commands. A block is never edited: lift it and block again.
REVOKE ALL ON public.blocked_users FROM anon, authenticated;
GRANT SELECT, DELETE ON public.blocked_users TO authenticated;
GRANT INSERT (blocker_id, blocked_id) ON public.blocked_users TO authenticated;

DROP POLICY IF EXISTS "Users can manage their blocks" ON public.blocked_users;
CREATE POLICY "Users read their own blocks" ON public.blocked_users
  FOR SELECT TO authenticated
  USING (blocker_id = (SELECT auth.uid()));
CREATE POLICY "Users block for themselves" ON public.blocked_users
  FOR INSERT TO authenticated
  WITH CHECK (blocker_id = (SELECT auth.uid()));
CREATE POLICY "Users lift their own blocks" ON public.blocked_users
  FOR DELETE TO authenticated
  USING (blocker_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- No messages between users when either one blocked the other
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER: the sender can't read a block the other user made.
-- Applies to every insert, the service role's too. The trigger fires after
-- check_account_not_suspended (name order), so a suspended user hears that
-- first.
CREATE FUNCTION public.check_not_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sender uuid;
  other uuid;
BEGIN
  IF TG_TABLE_NAME = 'conversations' THEN
    sender := NEW.initiator_id;
    other := NEW.recipient_id;
  ELSE
    sender := NEW.sender_id;
    SELECT CASE WHEN c.initiator_id = NEW.sender_id THEN c.recipient_id ELSE c.initiator_id END
      INTO other
      FROM public.conversations c
     WHERE c.id = NEW.conversation_id;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.blocked_users b
     WHERE (b.blocker_id = sender AND b.blocked_id = other)
        OR (b.blocker_id = other AND b.blocked_id = sender)
  ) THEN
    RAISE EXCEPTION 'messaging between these users is blocked'
      USING ERRCODE = 'VR008';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_not_blocked() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER check_not_blocked
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.check_not_blocked();
CREATE TRIGGER check_not_blocked
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.check_not_blocked();

-- ---------------------------------------------------------------------------
-- Can I message this user?
-- ---------------------------------------------------------------------------
-- True when the caller blocked p_user_id or p_user_id blocked the caller, so
-- the conversation page shows a notice instead of a message box. It tells
-- the blocked user no more than a refused message would (J-07).
CREATE FUNCTION public.is_blocked_with(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.blocked_users b
     WHERE (b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = p_user_id)
        OR (b.blocker_id = p_user_id AND b.blocked_id = (SELECT auth.uid()))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_blocked_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked_with(uuid) TO authenticated;
