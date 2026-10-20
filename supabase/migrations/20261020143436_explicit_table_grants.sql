-- New tables get no API grants by default (#196).
--
-- On 2026-10-30 Supabase stops granting anon, authenticated and service_role
-- access to new tables and sequences in public on existing projects
-- (https://github.com/orgs/supabase/discussions/45329). The baseline, a dump
-- of production, turns those default grants on, and every db reset and CI run
-- replays it. Without this migration a new table would get grants in local
-- and CI but not in production, so a forgotten GRANT would only fail there.
--
-- From here on, every new table grants explicitly to each role that needs
-- it, service_role included (the admin client). Existing tables keep their
-- grants: default privileges only apply to objects created later. Functions
-- are left as they are; SECURITY DEFINER functions already revoke EXECUTE
-- themselves.
--
-- In production this does what Supabase does on 2026-10-30, so pushing it
-- after that date changes nothing.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
