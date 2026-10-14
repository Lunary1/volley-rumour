-- User reports: logged-in users report a rumour, a zoekertje or a
-- conversation; staff handle them in /admin/meldingen (issues #69, #79, #87,
-- J-15, D-015).
--
--   user ──submit_report()──→ open
--                             ├─remove_reported_content()─→ content_removed (rumour/zoekertje only)
--                             ├─close_report('dismissed')─→ dismissed
--                             └─close_report('action_taken')→ action_taken (conversations only)
--
-- Reported content stays visible until a moderator decides (D-015, as D-014).
-- The reporter gets a confirmation only; outcomes are stored for when email
-- arrives (#53). A decision answers every open report about the same item.
--
-- Messages are private: staff read a reported conversation only through
-- get_reported_conversation(), only while the report is open, and every read
-- is logged. There is no staff policy on conversations or messages.
--
-- Replaces reported_conversations, which anyone could read and write through
-- the API and nobody handled.

-- ---------------------------------------------------------------------------
-- Removed content
-- ---------------------------------------------------------------------------
-- A removed rumour gets status 'removed' (#68). The moderator's note to the
-- author is new; takedown removals leave it empty.
ALTER TABLE public.rumours
  ADD COLUMN removal_note text CHECK (char_length(removal_note) <= 500);

-- A removed zoekertje keeps its row for the author and staff. Owners can't
-- set or clear removed_at: it isn't in their UPDATE grant (issue #34).
ALTER TABLE public.classifieds
  ADD COLUMN removed_at timestamptz,
  ADD COLUMN removal_note text CHECK (char_length(removal_note) <= 500);

DROP POLICY "Classifieds are viewable by everyone" ON public.classifieds;
CREATE POLICY "Visible classifieds, own classifieds and staff" ON public.classifieds
  FOR SELECT USING (
    removed_at IS NULL
    OR user_id = (SELECT auth.uid())
    OR (SELECT public.is_staff())
  );

-- ---------------------------------------------------------------------------
-- New audit log entries
-- ---------------------------------------------------------------------------
-- Removing content is logged as content_removed on the content. Closing a
-- report and reading a reported conversation are logged on the content too.
ALTER TABLE public.staff_actions DROP CONSTRAINT staff_actions_action_check;
ALTER TABLE public.staff_actions ADD CONSTRAINT staff_actions_action_check
  CHECK (action IN (
    'rumour_approved',
    'rumour_rejected',
    'rumour_resolved',
    'content_removed',
    'takedown_rejected',
    'report_dismissed',
    'report_action_taken',
    'conversation_viewed',
    'user_suspended',
    'user_unsuspended',
    'role_changed'
  ));

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
-- One column per target, so each has a real foreign key. Reports go with the
-- content when it is deleted (an author deleting a zoekertje, a conversation
-- removed with an account); the audit log keeps what staff did.
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('rumour', 'classified', 'conversation')),
  rumour_id uuid REFERENCES public.rumours (id) ON DELETE CASCADE,
  classified_id uuid REFERENCES public.classifieds (id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations (id) ON DELETE CASCADE,
  -- Null once the reporter deletes their account.
  reporter_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  -- The author of the rumour or zoekertje, or the other participant of the
  -- conversation: who a sanction would be about (#80).
  reported_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  -- Keep in sync with CONTENT_REPORT_REASONS and CONVERSATION_REPORT_REASONS
  -- in lib/reports.ts.
  reason text NOT NULL,
  explanation text CHECK (char_length(explanation) BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'content_removed', 'dismissed', 'action_taken')),
  -- Internal: what the moderator did and why. Not shown to the reporter yet.
  decision_note text CHECK (char_length(decision_note) <= 500),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_one_target CHECK (
    (target_type = 'rumour' AND rumour_id IS NOT NULL AND classified_id IS NULL AND conversation_id IS NULL)
    OR (target_type = 'classified' AND classified_id IS NOT NULL AND rumour_id IS NULL AND conversation_id IS NULL)
    OR (target_type = 'conversation' AND conversation_id IS NOT NULL AND rumour_id IS NULL AND classified_id IS NULL)
  ),
  CONSTRAINT reports_reason CHECK (
    CASE target_type
      WHEN 'conversation' THEN reason IN ('harassment', 'offensive', 'spam', 'inappropriate', 'other')
      ELSE reason IN ('incorrect', 'offensive', 'private_info', 'spam', 'minor', 'other')
    END
  ),
  CONSTRAINT reports_other_explained CHECK (reason <> 'other' OR explanation IS NOT NULL),
  CONSTRAINT reports_decided CHECK ((status = 'open') = (decided_at IS NULL)),
  CONSTRAINT reports_outcome_fits_target CHECK (
    (status <> 'content_removed' OR target_type <> 'conversation')
    AND (status <> 'action_taken' OR target_type = 'conversation')
  )
);

COMMENT ON TABLE public.reports IS
  'Reports of rumours, zoekertjes and conversations by users (#69, #79, #87, D-015). Staff read; written through functions only.';

CREATE INDEX reports_status_idx ON public.reports (status, created_at);
CREATE INDEX reports_reporter_idx ON public.reports (reporter_id, created_at);
CREATE INDEX reports_rumour_idx ON public.reports (rumour_id) WHERE rumour_id IS NOT NULL;
CREATE INDEX reports_classified_idx ON public.reports (classified_id) WHERE classified_id IS NOT NULL;
CREATE INDEX reports_conversation_idx ON public.reports (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX reports_reported_user_idx ON public.reports (reported_user_id);
-- One open report per user per item.
CREATE UNIQUE INDEX reports_one_open_per_reporter
  ON public.reports (reporter_id, COALESCE(rumour_id, classified_id, conversation_id))
  WHERE status = 'open';

-- Staff read everything; nobody writes through the API.
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.reports TO service_role;
GRANT SELECT ON public.reports TO authenticated;

CREATE POLICY "Staff can read reports" ON public.reports
  FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

-- ---------------------------------------------------------------------------
-- Move reported_conversations over and drop it
-- ---------------------------------------------------------------------------
-- Old reports keep their free-text reason as the explanation, one per
-- reporter per conversation.
INSERT INTO public.reports (
  target_type, conversation_id, reporter_id, reported_user_id, reason, explanation, created_at
)
SELECT DISTINCT ON (rc.conversation_id, rc.reporter_id)
       'conversation', rc.conversation_id, rc.reporter_id,
       CASE WHEN c.initiator_id = rc.reporter_id THEN c.recipient_id ELSE c.initiator_id END,
       'other', left(COALESCE(NULLIF(btrim(rc.reason), ''), '(geen reden)'), 1000),
       COALESCE(rc.created_at, now())
  FROM public.reported_conversations rc
  JOIN public.conversations c ON c.id = rc.conversation_id
 ORDER BY rc.conversation_id, rc.reporter_id, rc.created_at;

DROP TABLE public.reported_conversations;

-- ---------------------------------------------------------------------------
-- Submit
-- ---------------------------------------------------------------------------
-- Called by the reportContent server action with the user's session. Checks
-- that the user may see the item, that it isn't their own, and the limits;
-- returns the report id. Keep the limit in sync with REPORT_LIMITS in
-- lib/reports.ts.
--
--   42501  not logged in
--   P0002  the item doesn't exist or isn't visible to the user
--   VR002  too many reports from this user today (10)
--   VR003  this user already has an open report about this item
--   VR004  the item is the user's own
--   22023  invalid reason, or "other" without an explanation
CREATE FUNCTION public.submit_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_explanation text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
  explanation text := NULLIF(btrim(p_explanation), '');
  author uuid;
  report_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'log in to report' USING ERRCODE = '42501';
  END IF;

  IF p_target_type = 'conversation' THEN
    IF p_reason IS NULL OR p_reason NOT IN ('harassment', 'offensive', 'spam', 'inappropriate', 'other') THEN
      RAISE EXCEPTION 'invalid reason' USING ERRCODE = '22023';
    END IF;
  ELSIF p_target_type IN ('rumour', 'classified') THEN
    IF p_reason IS NULL OR p_reason NOT IN ('incorrect', 'offensive', 'private_info', 'spam', 'minor', 'other') THEN
      RAISE EXCEPTION 'invalid reason' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid target type' USING ERRCODE = '22023';
  END IF;
  IF p_reason = 'other' AND explanation IS NULL THEN
    RAISE EXCEPTION 'explain the report' USING ERRCODE = '22023';
  END IF;

  -- Parallel reports from one user wait for each other, so they can't slip
  -- past the limit together.
  PERFORM pg_advisory_xact_lock(hashtextextended('report:' || uid::text, 0));

  -- Only what the user can see: public rumours, visible zoekertjes, their own
  -- conversations. For a conversation, the author is the other participant.
  IF p_target_type = 'rumour' THEN
    SELECT creator_id INTO author FROM public.rumours
     WHERE id = p_target_id AND status IN ('rumour', 'confirmed', 'denied');
  ELSIF p_target_type = 'classified' THEN
    SELECT user_id INTO author FROM public.classifieds
     WHERE id = p_target_id AND is_active AND removed_at IS NULL;
  ELSE
    SELECT CASE WHEN initiator_id = uid THEN recipient_id ELSE initiator_id END INTO author
      FROM public.conversations
     WHERE id = p_target_id AND uid IN (initiator_id, recipient_id);
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'item not found' USING ERRCODE = 'P0002';
  END IF;
  IF author = uid THEN
    RAISE EXCEPTION 'cannot report own content' USING ERRCODE = 'VR004';
  END IF;

  IF (
    SELECT count(*) FROM public.reports
     WHERE reporter_id = uid AND created_at > now() - interval '24 hours'
  ) >= 10 THEN
    RAISE EXCEPTION 'too many reports today' USING ERRCODE = 'VR002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reports
     WHERE reporter_id = uid AND status = 'open'
       AND p_target_id IN (rumour_id, classified_id, conversation_id)
  ) THEN
    RAISE EXCEPTION 'an open report for this item exists' USING ERRCODE = 'VR003';
  END IF;

  INSERT INTO public.reports (
    target_type, rumour_id, classified_id, conversation_id,
    reporter_id, reported_user_id, reason, explanation
  ) VALUES (
    p_target_type,
    CASE WHEN p_target_type = 'rumour' THEN p_target_id END,
    CASE WHEN p_target_type = 'classified' THEN p_target_id END,
    CASE WHEN p_target_type = 'conversation' THEN p_target_id END,
    uid, author, p_reason, left(explanation, 1000)
  )
  RETURNING id INTO report_id;

  RETURN report_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_report(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_report(text, uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Decide: remove the rumour or zoekertje
-- ---------------------------------------------------------------------------
-- Removes the item from every public view and answers every open report about
-- it, in one transaction with the log entry. For a rumour, open takedown
-- requests about it are answered too, so their status page shows the removal.
-- The note goes to the author, who sees it on their profile.
CREATE FUNCTION public.remove_reported_content(
  p_report_id uuid,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  note text := NULLIF(btrim(p_note), '');
  r public.reports%ROWTYPE;
  target uuid;
  report_ids uuid[];
  refs text[];
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can handle reports' USING ERRCODE = '42501';
  END IF;

  -- The row lock makes a concurrent second decision wait, then fail.
  SELECT * INTO r FROM public.reports
   WHERE id = p_report_id AND status = 'open'
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'report is not open' USING ERRCODE = 'P0002';
  END IF;
  IF r.target_type = 'conversation' THEN
    RAISE EXCEPTION 'conversations are not removed' USING ERRCODE = '22023';
  END IF;

  target := COALESCE(r.rumour_id, r.classified_id);

  IF r.target_type = 'rumour' THEN
    UPDATE public.rumours
       SET status = 'removed', removal_note = note, updated_at = now()
     WHERE id = target;

    WITH answered AS (
      UPDATE public.takedown_requests
         SET status = 'removed', decided_at = now()
       WHERE rumour_id = target AND status = 'open'
      RETURNING reference
    )
    SELECT array_agg(reference ORDER BY reference) INTO refs FROM answered;
  ELSE
    UPDATE public.classifieds
       SET removed_at = now(), removal_note = note, updated_at = now()
     WHERE id = target;
  END IF;

  WITH answered AS (
    UPDATE public.reports
       SET status = 'content_removed', decision_note = note, decided_at = now()
     WHERE status = 'open' AND target IN (rumour_id, classified_id)
    RETURNING id
  )
  SELECT array_agg(id) INTO report_ids FROM answered;

  PERFORM public.log_staff_action(
    'content_removed',
    r.target_type,
    target,
    'Na melding' || COALESCE(': ' || note, ''),
    jsonb_strip_nulls(jsonb_build_object(
      'reports', to_jsonb(report_ids),
      'takedown_requests', to_jsonb(refs)
    ))
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Decide: close the report
-- ---------------------------------------------------------------------------
-- 'dismissed': nothing wrong, the item stays. 'action_taken': for
-- conversations, the moderator did something outside the site for now
-- (warnings and suspensions come with #80); the note says what, so it's
-- required.
CREATE FUNCTION public.close_report(
  p_report_id uuid,
  p_outcome text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  note text := NULLIF(btrim(p_note), '');
  r public.reports%ROWTYPE;
  target uuid;
  report_ids uuid[];
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can handle reports' USING ERRCODE = '42501';
  END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('dismissed', 'action_taken') THEN
    RAISE EXCEPTION 'invalid outcome' USING ERRCODE = '22023';
  END IF;
  IF p_outcome = 'action_taken' AND note IS NULL THEN
    RAISE EXCEPTION 'say which action was taken' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO r FROM public.reports
   WHERE id = p_report_id AND status = 'open'
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'report is not open' USING ERRCODE = 'P0002';
  END IF;
  IF p_outcome = 'action_taken' AND r.target_type <> 'conversation' THEN
    RAISE EXCEPTION 'remove the content instead' USING ERRCODE = '22023';
  END IF;

  target := COALESCE(r.rumour_id, r.classified_id, r.conversation_id);

  WITH answered AS (
    UPDATE public.reports
       SET status = p_outcome, decision_note = note, decided_at = now()
     WHERE status = 'open' AND target IN (rumour_id, classified_id, conversation_id)
    RETURNING id
  )
  SELECT array_agg(id) INTO report_ids FROM answered;

  PERFORM public.log_staff_action(
    CASE p_outcome WHEN 'dismissed' THEN 'report_dismissed' ELSE 'report_action_taken' END,
    r.target_type,
    target,
    note,
    jsonb_build_object('reports', to_jsonb(report_ids))
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Read a reported conversation
-- ---------------------------------------------------------------------------
-- The only way staff can read messages: through an open report about the
-- conversation. Every read is logged.
CREATE FUNCTION public.get_reported_conversation(p_report_id uuid)
RETURNS TABLE (
  message_id uuid,
  sender_id uuid,
  sender_username text,
  body text,
  sent_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  conversation uuid;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can read reported conversations' USING ERRCODE = '42501';
  END IF;

  SELECT rep.conversation_id INTO conversation
    FROM public.reports rep
   WHERE rep.id = p_report_id AND rep.status = 'open' AND rep.target_type = 'conversation';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no open report about a conversation' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.log_staff_action(
    'conversation_viewed',
    'conversation',
    conversation,
    NULL,
    jsonb_build_object('report', p_report_id)
  );

  RETURN QUERY
    SELECT m.id, m.sender_id, p.username, m.content, m.created_at
      FROM public.messages m
      LEFT JOIN public.profiles p ON p.id = m.sender_id
     WHERE m.conversation_id = conversation
     ORDER BY m.created_at, m.id;
END;
$$;

-- Server actions call these with the moderator's session; the functions check
-- staff themselves.
REVOKE EXECUTE ON FUNCTION public.remove_reported_content(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.close_report(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_reported_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_reported_content(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_report(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reported_conversation(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Takedown removals answer reports too
-- ---------------------------------------------------------------------------
-- Same as in 20261014160718_takedown_requests.sql, plus: open reports about
-- the rumour are closed as content_removed.
CREATE OR REPLACE FUNCTION public.remove_rumour_for_takedown(
  p_request_id uuid,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  note text := NULLIF(btrim(p_note), '');
  target uuid;
  refs text[];
  report_ids uuid[];
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'only staff can handle takedown requests'
      USING ERRCODE = '42501';
  END IF;

  -- The row lock makes a concurrent second decision wait, then fail.
  SELECT rumour_id INTO target
    FROM public.takedown_requests
   WHERE id = p_request_id AND status = 'open'
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'takedown request is not open' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.rumours SET status = 'removed', updated_at = now() WHERE id = target;

  WITH answered AS (
    UPDATE public.takedown_requests
       SET status = 'removed', decision_note = note, decided_at = now()
     WHERE rumour_id = target AND status = 'open'
    RETURNING reference
  )
  SELECT array_agg(reference ORDER BY reference) INTO refs FROM answered;

  -- The takedown note is for the requester, not the reporters.
  WITH answered AS (
    UPDATE public.reports
       SET status = 'content_removed', decided_at = now()
     WHERE rumour_id = target AND status = 'open'
    RETURNING id
  )
  SELECT array_agg(id) INTO report_ids FROM answered;

  PERFORM public.log_staff_action(
    'content_removed',
    'rumour',
    target,
    'Verwijderverzoek ' || array_to_string(refs, ', ') || COALESCE(': ' || note, ''),
    jsonb_strip_nulls(jsonb_build_object(
      'takedown_requests', to_jsonb(refs),
      'reports', to_jsonb(report_ids)
    ))
  );
END;
$$;
