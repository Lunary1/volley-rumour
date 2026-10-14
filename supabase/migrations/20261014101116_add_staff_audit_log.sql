-- Audit log of staff actions (issue #64, D-006, D-011).
--
-- Every moderation action (approve, reject, remove, resolve, suspend, role
-- change) writes one row: who, what, when, target and reason. Staff can read
-- the log; nobody can edit or delete entries. Entries are kept 2 years (D-011)
-- and then removed by public.purge_expired_staff_actions().
--
-- actor_id and target_id have no foreign keys on purpose: the log must
-- survive deleting the account or content it is about. They are bare ids;
-- the admin area resolves usernames while they still exist.

CREATE TABLE public.staff_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'rumour_approved',
    'rumour_rejected',
    'rumour_resolved',
    'content_removed',
    'user_suspended',
    'user_unsuspended',
    'role_changed'
  )),
  target_type text NOT NULL CHECK (target_type IN (
    'rumour',
    'classified',
    'conversation',
    'message',
    'user'
  )),
  target_id uuid NOT NULL,
  reason text CHECK (char_length(reason) <= 2000),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.staff_actions IS
  'Append-only audit log of staff actions (#64). Written by public.log_staff_action(), kept 2 years (D-011).';

CREATE INDEX staff_actions_created_at_idx ON public.staff_actions (created_at DESC);
CREATE INDEX staff_actions_target_idx ON public.staff_actions (target_type, target_id);

-- ---------------------------------------------------------------------------
-- Access: staff read, nobody writes through the API
-- ---------------------------------------------------------------------------
ALTER TABLE public.staff_actions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.staff_actions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.staff_actions TO authenticated;

CREATE POLICY "Staff can read the audit log" ON public.staff_actions
  FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

-- ---------------------------------------------------------------------------
-- Append-only, also for the service role
-- ---------------------------------------------------------------------------
-- Only the retention purge may delete, and only expired rows; it sets
-- app.purging_staff_actions for its own transaction.
CREATE FUNCTION public.protect_staff_actions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('app.purging_staff_actions', true) = 'on'
     AND OLD.created_at < now() - interval '2 years' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'staff_actions is append-only'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER staff_actions_append_only
  BEFORE UPDATE OR DELETE ON public.staff_actions
  FOR EACH ROW EXECUTE FUNCTION public.protect_staff_actions();

CREATE FUNCTION public.protect_staff_actions_truncate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'staff_actions is append-only'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER staff_actions_no_truncate
  BEFORE TRUNCATE ON public.staff_actions
  FOR EACH STATEMENT EXECUTE FUNCTION public.protect_staff_actions_truncate();

REVOKE EXECUTE ON FUNCTION public.protect_staff_actions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_staff_actions_truncate() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Writing an entry
-- ---------------------------------------------------------------------------
-- Moderation functions (#65 onwards) call this in the same transaction as the
-- action itself, so an action is never done without its log entry. The actor
-- is always the caller. Not callable through the API: a log entry on its own
-- would be an action that never happened.
CREATE FUNCTION public.log_staff_action(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_reason text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entry_id uuid;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can log staff actions'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.staff_actions (actor_id, action, target_type, target_id, reason, details)
  VALUES ((SELECT auth.uid()), p_action, p_target_type, p_target_id, NULLIF(btrim(p_reason), ''), COALESCE(p_details, '{}'::jsonb))
  RETURNING id INTO entry_id;

  RETURN entry_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_staff_action(text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retention (D-011)
-- ---------------------------------------------------------------------------
-- Deletes entries older than 2 years and returns how many. Service role only;
-- to be scheduled before the first entries expire (2028).
CREATE FUNCTION public.purge_expired_staff_actions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  removed integer;
BEGIN
  PERFORM set_config('app.purging_staff_actions', 'on', true);
  DELETE FROM public.staff_actions WHERE created_at < now() - interval '2 years';
  GET DIAGNOSTICS removed = ROW_COUNT;
  PERFORM set_config('app.purging_staff_actions', 'off', true);
  RETURN removed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_staff_actions() FROM PUBLIC, anon, authenticated;
