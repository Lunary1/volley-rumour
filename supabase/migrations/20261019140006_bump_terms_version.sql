-- #94: the terms were rewritten to match the site after M2 (version of
-- 19 October 2026). Every user accepts the new version once, on /welkom (#75).
-- Same date as on /voorwaarden.
CREATE OR REPLACE FUNCTION public.current_terms_version()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT '2026-10-19'
$$;
