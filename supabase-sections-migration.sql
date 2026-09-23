-- ============================================
-- Migration: Add Sections feature
-- Introduces course_sections table and links coursemodules to sections.
-- ============================================

-- ============================================
-- 1. Create course_sections table
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS course_sections CASCADE;

CREATE TABLE course_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  maincourse_id UUID NOT NULL REFERENCES maincourses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_course_sections_maincourse_id ON course_sections(maincourse_id);
CREATE INDEX IF NOT EXISTS idx_course_sections_order_index ON course_sections(maincourse_id, order_index);

-- ============================================
-- 2. Add section_id FK to coursemodules
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coursemodules' AND column_name = 'section_id'
  ) THEN
    ALTER TABLE coursemodules ADD COLUMN section_id UUID REFERENCES course_sections(id) ON DELETE SET NULL;
  ELSE
    -- If section_id was previously created as BIGINT, alter column type to UUID
    ALTER TABLE coursemodules DROP COLUMN IF EXISTS section_id;
    ALTER TABLE coursemodules ADD COLUMN section_id UUID REFERENCES course_sections(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_coursemodules_section_id ON coursemodules(section_id);

-- ============================================
-- 3. Enable RLS on course_sections
-- ============================================
ALTER TABLE course_sections ENABLE ROW LEVEL SECURITY;

-- Anyone can view sections (public read like maincourses)
DROP POLICY IF EXISTS "Anyone can view sections" ON course_sections;
CREATE POLICY "Anyone can view sections" ON course_sections
  FOR SELECT USING (true);

-- Only admins can insert sections
DROP POLICY IF EXISTS "Only admins can insert sections" ON course_sections;
CREATE POLICY "Only admins can insert sections" ON course_sections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND LOWER(profiles.role) = 'admin'
    )
  );

-- Only admins can update sections
DROP POLICY IF EXISTS "Only admins can update sections" ON course_sections;
CREATE POLICY "Only admins can update sections" ON course_sections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND LOWER(profiles.role) = 'admin'
    )
  );

-- Only admins can delete sections
DROP POLICY IF EXISTS "Only admins can delete sections" ON course_sections;
CREATE POLICY "Only admins can delete sections" ON course_sections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND LOWER(profiles.role) = 'admin'
    )
  );
