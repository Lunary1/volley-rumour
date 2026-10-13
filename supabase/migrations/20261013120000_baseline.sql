-- Baseline: production schema of volleyrumours.be as of 2026-10-13.
--
-- Generated with `supabase db dump --linked --schema public` from project
-- qaejtjgfkggcbgajmfcn, plus the objects a public-schema dump leaves out
-- (auth trigger and Realtime publication, at the end of this file).
--
-- It replaces the 37 migrations applied to production between 2026-01-23 and
-- 2026-02-19 and the tables created before migration tracking. Do not edit:
-- change the schema with new migrations on top of this one.



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."decrement_trust_score"("profile_uuid" "uuid", "points_to_remove" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE profiles SET trust_score = GREATEST(0, trust_score - points_to_remove) WHERE id = profile_uuid;
END;
$$;


ALTER FUNCTION "public"."decrement_trust_score"("profile_uuid" "uuid", "points_to_remove" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_interest_count"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    (SELECT count(*)::int FROM public.profiles) +
    (SELECT count(*)::int FROM public.waitlist_subscribers);
$$;


ALTER FUNCTION "public"."get_interest_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  generated_username text;
  base_username text;
BEGIN
  -- Get username from metadata (email/password signup) or generate from email (OAuth)
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );

  -- Sanitise: lowercase, replace non-alphanumeric with underscore, trim underscores
  base_username := lower(regexp_replace(base_username, '[^a-zA-Z0-9_]', '_', 'g'));
  base_username := trim(BOTH '_' FROM base_username);

  -- Fallback if the result is empty
  IF base_username = '' OR base_username IS NULL THEN
    base_username := 'gebruiker';
  END IF;

  -- Ensure uniqueness by appending random suffix if needed
  generated_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = generated_username) LOOP
    generated_username := base_username || '_' || substr(md5(random()::text), 1, 4);
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    generated_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', generated_username),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_downvotes"("rumour_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE rumours SET downvotes = downvotes + 1 WHERE id = rumour_uuid;
END;
$$;


