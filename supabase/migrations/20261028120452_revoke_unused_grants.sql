-- Revoke table grants that no RLS policy uses (#267, defence in depth).
--
-- Left over from the baseline's GRANT ALL. RLS refuses these writes today,
-- because no policy allows them, but one permissive policy added later would
-- open them. Account deletion goes through delete_own_account() (SECURITY
-- DEFINER) and foreign-key cascades run as the table owner, so neither needs
-- them. authenticated keeps DELETE on classifieds: owners delete their ads.
-- The waitlist grants were already revoked in #271/#272. GRANT ALL on
-- Postgres 17 also gave MAINTAIN (VACUUM, ANALYZE, LOCK ...), which the API
-- never needs.
--
-- D-043: nothing on main uses these grants (the app's deletes are on
-- classifieds, blocked_users, conversation_archives and email_opt_outs; the
-- e2e cleanup uses the service role), so older code keeps working too.
--
-- Undo: GRANT INSERT, UPDATE, DELETE ON public.clubs TO anon, authenticated;
--       GRANT DELETE ON public.conversations, public.messages, public.profiles,
--         public.rumours TO anon, authenticated;
--       GRANT DELETE ON public.classifieds TO anon;
--       GRANT MAINTAIN ON public.classifieds, public.clubs, public.conversations,
--         public.messages, public.profiles, public.rumours, public.transfers
--         TO anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.clubs FROM anon, authenticated;

REVOKE DELETE ON public.conversations, public.messages, public.profiles,
  public.rumours FROM anon, authenticated;

REVOKE DELETE ON public.classifieds FROM anon;

REVOKE MAINTAIN ON public.classifieds, public.clubs, public.conversations,
  public.messages, public.profiles, public.rumours, public.transfers
  FROM anon, authenticated;
