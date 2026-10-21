-- Live vote counts on rumour cards (#200).
--
-- The cards have subscribed to UPDATEs on rumours since before the baseline,
-- but the table was never in the supabase_realtime publication, so Realtime
-- refused every subscription and the counts only changed on the user's own
-- vote or a reload. The owner chose to make them work.
--
-- Realtime checks each subscriber against the table's RLS, as the API does:
-- visitors only get changes to public rumours; pending, rejected, removed and
-- withdrawn ones only reach their author and staff. Every column is already
-- readable through the API, so the events show nothing new.
--
-- Old code keeps working: the publication only adds events. Undo:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.rumours;

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.rumours;
