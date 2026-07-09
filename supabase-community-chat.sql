-- ============================================
-- Community Chat — Database Migration
-- ============================================
-- Run this in your Supabase SQL Editor.
-- Safe to run multiple times (all statements are idempotent).

-- ============================================
-- 1. Helper Function: is_enrolled_in_course
-- ============================================
-- Returns TRUE if the currently authenticated user is enrolled in the given
-- course via the batch_members → batches relationship.
-- This function is used by RLS policies so enrollment logic lives in one place.
--
-- NOTE: course_id is TEXT to match the String(id) pattern used throughout
-- the application (maincourses.id is BIGSERIAL, stored as text in app layer).

CREATE OR REPLACE FUNCTION is_enrolled_in_course(p_course_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   batch_members bm
    JOIN   batches       b  ON b.id = bm.batch_id
    JOIN   auth.users    u  ON LOWER(u.email) = LOWER(bm.email)
    WHERE  u.id               = auth.uid()
    AND    b.course_id::TEXT  = p_course_id
  );
$$;

-- ============================================
-- 2. Create course_messages Table
-- ============================================
CREATE TABLE IF NOT EXISTS course_messages (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id  TEXT        NOT NULL,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- 3. Indexes
-- ============================================
-- Primary query pattern: fetch latest N messages for a course
CREATE INDEX IF NOT EXISTS idx_course_messages_course_created
  ON course_messages (course_id, created_at DESC);

-- For user-scoped queries (e.g. admin: messages by user)
CREATE INDEX IF NOT EXISTS idx_course_messages_user_id
  ON course_messages (user_id);

-- ============================================
-- 4. Enable Row Level Security
-- ============================================
ALTER TABLE course_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Drop existing policies (for safe re-runs)
-- ============================================
DROP POLICY IF EXISTS "Enrolled users can read course messages"  ON course_messages;
DROP POLICY IF EXISTS "Enrolled users can send course messages"  ON course_messages;
DROP POLICY IF EXISTS "Users can only send as themselves"        ON course_messages;
DROP POLICY IF EXISTS "Admins can read all course messages"      ON course_messages;
DROP POLICY IF EXISTS "Admins can delete course messages"        ON course_messages;
DROP POLICY IF EXISTS "Admins can edit course messages"          ON course_messages;

-- ============================================
-- 6. RLS Policies
-- ============================================

-- READ: only enrolled students can see messages for a course
CREATE POLICY "Enrolled users can read course messages"
  ON course_messages
  FOR SELECT
  USING (
    is_enrolled_in_course(course_id)
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND   LOWER(profiles.role) = 'admin'
    )
  );

-- INSERT: enrolled students can only send messages as themselves
-- Two checks combined: enrollment + identity (prevents spoofing user_id)
CREATE POLICY "Enrolled users can send course messages"
  ON course_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND is_enrolled_in_course(course_id)
  );

-- DELETE: admins can moderate (delete) any message
CREATE POLICY "Admins can delete course messages"
  ON course_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND   LOWER(profiles.role) = 'admin'
    )
  );

-- UPDATE: admins can edit any message
CREATE POLICY "Admins can edit course messages"
  ON course_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND   LOWER(profiles.role) = 'admin'
    )
  );

-- ============================================
-- 7. Enable Realtime
-- ============================================
-- Adds course_messages to the Supabase Realtime publication so clients
-- can subscribe to INSERT events on this table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'course_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE course_messages;
  END IF;
END
$$;

-- ============================================
-- Done!
-- ============================================
-- After running this script:
--   1. Verify the table exists in Table Editor.
--   2. Verify RLS is enabled (shield icon).
--   3. Confirm the 3 policies exist in the Authentication → Policies section.
--   4. Confirm course_messages appears in the Realtime section.
