-- The exact table and column grants of the API roles (issue #267). A new or
-- removed grant fails here until someone reviews it and updates the list.
-- Read with RLS: a grant only opens what a policy allows, but a grant no
-- policy uses waits for the first permissive policy, so keep none of those.
-- Run with `npm run db:test`.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(2);

-- ----------------------------------------------------------- table grants
SELECT results_eq(
  $$
    SELECT c.relname::text COLLATE "default", r.rolname::text COLLATE "default",
           string_agg(a.privilege_type, ',' ORDER BY a.privilege_type)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace,
           aclexplode(c.relacl) a
      JOIN pg_roles r ON r.oid = a.grantee
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
       AND r.rolname IN ('anon', 'authenticated')
     GROUP BY 1, 2
     ORDER BY 1, 2
  $$,
  $$
    VALUES
      ('blocked_users', 'authenticated', 'DELETE,SELECT'),
      ('classifieds', 'anon', 'SELECT'),
      ('classifieds', 'authenticated', 'DELETE,SELECT'),
      ('clubs', 'anon', 'SELECT'),
      ('clubs', 'authenticated', 'SELECT'),
      ('conversation_archives', 'authenticated', 'DELETE,SELECT'),
      ('conversations', 'anon', 'SELECT'),
      ('conversations', 'authenticated', 'SELECT'),
      ('email_opt_outs', 'authenticated', 'DELETE,SELECT'),
      ('error_events', 'authenticated', 'SELECT'),
      ('messages', 'anon', 'SELECT'),
      ('messages', 'authenticated', 'SELECT'),
      ('reports', 'authenticated', 'SELECT'),
      ('rumour_votes', 'authenticated', 'SELECT'),
      ('rumours', 'anon', 'SELECT'),
      ('rumours', 'authenticated', 'SELECT'),
      ('staff_actions', 'authenticated', 'SELECT'),
      ('terms_acceptances', 'authenticated', 'SELECT'),
      ('transfers', 'anon', 'SELECT'),
      ('transfers', 'authenticated', 'SELECT'),
      ('user_suspensions', 'authenticated', 'SELECT')
  $$,
  'anon and authenticated hold exactly these table grants'
);

-- ---------------------------------------------------------- column grants
SELECT results_eq(
  $$
    SELECT c.relname::text COLLATE "default", r.rolname::text COLLATE "default", a.privilege_type::text,
           string_agg(att.attname::text COLLATE "default", ',' ORDER BY att.attname)
      FROM pg_attribute att
      JOIN pg_class c ON c.oid = att.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace,
           aclexplode(att.attacl) a
      JOIN pg_roles r ON r.oid = a.grantee
     WHERE n.nspname = 'public'
       AND r.rolname IN ('anon', 'authenticated')
     GROUP BY 1, 2, 3
     ORDER BY 1, 2, 3
  $$,
  $$
    VALUES
      ('blocked_users', 'authenticated', 'INSERT', 'blocked_id,blocker_id'),
      ('classifieds', 'authenticated', 'INSERT',
        'contact_name,description,division,gender,is_active,position,province,team_name,title,trainer_diploma,type,user_id'),
      ('classifieds', 'authenticated', 'UPDATE',
        'contact_name,description,division,gender,is_active,position,province,team_name,title,trainer_diploma,updated_at'),
      ('contact_messages', 'authenticated', 'SELECT',
        'anonymised_at,category,created_at,handled_at,handled_note,id,message,sender_email,sender_name,status,user_id'),
      ('conversation_archives', 'authenticated', 'INSERT', 'conversation_id,user_id'),
      ('conversations', 'authenticated', 'INSERT', 'ad_id,ad_type,initiator_id,recipient_id'),
      ('conversations', 'authenticated', 'UPDATE', 'updated_at'),
      ('email_opt_outs', 'authenticated', 'INSERT', 'user_id'),
      ('messages', 'authenticated', 'INSERT', 'contact_shared,content,conversation_id,sender_id'),
      ('messages', 'authenticated', 'UPDATE', 'is_read,read_at'),
      ('profiles', 'anon', 'SELECT',
        'avatar_path,created_at,display_name,id,instagram_url,is_verified_source,rumours_confirmed,rumours_denied,source_description,updated_at,username'),
      ('profiles', 'authenticated', 'INSERT', 'avatar_path,display_name,id,username'),
      ('profiles', 'authenticated', 'SELECT',
        'avatar_path,created_at,display_name,id,instagram_url,is_verified_source,rumours_confirmed,rumours_denied,source_description,updated_at,username'),
      ('profiles', 'authenticated', 'UPDATE', 'avatar_path,display_name,updated_at,username'),
      ('rumour_votes', 'authenticated', 'INSERT', 'rumour_id,user_id,vote_type'),
      ('rumour_votes', 'authenticated', 'UPDATE', 'vote_type'),
      ('rumours', 'authenticated', 'INSERT',
        'category,creator_id,declared_good_faith,declared_senior,description,from_club_id,from_club_name,from_division,gender,player_name,source_type,source_url,to_club_id,to_club_name,to_division'),
      ('rumours', 'authenticated', 'UPDATE',
        'category,declared_good_faith,declared_senior,description,from_club_name,from_division,gender,player_name,source_type,source_url,to_club_name,to_division'),
      ('takedown_requests', 'authenticated', 'SELECT',
        'anonymised_at,created_at,decided_at,decision_note,explanation,id,reference,relation,requester_email,requester_name,rumour_id,status')
  $$,
  'anon and authenticated hold exactly these column grants'
);

SELECT * FROM finish();
ROLLBACK;
