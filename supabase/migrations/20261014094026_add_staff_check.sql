-- Staff check for the admin area and moderation policies (issue #63, D-006).
--
-- Staff are profiles with role 'moderator' or 'admin'. Users can't change
-- their own role: the column isn't in their UPDATE grant (issue #34), so roles
-- are set by the owner with the service role.
--
-- public.is_staff() answers one question: is the caller staff? It takes no
-- arguments, so it can't be used to look up someone else. SECURITY DEFINER so
-- RLS policies on profiles itself can call it without recursing.

CREATE FUNCTION public.is_staff()
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
      AND role IN ('moderator', 'admin')
  );
$$;

COMMENT ON FUNCTION public.is_staff() IS
  'True when the signed-in user is a moderator or admin (D-006). Used by the admin area and staff RLS policies.';

-- RLS policies are evaluated as the caller, so every API role that reads a
-- table with a staff policy needs EXECUTE. It only reveals the caller's own
-- status; for anon it is always false.
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated;
