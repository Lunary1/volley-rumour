-- Email notifications (#98, D-025): a short, content-free email for a new
-- message and for a moderator's decision on your rumour. On by default; a row
-- in email_opt_outs turns them off. The app sends the emails; the functions
-- below decide who gets one and are only callable with the service role.

CREATE TABLE public.email_opt_outs (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_opt_outs IS
  'Users who turned email notifications off (#98). No row: notifications on.';

ALTER TABLE public.email_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own opt-out"
  ON public.email_opt_outs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users opt out for themselves"
  ON public.email_opt_outs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users opt back in for themselves"
  ON public.email_opt_outs FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Suspended users may still turn emails on or off: it changes nothing anyone
-- else sees, so the table has no check_account_not_suspended trigger.
REVOKE ALL ON public.email_opt_outs FROM anon, authenticated;
GRANT SELECT, DELETE ON public.email_opt_outs TO authenticated;
GRANT INSERT (user_id) ON public.email_opt_outs TO authenticated;

-- The address to tell about a new message, or null when no email is due:
-- - the recipient turned notifications off;
-- - the message was already read;
-- - the recipient already has another unread message in the conversation,
--   so one email covers a run of unread messages;
-- - the recipient was active in the conversation in the last 10 minutes
--   (sent or read a message there), so a live chat sends no emails.
CREATE FUNCTION public.message_notification_email(p_message_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.email::text
    FROM public.messages m
    JOIN auth.users u ON u.id = m.recipient_id
   WHERE m.id = p_message_id
     AND m.is_read IS NOT TRUE
     AND NOT EXISTS (
       SELECT 1 FROM public.email_opt_outs o WHERE o.user_id = m.recipient_id
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.messages e
        WHERE e.conversation_id = m.conversation_id
          AND e.recipient_id = m.recipient_id
          AND e.id <> m.id
          AND e.is_read IS NOT TRUE
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.messages a
        WHERE a.conversation_id = m.conversation_id
          AND (
            (a.sender_id = m.recipient_id
              AND a.created_at > now() - interval '10 minutes')
            OR (a.recipient_id = m.recipient_id
              AND a.read_at > now() - interval '10 minutes')
          )
     );
$$;

-- The address to tell about a decision on a rumour: its author's, unless
-- they turned notifications off or the author is gone.
CREATE FUNCTION public.rumour_notification_email(p_rumour_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.email::text
    FROM public.rumours r
    JOIN auth.users u ON u.id = r.creator_id
   WHERE r.id = p_rumour_id
     AND NOT EXISTS (
       SELECT 1 FROM public.email_opt_outs o WHERE o.user_id = r.creator_id
     );
$$;

REVOKE EXECUTE ON FUNCTION public.message_notification_email(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rumour_notification_email(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.message_notification_email(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rumour_notification_email(uuid) TO service_role;
