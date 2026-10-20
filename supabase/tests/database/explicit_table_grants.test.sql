-- New tables get no API grants by default (issue #196), like production after
-- Supabase's change of 2026-10-30. Existing tables keep theirs.
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

-- ------------------------------------------------------- default privileges
SELECT is(
  (SELECT count(*)::int
     FROM pg_default_acl d
     JOIN pg_namespace n ON n.oid = d.defaclnamespace,
          aclexplode(d.defaclacl) a
    WHERE n.nspname = 'public'
      AND d.defaclrole = 'postgres'::regrole
      AND d.defaclobjtype IN ('r', 'S')
      AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)),
  0,
  'postgres hands out no default table or sequence privileges in public to the API roles'
);

-- ----------------------------------------------------------- a new table
CREATE TABLE public.grants_test (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY);

SELECT table_privs_are('public', 'grants_test', 'anon', ARRAY[]::text[],
  'a new table grants nothing to anon');
SELECT table_privs_are('public', 'grants_test', 'authenticated', ARRAY[]::text[],
  'a new table grants nothing to authenticated');
SELECT table_privs_are('public', 'grants_test', 'service_role', ARRAY[]::text[],
  'a new table grants nothing to service_role');
SELECT sequence_privs_are('public', 'grants_test_id_seq', 'service_role', ARRAY[]::text[],
  'a new sequence grants nothing to service_role');

-- An explicit grant is what makes it reachable.
GRANT SELECT ON public.grants_test TO authenticated;
SELECT table_privs_are('public', 'grants_test', 'authenticated', ARRAY['SELECT'],
  'an explicit grant gives exactly that privilege');

-- -------------------------------------------------------- existing tables
SELECT ok(has_table_privilege('authenticated', 'public.rumours', 'SELECT'),
  'existing tables keep their grants: rumours for authenticated');
SELECT ok(has_table_privilege('service_role', 'public.reports', 'SELECT'),
  'existing tables keep their grants: reports for service_role');
SELECT ok(has_table_privilege('service_role', 'public.error_events', 'INSERT'),
  'existing tables keep their grants: error_events for service_role');

SELECT * FROM finish();
ROLLBACK;
