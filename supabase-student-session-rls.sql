-- ============================================
-- Fix: Allow students to view their accepted mentor sessions
-- ============================================
-- The calendar_events table previously only had an RLS policy allowing
-- users to read rows where user_id = auth.uid(). Since mentor sessions
-- are stored with user_id = mentor's ID, students could never read them
-- via the client SDK — causing the "Upcoming Mentor Session" dashboard
-- widget to always show empty.

CREATE POLICY "Students can view their accepted mentor sessions"
  ON calendar_events FOR SELECT
  USING (
    description LIKE ('%Student ID: ' || auth.uid()::text || '%')
    AND tag LIKE '%status:accepted%'
  );
