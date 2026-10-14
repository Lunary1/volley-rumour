-- Suspensions, the verified badge and the moderator role (issue #80, J-15,
-- D-001, D-006, D-016).
--
--   admin ──suspend_user()────────→ read-only until a date, or until lifted
--         ──lift_suspension()─────→ back to normal
--         ──set_verified_source()─→ badge on or off
--         ──set_moderator()───────→ role user ⇄ moderator
--
-- All four are for admins only (D-016). Moderators see users and their status
-- in /admin/gebruikers but change nothing. Each function checks the caller,
-- does the change and writes the audit log entry in one transaction (#64).
--
-- A suspended user can still log in and read. The database refuses their
-- writes: rumours, votes, messages, new conversations, new or edited
-- zoekertjes and profile edits. They can still report, block, delete their own
-- zoekertjes and delete their account. Their existing content stays up.
--
-- Errors the app translates (lib/users.ts):
--   42501  not an admin (or, for the lists, not staff)
--   P0002  user not found
--   VR005  the signed-in user is suspended (any blocked write)
--   VR006  not allowed on this user: yourself, staff, or an admin's role
--   VR007  nothing to change: already in that state
--   22023  invalid input

-- ---------------------------------------------------------------------------
-- Who is an admin
-- ---------------------------------------------------------------------------
-- Like is_staff() (#63): answers for the caller only, so the admin area can
-- show the admin controls without making roles readable (#111).
CREATE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'True when the signed-in user is an admin (D-006, D-016). Admins suspend users and manage badges and roles.';

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- New audit log entries
-- ---------------------------------------------------------------------------
-- user_suspended, user_unsuspended and role_changed exist since #64.
ALTER TABLE public.staff_actions DROP CONSTRAINT staff_actions_action_check;
ALTER TABLE public.staff_actions ADD CONSTRAINT staff_actions_action_check
  CHECK (action IN (
    'rumour_approved',
    'rumour_rejected',
    'rumour_resolved',
    'content_removed',
    'takedown_rejected',
    'report_dismissed',
    'report_action_taken',
    'conversation_viewed',
    'user_suspended',
    'user_unsuspended',
    'role_changed',
    'badge_granted',
    'badge_revoked'
  ));

-- ---------------------------------------------------------------------------
-- Suspensions
-- ---------------------------------------------------------------------------
-- One row per user: their current or last suspension. Lifting deletes the
-- row; a suspension that runs out stays until the next one replaces it. The
-- history is in the audit log.
--
-- suspended_until NULL means until an admin lifts it (D-016).
--
-- The row goes with the profile when the account is deleted.
CREATE TABLE public.user_suspensions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  suspended_until timestamptz,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_suspensions IS
  'Current or last suspension per user (#80). Written by suspend_user() and lift_suspension(); the user and staff can read it.';

ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_suspensions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.user_suspensions TO service_role;
GRANT SELECT ON public.user_suspensions TO authenticated;

-- The user reads their own row to see the notice and the reason; staff read
-- every row. Nobody else learns who is suspended.
CREATE POLICY "Users read their own suspension, staff read all" ON public.user_suspensions
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_staff())
  );

-- ---------------------------------------------------------------------------
-- Suspended users are read-only
-- ---------------------------------------------------------------------------
-- Checks the caller, not the row: a suspended user can't write, and others
-- can still write about or to them. Only writes through the API are checked;
-- moderation functions, triggers and the service role run as other roles.
-- SECURITY INVOKER on purpose: RLS lets the caller read their own row.
--
-- The trigger is named so it fires before the other BEFORE triggers on the
-- same table (they fire in name order), e.g. check_new_rumour.
CREATE FUNCTION public.check_account_not_suspended()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'authenticated' AND EXISTS (
    SELECT 1
    FROM public.user_suspensions
    WHERE user_id = (SELECT auth.uid())
      AND (suspended_until IS NULL OR suspended_until > now())
  ) THEN
    RAISE EXCEPTION 'account is suspended'
      USING ERRCODE = 'VR005';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_account_not_suspended() FROM PUBLIC, anon, authenticated;

-- Posting
CREATE TRIGGER check_account_not_suspended
  BEFORE INSERT ON public.rumours
  FOR EACH ROW EXECUTE FUNCTION public.check_account_not_suspended();
CREATE TRIGGER check_account_not_suspended
  BEFORE INSERT OR UPDATE ON public.classifieds
  FOR EACH ROW EXECUTE FUNCTION public.check_account_not_suspended();
-- Voting, including changing or withdrawing a vote
CREATE TRIGGER check_account_not_suspended
  BEFORE INSERT OR UPDATE OR DELETE ON public.rumour_votes
  FOR EACH ROW EXECUTE FUNCTION public.check_account_not_suspended();
-- Messaging. Reading, marking as read and archiving stay allowed.
CREATE TRIGGER check_account_not_suspended
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.check_account_not_suspended();
CREATE TRIGGER check_account_not_suspended
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.check_account_not_suspended();
-- Profile edits: no switching to an offensive username while suspended.
CREATE TRIGGER check_account_not_suspended
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_account_not_suspended();

-- ---------------------------------------------------------------------------
-- Suspend and lift
-- ---------------------------------------------------------------------------
-- Suspending a user who is already suspended replaces the suspension (a new
-- end date or reason). Staff can't be suspended: take the role away first.
CREATE FUNCTION public.suspend_user(
  p_user_id uuid,
  p_until timestamptz,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reason text := NULLIF(btrim(p_reason), '');
  target_role text;
  previous public.user_suspensions%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'only admins can suspend users' USING ERRCODE = '42501';
  END IF;
  IF reason IS NULL OR char_length(reason) > 500 THEN
    RAISE EXCEPTION 'a suspension needs a reason' USING ERRCODE = '22023';
  END IF;
  IF p_until IS NOT NULL AND p_until <= now() THEN
    RAISE EXCEPTION 'a suspension ends in the future' USING ERRCODE = '22023';
  END IF;

  -- The row lock makes a concurrent role change wait.
  SELECT role INTO target_role FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_user_id = (SELECT auth.uid()) OR target_role <> 'user' THEN
    RAISE EXCEPTION 'staff cannot be suspended' USING ERRCODE = 'VR006';
  END IF;

  SELECT * INTO previous FROM public.user_suspensions WHERE user_id = p_user_id;

  INSERT INTO public.user_suspensions (user_id, suspended_until, reason)
  VALUES (p_user_id, p_until, reason)
  ON CONFLICT (user_id) DO UPDATE
    SET suspended_until = EXCLUDED.suspended_until,
        reason = EXCLUDED.reason,
        created_at = now();

  PERFORM public.log_staff_action(
    'user_suspended',
    'user',
    p_user_id,
    reason,
    -- 'until' is null for an indefinite suspension. 'replaced' says this
    -- changed a suspension that was still running.
    jsonb_build_object(
      'until', p_until,
      'replaced', previous.user_id IS NOT NULL
        AND (previous.suspended_until IS NULL OR previous.suspended_until > now())
    )
  );
END;
$$;

-- Ends an active suspension now. The note is optional, e.g. "na uitleg".
CREATE FUNCTION public.lift_suspension(
  p_user_id uuid,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'only admins can lift suspensions' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_suspensions
   WHERE user_id = p_user_id
     AND (suspended_until IS NULL OR suspended_until > now());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user is not suspended' USING ERRCODE = 'VR007';
  END IF;

  PERFORM public.log_staff_action(
    'user_unsuspended',
    'user',
    p_user_id,
    left(NULLIF(btrim(p_note), ''), 500)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Verified badge (D-001)
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.set_verified_source(
  p_user_id uuid,
  p_verified boolean,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'only admins can change badges' USING ERRCODE = '42501';
  END IF;
  IF p_verified IS NULL THEN
    RAISE EXCEPTION 'say whether the badge is on or off' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
     SET is_verified_source = p_verified, updated_at = now()
   WHERE id = p_user_id AND is_verified_source IS DISTINCT FROM p_verified;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'badge already in that state' USING ERRCODE = 'VR007';
  END IF;

  PERFORM public.log_staff_action(
    CASE WHEN p_verified THEN 'badge_granted' ELSE 'badge_revoked' END,
    'user',
    p_user_id,
    left(NULLIF(btrim(p_note), ''), 500)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Moderator role (D-006)
-- ---------------------------------------------------------------------------
-- Only user ⇄ moderator. Admins are made by the owner in SQL, and no admin
-- can change their own role or another admin's. A suspended user can't become
-- a moderator: lift the suspension first.
CREATE FUNCTION public.set_moderator(
  p_user_id uuid,
  p_moderator boolean,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_role_name text;
  new_role text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'only admins can change roles' USING ERRCODE = '42501';
  END IF;
  IF p_moderator IS NULL THEN
    RAISE EXCEPTION 'say whether the user is a moderator' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO current_role_name FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_user_id = (SELECT auth.uid()) OR current_role_name = 'admin' THEN
    RAISE EXCEPTION 'admin roles are set by the owner' USING ERRCODE = 'VR006';
  END IF;

  new_role := CASE WHEN p_moderator THEN 'moderator' ELSE 'user' END;
  IF current_role_name = new_role THEN
    RAISE EXCEPTION 'role already set' USING ERRCODE = 'VR007';
  END IF;
  IF p_moderator AND EXISTS (
    SELECT 1 FROM public.user_suspensions
     WHERE user_id = p_user_id
       AND (suspended_until IS NULL OR suspended_until > now())
  ) THEN
    RAISE EXCEPTION 'a suspended user cannot become a moderator' USING ERRCODE = 'VR006';
  END IF;

  UPDATE public.profiles SET role = new_role, updated_at = now() WHERE id = p_user_id;

  PERFORM public.log_staff_action(
    'role_changed',
    'user',
    p_user_id,
    left(NULLIF(btrim(p_note), ''), 500),
    jsonb_build_object('from', current_role_name, 'to', new_role)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Users as staff see them
-- ---------------------------------------------------------------------------
-- Roles aren't readable through the API (#111), so the staff pages read users
-- through these functions. Staff only; reading isn't logged (nothing private
-- beyond the role and the suspension).
--
-- p_filter: 'all', 'suspended' (active suspensions), 'staff' or 'verified'.
CREATE FUNCTION public.staff_list_users(
  p_search text DEFAULT NULL,
  p_filter text DEFAULT 'all'
)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz,
  role text,
  is_verified_source boolean,
  is_suspended boolean,
  suspended_until timestamptz,
  suspension_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  search text := lower(NULLIF(btrim(p_search), ''));
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can list users' USING ERRCODE = '42501';
  END IF;
  IF p_filter IS NULL OR p_filter NOT IN ('all', 'suspended', 'staff', 'verified') THEN
    RAISE EXCEPTION 'invalid filter' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
    SELECT p.id, p.username, p.display_name, p.avatar_url, p.created_at,
           p.role, p.is_verified_source,
           s.user_id IS NOT NULL, s.suspended_until, s.reason
      FROM public.profiles p
      LEFT JOIN public.user_suspensions s
        ON s.user_id = p.id
       AND (s.suspended_until IS NULL OR s.suspended_until > now())
     WHERE (search IS NULL
            OR strpos(lower(p.username), search) > 0
            OR strpos(lower(COALESCE(p.display_name, '')), search) > 0)
       AND CASE p_filter
             WHEN 'suspended' THEN s.user_id IS NOT NULL
             WHEN 'staff' THEN p.role IN ('moderator', 'admin')
             WHEN 'verified' THEN p.is_verified_source
             ELSE true
           END
     ORDER BY lower(p.username)
     LIMIT 100;
END;
$$;

CREATE FUNCTION public.staff_get_user(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz,
  role text,
  is_verified_source boolean,
  is_suspended boolean,
  suspended_until timestamptz,
  suspension_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can look up users' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT p.id, p.username, p.display_name, p.avatar_url, p.created_at,
           p.role, p.is_verified_source,
           s.user_id IS NOT NULL, s.suspended_until, s.reason
      FROM public.profiles p
      LEFT JOIN public.user_suspensions s
        ON s.user_id = p.id
       AND (s.suspended_until IS NULL OR s.suspended_until > now())
     WHERE p.id = p_user_id;
END;
$$;

-- Server actions and pages call these with the staff member's session; the
-- functions check the caller themselves.
REVOKE EXECUTE ON FUNCTION public.suspend_user(uuid, timestamptz, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lift_suspension(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_verified_source(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_moderator(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.staff_list_users(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.staff_get_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suspend_user(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lift_suspension(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_verified_source(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_moderator(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_list_users(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_get_user(uuid) TO authenticated;
