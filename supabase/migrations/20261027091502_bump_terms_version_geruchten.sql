-- #256: the Geruchten section of the terms in everyday Dutch, like the rumour
-- form (D-052), with the same meaning (version of 27 October 2026). Every user
-- accepts the new version once, on /welkom (#75). Same date as on /voorwaarden.
CREATE OR REPLACE FUNCTION public.current_terms_version()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT '2026-10-27'
$$;