ALTER FUNCTION "public"."increment_downvotes"("rumour_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_trust_score"("profile_uuid" "uuid", "points_to_add" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE profiles SET trust_score = trust_score + points_to_add WHERE id = profile_uuid;
END;
$$;


ALTER FUNCTION "public"."increment_trust_score"("profile_uuid" "uuid", "points_to_add" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_upvotes"("rumour_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE rumours SET upvotes = upvotes + 1 WHERE id = rumour_uuid;
END;
$$;


ALTER FUNCTION "public"."increment_upvotes"("rumour_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_creator_trust_score"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Update the rumour vote counts
  UPDATE rumours
  SET 
    votes_true = (SELECT COUNT(*) FROM rumour_votes WHERE rumour_id = NEW.rumour_id AND vote_type = true),
    votes_false = (SELECT COUNT(*) FROM rumour_votes WHERE rumour_id = NEW.rumour_id AND vote_type = false)
  WHERE id = NEW.rumour_id;
  
  -- Update creator's trust score
  UPDATE profiles
  SET 
    trust_score = (
      SELECT COALESCE(SUM(votes_true - votes_false), 0)
      FROM rumours
      WHERE creator_id = (SELECT creator_id FROM rumours WHERE id = NEW.rumour_id)
    ),
    total_votes_received = (
      SELECT COALESCE(SUM(votes_true + votes_false), 0)
      FROM rumours
      WHERE creator_id = (SELECT creator_id FROM rumours WHERE id = NEW.rumour_id)
    )
  WHERE id = (SELECT creator_id FROM rumours WHERE id = NEW.rumour_id);
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_creator_trust_score"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."blocked_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."blocked_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classifieds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "contact_name" "text" NOT NULL,
    "contact_email" "text",
    "team_name" "text",
    "position" "text",
    "province" "text",
    "division" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_featured" boolean DEFAULT false,
    "featured_until" timestamp with time zone,
    CONSTRAINT "classifieds_type_check" CHECK (("type" = ANY (ARRAY['team_seeks_trainer'::"text", 'team_seeks_player'::"text", 'player_seeks_team'::"text", 'trainer_seeks_team'::"text"])))
);


ALTER TABLE "public"."classifieds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "province" "text",
    "division" "text",
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clubs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ad_id" "uuid" NOT NULL,
    "ad_type" "text" NOT NULL,
    "initiator_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false,
    CONSTRAINT "conversations_ad_type_check" CHECK (("ad_type" = ANY (ARRAY['transfer_talk'::"text", 'classified'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deletion_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id_hash" "text" NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auth_provider" "text"
);


ALTER TABLE "public"."deletion_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "contact_shared" "jsonb",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "read_at" timestamp with time zone
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "trust_score" integer DEFAULT 0,
    "total_votes_received" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "xp" integer DEFAULT 0 NOT NULL,
    "level" integer DEFAULT 1 NOT NULL,
    "is_verified_source" boolean DEFAULT false NOT NULL,
    "instagram_url" "text",
    "source_description" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'moderator'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."role" IS 'User role: user (default), moderator (can confirm rumors), admin (full access)';



COMMENT ON COLUMN "public"."profiles"."xp" IS 'Total experience points for level progression';



COMMENT ON COLUMN "public"."profiles"."level" IS 'Current level (derived from xp, kept in sync by app)';



CREATE TABLE IF NOT EXISTS "public"."reported_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reported_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rumour_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rumour_id" "uuid",
    "user_id" "uuid",
    "vote_type" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rumour_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rumours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid",
    "player_name" "text" NOT NULL,
    "from_club_id" "uuid",
    "to_club_id" "uuid",
    "from_club_name" "text",
    "to_club_name" "text",
    "description" "text",
    "category" "text" NOT NULL,
    "status" "text" DEFAULT 'rumour'::"text",
    "votes_true" integer DEFAULT 0,
    "votes_false" integer DEFAULT 0,
    "is_featured" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "rumours_category_check" CHECK (("category" = ANY (ARRAY['transfer'::"text", 'trainer_transfer'::"text", 'player_retirement'::"text", 'trainer_retirement'::"text"]))),
    CONSTRAINT "rumours_status_check" CHECK (("status" = ANY (ARRAY['rumour'::"text", 'confirmed'::"text", 'denied'::"text"])))
);


ALTER TABLE "public"."rumours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_name" "text" NOT NULL,
    "from_club" "text",
    "to_club" "text",
    "category" "text" NOT NULL,
    "province" "text",
    "division" "text",
    "position" "text",
    "source_rumour_id" "uuid",
    "confirmed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_featured" boolean DEFAULT false,
    "featured_until" timestamp with time zone,
    CONSTRAINT "transfers_category_check" CHECK (("category" = ANY (ARRAY['player_male'::"text", 'player_female'::"text", 'trainer_male'::"text", 'trainer_female'::"text", 'player_retirement'::"text", 'trainer_retirement'::"text"])))
);


ALTER TABLE "public"."transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "subscribed_at" timestamp with time zone DEFAULT "now"(),
    "source" "text" DEFAULT 'coming_soon'::"text",
    "ip_hash" "text"
);


ALTER TABLE "public"."waitlist_subscribers" OWNER TO "postgres";


ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocker_id_blocked_id_key" UNIQUE ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classifieds"
    ADD CONSTRAINT "classifieds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_ad_id_initiator_id_recipient_id_key" UNIQUE ("ad_id", "initiator_id", "recipient_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deletion_audit_log"
    ADD CONSTRAINT "deletion_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."reported_conversations"
    ADD CONSTRAINT "reported_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rumour_votes"
    ADD CONSTRAINT "rumour_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rumour_votes"
    ADD CONSTRAINT "rumour_votes_rumour_id_user_id_key" UNIQUE ("rumour_id", "user_id");



ALTER TABLE ONLY "public"."rumours"
    ADD CONSTRAINT "rumours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transfers"
    ADD CONSTRAINT "transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist_subscribers"
    ADD CONSTRAINT "waitlist_subscribers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."waitlist_subscribers"
    ADD CONSTRAINT "waitlist_subscribers_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_blocked_users_blocked" ON "public"."blocked_users" USING "btree" ("blocked_id");



CREATE INDEX "idx_blocked_users_blocker" ON "public"."blocked_users" USING "btree" ("blocker_id");



CREATE INDEX "idx_classifieds_user_id" ON "public"."classifieds" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_initiator" ON "public"."conversations" USING "btree" ("initiator_id", "updated_at" DESC);



CREATE INDEX "idx_conversations_recipient" ON "public"."conversations" USING "btree" ("recipient_id", "updated_at" DESC);



CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_messages_sender" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE OR REPLACE TRIGGER "on_vote_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."rumour_votes" FOR EACH ROW EXECUTE FUNCTION "public"."update_creator_trust_score"();



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classifieds"
    ADD CONSTRAINT "classifieds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reported_conversations"
    ADD CONSTRAINT "reported_conversations_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reported_conversations"
    ADD CONSTRAINT "reported_conversations_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rumour_votes"
    ADD CONSTRAINT "rumour_votes_rumour_id_fkey" FOREIGN KEY ("rumour_id") REFERENCES "public"."rumours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rumour_votes"
    ADD CONSTRAINT "rumour_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rumours"
    ADD CONSTRAINT "rumours_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rumours"
    ADD CONSTRAINT "rumours_from_club_id_fkey" FOREIGN KEY ("from_club_id") REFERENCES "public"."clubs"("id");



ALTER TABLE ONLY "public"."rumours"
    ADD CONSTRAINT "rumours_to_club_id_fkey" FOREIGN KEY ("to_club_id") REFERENCES "public"."clubs"("id");



ALTER TABLE ONLY "public"."transfers"
    ADD CONSTRAINT "transfers_source_rumour_id_fkey" FOREIGN KEY ("source_rumour_id") REFERENCES "public"."rumours"("id");



CREATE POLICY "Anyone can subscribe" ON "public"."waitlist_subscribers" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Authenticated users can create classifieds" ON "public"."classifieds" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Authenticated users can create rumours" ON "public"."rumours" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "creator_id"));



CREATE POLICY "Authenticated users can vote" ON "public"."rumour_votes" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Classifieds are viewable by everyone" ON "public"."classifieds" FOR SELECT USING (true);



CREATE POLICY "Clubs are viewable by everyone" ON "public"."clubs" FOR SELECT USING (true);



CREATE POLICY "Only service role can read" ON "public"."waitlist_subscribers" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Rumours are viewable by everyone" ON "public"."rumours" FOR SELECT USING (true);



CREATE POLICY "Transfers are viewable by everyone" ON "public"."transfers" FOR SELECT USING (true);



CREATE POLICY "Users can archive their conversations" ON "public"."conversations" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") = "initiator_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id")));



CREATE POLICY "Users can create conversations" ON "public"."conversations" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "initiator_id"));



