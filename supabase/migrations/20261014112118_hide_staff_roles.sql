-- Hide who is staff (issue #111, D-006).
--
-- profiles is publicly readable (usernames, avatars, badges, scores), but
-- profiles.role would tell anyone which accounts are moderators. Postgres can't
-- hide a column with RLS, so the API roles get column-level SELECT on every
-- column except role.
--
-- Staff status is read through public.is_staff(), which only answers for the
-- caller. Staff pages that list other users' roles (#80) use a staff-checked
-- SECURITY DEFINER function, not this table.
--
-- A new column on profiles is NOT readable through the API until it is added
-- to this grant in its own migration.

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id,
  username,
  display_name,
  avatar_url,
  trust_score,
  total_votes_received,
  created_at,
  updated_at,
  xp,
  level,
  is_verified_source,
  instagram_url,
  source_description
) ON public.profiles TO anon, authenticated;
