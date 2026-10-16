-- Per-user archive (#91, J-07): archiving a conversation hides it from my
-- inbox only. `conversations.is_archived` sat on the shared row, so it
-- archived for both participants; it is replaced by one row per user.
--
-- A new message from the other participant brings the conversation back to
-- the recipient's inbox, so an archived conversation never hides a reply.

CREATE TABLE public.conversation_archives (
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

COMMENT ON TABLE public.conversation_archives IS
  'Conversations a participant archived for themselves (#91). Unarchived by a new incoming message.';

CREATE INDEX idx_conversation_archives_user
  ON public.conversation_archives (user_id);

ALTER TABLE public.conversation_archives ENABLE ROW LEVEL SECURITY;

-- Only your own rows, and only for conversations you take part in.
CREATE POLICY "Participants read their own archive"
  ON public.conversation_archives FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Participants archive for themselves"
  ON public.conversation_archives FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = conversation_id
         AND (SELECT auth.uid()) IN (c.initiator_id, c.recipient_id)
    )
  );

CREATE POLICY "Participants unarchive for themselves"
  ON public.conversation_archives FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Suspended users may still archive (as before): it changes nothing anyone
-- else sees, so the table has no check_account_not_suspended trigger.
REVOKE ALL ON public.conversation_archives FROM anon, authenticated;
GRANT SELECT, DELETE ON public.conversation_archives TO authenticated;
GRANT INSERT (conversation_id, user_id) ON public.conversation_archives TO authenticated;

-- Keep what was archived: the shared flag archived for both participants.
INSERT INTO public.conversation_archives (conversation_id, user_id, archived_at)
SELECT c.id, p.user_id, c.updated_at
  FROM public.conversations c
 CROSS JOIN LATERAL (VALUES (c.initiator_id), (c.recipient_id)) AS p (user_id)
 WHERE c.is_archived;

-- Dropping the column drops its UPDATE grant. The "Users can archive their
-- conversations" policy stays: participants still bump updated_at.
ALTER TABLE public.conversations DROP COLUMN is_archived;

-- A new message brings the conversation back to the recipient's inbox.
CREATE FUNCTION public.unarchive_for_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.conversation_archives
   WHERE conversation_id = NEW.conversation_id
     AND user_id = NEW.recipient_id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unarchive_for_recipient() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER unarchive_for_recipient
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.unarchive_for_recipient();
