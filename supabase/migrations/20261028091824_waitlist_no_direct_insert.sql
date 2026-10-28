-- Waitlist sign-ups only through the server (GHSA-9v4r, contract step).
--
-- Since #271 the form calls subscribe_to_waitlist() with the service role,
-- so the API no longer needs to insert into the waitlist itself. This takes
-- away the last direct write, which skipped the rate limit.
--
-- D-043: the code on main has used the function since #271. Code from
-- before #271 (a Vercel rollback past it) would fail to subscribe; the undo
-- below brings the direct insert back.
--
-- Undo: GRANT INSERT (email) ON public.waitlist_subscribers TO anon, authenticated;
--       CREATE POLICY "Anyone can subscribe" ON public.waitlist_subscribers
--         FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY "Anyone can subscribe" ON public.waitlist_subscribers;
REVOKE INSERT ON public.waitlist_subscribers FROM anon, authenticated;
