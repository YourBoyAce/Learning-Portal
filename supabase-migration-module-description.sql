-- ============================================
-- Migration: Add description column to coursemodules
-- ============================================

-- Add description column to coursemodules table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coursemodules' AND column_name = 'description'
  ) THEN
    ALTER TABLE coursemodules ADD COLUMN description TEXT DEFAULT '';
  END IF;
END
$$;

-- ============================================
-- Storage Bucket: course-thumbnails
-- ============================================
-- Run this in the Supabase SQL editor or create the bucket
-- via the Supabase Dashboard > Storage > New Bucket
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('course-thumbnails', 'course-thumbnails', true)
-- ON CONFLICT (id) DO NOTHING;
