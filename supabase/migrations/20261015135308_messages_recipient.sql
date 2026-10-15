-- Realtime scoping (#74, X-5): every message names its recipient, so the
-- unread badge in the header can subscribe with a server-side filter
-- (`recipient_id=eq.<me>`) instead of to every message the user can see.

ALTER TABLE public.messages
  ADD COLUMN recipient_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE;

-- The recipient is the conversation participant who didn't send it.
UPDATE public.messages m
   SET recipient_id = CASE
         WHEN m.sender_id = c.initiator_id THEN c.recipient_id
         ELSE c.initiator_id
       END
  FROM public.conversations c
 WHERE c.id = m.conversation_id;

ALTER TABLE public.messages ALTER COLUMN recipient_id SET NOT NULL;

-- The badge counts a user's unread messages.
CREATE INDEX idx_messages_recipient_unread
  ON public.messages (recipient_id)
  WHERE is_read = false;

-- Set by the database, never by the sender: recipient_id is not in the
-- INSERT grant, and this trigger overwrites it anyway.
CREATE FUNCTION public.set_message_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  SELECT CASE
           WHEN NEW.sender_id = c.initiator_id THEN c.recipient_id
           ELSE c.initiator_id
         END
    INTO NEW.recipient_id
    FROM public.conversations c
   WHERE c.id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_message_recipient() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER set_message_recipient
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_message_recipient();