CREATE POLICY "Users can delete own classifieds" ON "public"."classifieds" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete own votes" ON "public"."rumour_votes" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert messages in their conversations" ON "public"."messages" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "sender_id") AND ("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE ((( SELECT "auth"."uid"() AS "uid") = "conversations"."initiator_id") OR (( SELECT "auth"."uid"() AS "uid") = "conversations"."recipient_id"))))));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can manage their blocks" ON "public"."blocked_users" USING ((( SELECT "auth"."uid"() AS "uid") = "blocker_id"));



CREATE POLICY "Users can report conversations" ON "public"."reported_conversations" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "reporter_id"));



CREATE POLICY "Users can update own classifieds" ON "public"."classifieds" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update own rumours" ON "public"."rumours" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "creator_id"));



CREATE POLICY "Users can update own votes" ON "public"."rumour_votes" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update read status of their messages" ON "public"."messages" FOR UPDATE USING (("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE ((( SELECT "auth"."uid"() AS "uid") = "conversations"."initiator_id") OR (( SELECT "auth"."uid"() AS "uid") = "conversations"."recipient_id")))));



CREATE POLICY "Users can view messages in their conversations" ON "public"."messages" FOR SELECT USING (("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE ((( SELECT "auth"."uid"() AS "uid") = "conversations"."initiator_id") OR (( SELECT "auth"."uid"() AS "uid") = "conversations"."recipient_id")))));



CREATE POLICY "Users can view their conversations" ON "public"."conversations" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "initiator_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id")));



CREATE POLICY "Votes are viewable by everyone" ON "public"."rumour_votes" FOR SELECT USING (true);



ALTER TABLE "public"."blocked_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classifieds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clubs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deletion_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reported_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rumour_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rumours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transfers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transfers_insert_for_auth" ON "public"."transfers" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



ALTER TABLE "public"."waitlist_subscribers" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_trust_score"("profile_uuid" "uuid", "points_to_remove" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_trust_score"("profile_uuid" "uuid", "points_to_remove" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_trust_score"("profile_uuid" "uuid", "points_to_remove" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_interest_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_interest_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_interest_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_downvotes"("rumour_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_downvotes"("rumour_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_downvotes"("rumour_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_trust_score"("profile_uuid" "uuid", "points_to_add" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_trust_score"("profile_uuid" "uuid", "points_to_add" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_trust_score"("profile_uuid" "uuid", "points_to_add" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_upvotes"("rumour_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_upvotes"("rumour_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_upvotes"("rumour_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_creator_trust_score"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_creator_trust_score"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_creator_trust_score"() TO "service_role";



GRANT ALL ON TABLE "public"."blocked_users" TO "anon";
GRANT ALL ON TABLE "public"."blocked_users" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_users" TO "service_role";



GRANT ALL ON TABLE "public"."classifieds" TO "anon";
GRANT ALL ON TABLE "public"."classifieds" TO "authenticated";
GRANT ALL ON TABLE "public"."classifieds" TO "service_role";



GRANT ALL ON TABLE "public"."clubs" TO "anon";
GRANT ALL ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."deletion_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."deletion_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."deletion_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reported_conversations" TO "anon";
GRANT ALL ON TABLE "public"."reported_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."reported_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."rumour_votes" TO "anon";
GRANT ALL ON TABLE "public"."rumour_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."rumour_votes" TO "service_role";



GRANT ALL ON TABLE "public"."rumours" TO "anon";
GRANT ALL ON TABLE "public"."rumours" TO "authenticated";
GRANT ALL ON TABLE "public"."rumours" TO "service_role";



GRANT ALL ON TABLE "public"."transfers" TO "anon";
GRANT ALL ON TABLE "public"."transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."transfers" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."waitlist_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist_subscribers" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";









-- ---------------------------------------------------------------------------
-- Objects outside the public schema dump
-- ---------------------------------------------------------------------------

-- Create a profile for every new auth user.
CREATE OR REPLACE TRIGGER "on_auth_user_created"
    AFTER INSERT ON "auth"."users"
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

-- Realtime: chat messages and the unread badge.
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversations";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";
