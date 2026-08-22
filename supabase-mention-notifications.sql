-- ============================================
-- Mention Notifications — Database Migration
-- Notifies admins/mentors when tagged in community chat
-- ============================================

CREATE TABLE IF NOT EXISTS mention_notifications (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id        UUID        NOT NULL REFERENCES course_messages(id) ON DELETE CASCADE,
  course_id         TEXT        NOT NULL,
  message_preview   TEXT        NOT NULL,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (recipient_user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_mention_notifications_recipient_unread
  ON mention_notifications (recipient_user_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mention_notifications_recipient_created
  ON mention_notifications (recipient_user_id, created_at DESC);

ALTER TABLE mention_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipients can read their mention notifications" ON mention_notifications;
DROP POLICY IF EXISTS "Recipients can mark their mention notifications read" ON mention_notifications;

CREATE POLICY "Recipients can read their mention notifications"
  ON mention_notifications
  FOR SELECT
  USING (auth.uid() = recipient_user_id);

CREATE POLICY "Recipients can mark their mention notifications read"
  ON mention_notifications
  FOR UPDATE
  USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);
