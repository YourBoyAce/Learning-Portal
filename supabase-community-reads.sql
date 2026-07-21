-- ============================================
-- Community Chat Reads — Database Migration
-- ============================================

CREATE TABLE IF NOT EXISTS community_reads (
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id     TEXT        NOT NULL,
  last_read_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, course_id)
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_community_reads_course_id
  ON community_reads (course_id);

-- ============================================
-- Enable Row Level Security
-- ============================================
ALTER TABLE community_reads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

DROP POLICY IF EXISTS "Users can read their own read receipts" ON community_reads;
DROP POLICY IF EXISTS "Users can update their own read receipts" ON community_reads;

-- READ: users can only see their own read receipts
CREATE POLICY "Users can read their own read receipts"
  ON community_reads
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE (Upsert): users can only update their own receipts
CREATE POLICY "Users can update their own read receipts"
  ON community_reads
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
