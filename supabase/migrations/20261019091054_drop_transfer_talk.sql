-- #152: only zoekertjes start conversations (D-004, #82). The ad type
-- `transfer_talk` was still allowed, and validate_conversation_ad() only
-- checked `classified` rows, so a logged-in user could open a conversation
-- with anyone about any id by sending `transfer_talk` to the API.
--
-- Adding the constraint checks the existing rows: if production still has a
-- `transfer_talk` conversation, this migration fails and changes nothing.

ALTER TABLE public.conversations
  DROP CONSTRAINT conversations_ad_type_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_ad_type_check CHECK (ad_type = 'classified');

-- Every conversation is about a zoekertje now, so the check no longer needs
-- to look at the ad type.
CREATE OR REPLACE FUNCTION public.validate_conversation_ad()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT EXISTS (
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
