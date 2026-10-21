-- Rumours are in the Realtime publication, so the cards' vote counts stay
-- live (issue #200). Realtime applies the table's RLS to each subscriber.
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(2);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND schemaname = 'public' AND tablename = 'rumours'),
  'rumours changes are published to Realtime'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.rumours'::regclass),
  'rumours keeps RLS, which Realtime applies to every subscriber'
);

SELECT * FROM finish();
ROLLBACK;
