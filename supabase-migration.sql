-- ============================================
-- Supabase Migration - Add Missing Columns & Tables
-- ============================================

-- ============================================
-- 1. Add missing columns to maincourses table
-- ============================================

-- Add category column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'maincourses' AND column_name = 'category'
  ) THEN
    ALTER TABLE maincourses ADD COLUMN category TEXT DEFAULT 'General';
  END IF;
END $$;

-- Add duration_weeks column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'maincourses' AND column_name = 'duration_weeks'
  ) THEN
    ALTER TABLE maincourses ADD COLUMN duration_weeks INTEGER DEFAULT 4;
  END IF;
END $$;

-- Add thumbnail_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'maincourses' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE maincourses ADD COLUMN thumbnail_url TEXT;
  END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'maincourses' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE maincourses ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- ============================================
-- 2. Create user_video_progress table if it doesn't exist
-- ============================================
CREATE TABLE IF NOT EXISTS user_video_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES maincourses(id) ON DELETE CASCADE,
  video_id TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  progress_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to user_video_progress if table already exists
DO $$
BEGIN
  -- Add course_id column if it doesn't exist (use UUID to match maincourses.id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_video_progress' AND column_name = 'course_id'
  ) THEN
    ALTER TABLE user_video_progress ADD COLUMN course_id UUID REFERENCES maincourses(id) ON DELETE CASCADE;
  END IF;

  -- Add video_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_video_progress' AND column_name = 'video_id'
  ) THEN
    ALTER TABLE user_video_progress ADD COLUMN video_id TEXT;
  END IF;

  -- Add completed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_video_progress' AND column_name = 'completed'
  ) THEN
    ALTER TABLE user_video_progress ADD COLUMN completed BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add completed_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_video_progress' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE user_video_progress ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add progress_percentage column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_video_progress' AND column_name = 'progress_percentage'
  ) THEN
    ALTER TABLE user_video_progress ADD COLUMN progress_percentage INTEGER DEFAULT 0;
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_video_progress' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE user_video_progress ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Add unique constraint only after all columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_video_progress' AND column_name = 'course_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_video_progress' AND column_name = 'video_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'user_video_progress' AND constraint_name = 'user_video_progress_user_id_course_id_video_id_key'
  ) THEN
    ALTER TABLE user_video_progress ADD CONSTRAINT user_video_progress_user_id_course_id_video_id_key UNIQUE(user_id, course_id, video_id);
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_video_progress_user_id ON user_video_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_video_progress_course_id ON user_video_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_user_video_progress_completed ON user_video_progress(completed);
CREATE INDEX IF NOT EXISTS idx_user_video_progress_completed_at ON user_video_progress(completed_at DESC);

-- ============================================
-- 3. Create course_enrollments table if it doesn't exist
-- ============================================
CREATE TABLE IF NOT EXISTS course_enrollments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES maincourses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed', 'dropped'))
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'course_enrollments' AND constraint_name = 'course_enrollments_user_id_course_id_key'
  ) THEN
    ALTER TABLE course_enrollments ADD CONSTRAINT course_enrollments_user_id_course_id_key UNIQUE(user_id, course_id);
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user_id ON course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_status ON course_enrollments(status);

-- ============================================
-- 4. Create course_ratings table if it doesn't exist
-- ============================================
CREATE TABLE IF NOT EXISTS course_ratings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES maincourses(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'course_ratings' AND constraint_name = 'course_ratings_user_id_course_id_key'
  ) THEN
    ALTER TABLE course_ratings ADD CONSTRAINT course_ratings_user_id_course_id_key UNIQUE(user_id, course_id);
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_course_ratings_user_id ON course_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_course_ratings_course_id ON course_ratings(course_id);

-- ============================================
-- 5. Create certificates table if it doesn't exist
-- ============================================
CREATE TABLE IF NOT EXISTS certificates (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES maincourses(id) ON DELETE CASCADE,
  certificate_url TEXT,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'certificates' AND constraint_name = 'certificates_user_id_course_id_key'
  ) THEN
    ALTER TABLE certificates ADD CONSTRAINT certificates_user_id_course_id_key UNIQUE(user_id, course_id);
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_issued_at ON certificates(issued_at DESC);

-- ============================================
-- 6. Enable Row Level Security (RLS) if not enabled
-- ============================================

ALTER TABLE maincourses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. Drop existing policies if they exist (to avoid conflicts)
-- ============================================

DROP POLICY IF EXISTS "Anyone can view courses" ON maincourses;
DROP POLICY IF EXISTS "Only admins can insert courses" ON maincourses;
DROP POLICY IF EXISTS "Only admins can update courses" ON maincourses;

DROP POLICY IF EXISTS "Users can view own progress" ON user_video_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON user_video_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON user_video_progress;

DROP POLICY IF EXISTS "Users can view own enrollments" ON course_enrollments;
DROP POLICY IF EXISTS "Users can insert own enrollments" ON course_enrollments;
DROP POLICY IF EXISTS "Users can update own enrollments" ON course_enrollments;

DROP POLICY IF EXISTS "Anyone can view ratings" ON course_ratings;
DROP POLICY IF EXISTS "Users can insert own ratings" ON course_ratings;
DROP POLICY IF EXISTS "Users can update own ratings" ON course_ratings;

DROP POLICY IF EXISTS "Users can view own certificates" ON certificates;
DROP POLICY IF EXISTS "System can insert certificates" ON certificates;

-- ============================================
-- 8. Create RLS Policies
-- ============================================

-- Main Courses policies
CREATE POLICY "Anyone can view courses" ON maincourses
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert courses" ON maincourses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND LOWER(profiles.role) = 'admin'
    )
  );

CREATE POLICY "Only admins can update courses" ON maincourses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND LOWER(profiles.role) = 'admin'
    )
  );

-- User Video Progress policies
CREATE POLICY "Users can view own progress" ON user_video_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" ON user_video_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON user_video_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- Course Enrollments policies
CREATE POLICY "Users can view own enrollments" ON course_enrollments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own enrollments" ON course_enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own enrollments" ON course_enrollments
  FOR UPDATE USING (auth.uid() = user_id);

-- Course Ratings policies
CREATE POLICY "Anyone can view ratings" ON course_ratings
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own ratings" ON course_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings" ON course_ratings
  FOR UPDATE USING (auth.uid() = user_id);

-- Certificates policies
CREATE POLICY "Users can view own certificates" ON certificates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert certificates" ON certificates
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 9. Insert sample courses if they don't exist
-- ============================================
INSERT INTO maincourses (title, description, category, duration_weeks)
SELECT 
  'Neural Networks & Deep Learning',
  'Advanced study of neural architectures, backpropagation, and deep learning applications in modern AI systems.',
  'AI / ML',
  6
WHERE NOT EXISTS (
  SELECT 1 FROM maincourses WHERE title = 'Neural Networks & Deep Learning'
);

INSERT INTO maincourses (title, description, category, duration_weeks)
SELECT 
  'Classical Rhetoric in Modernity',
  'Exploration of ancient rhetorical principles and their application to contemporary communication and persuasion.',
  'Humanities',
  4
WHERE NOT EXISTS (
  SELECT 1 FROM maincourses WHERE title = 'Classical Rhetoric in Modernity'
);

INSERT INTO maincourses (title, description, category, duration_weeks)
SELECT 
  'The Ethics of Bio-Design',
  'Critical examination of ethical considerations in biotechnology, genetic engineering, and sustainable design practices.',
  'Ethics',
  5
WHERE NOT EXISTS (
  SELECT 1 FROM maincourses WHERE title = 'The Ethics of Bio-Design'
);

INSERT INTO maincourses (title, description, category, duration_weeks)
SELECT 
  'Hermeneutics of Narrative',
  'Advanced hermeneutical analysis of narrative structures across literature, film, and digital media.',
  'Humanities',
  4
WHERE NOT EXISTS (
  SELECT 1 FROM maincourses WHERE title = 'Hermeneutics of Narrative'
);

INSERT INTO maincourses (title, description, category, duration_weeks)
SELECT 
  'Quantum Computing Fundamentals',
  'Introduction to quantum mechanics principles, qubits, and quantum algorithms for computational problems.',
  'Computer Science',
  8
WHERE NOT EXISTS (
  SELECT 1 FROM maincourses WHERE title = 'Quantum Computing Fundamentals'
);

INSERT INTO maincourses (title, description, category, duration_weeks)
SELECT 
  'Sustainable Architecture',
  'Design principles for environmentally conscious buildings, materials, and urban planning strategies.',
  'Design',
  6
WHERE NOT EXISTS (
  SELECT 1 FROM maincourses WHERE title = 'Sustainable Architecture'
);

-- ============================================
-- 10. Create Helper Functions
-- ============================================

-- Function to calculate course completion rate for a user
CREATE OR REPLACE FUNCTION calculate_course_completion(p_user_id UUID, p_course_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_videos INTEGER;
  completed_videos INTEGER;
  completion_rate INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_videos
  FROM user_video_progress
  WHERE course_id = p_course_id AND user_id = p_user_id;

  SELECT COUNT(*) INTO completed_videos
  FROM user_video_progress
  WHERE course_id = p_course_id AND user_id = p_user_id AND completed = TRUE;

  IF total_videos > 0 THEN
    completion_rate := ROUND((completed_videos::FLOAT / total_videos::FLOAT) * 100);
  ELSE
    completion_rate := 0;
  END IF;

  RETURN completion_rate;
END;
$$ LANGUAGE plpgsql;

-- Function to get total students enrolled in a course
CREATE OR REPLACE FUNCTION get_course_students(p_course_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM course_enrollments
    WHERE course_id = p_course_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get average rating for a course
CREATE OR REPLACE FUNCTION get_course_avg_rating(p_course_id UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN (
    SELECT COALESCE(AVG(rating), 0)
    FROM course_ratings
    WHERE course_id = p_course_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get certificates issued for a course
CREATE OR REPLACE FUNCTION get_course_certificates(p_course_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM certificates
    WHERE course_id = p_course_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. User Login Logs Table (for admin analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS user_login_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_heartbeat_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_duration_seconds INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_user_login_logs_user_id ON user_login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_logs_logged_in_at ON user_login_logs(logged_in_at DESC);

ALTER TABLE user_login_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own login logs" ON user_login_logs;
DROP POLICY IF EXISTS "Users can update own login logs" ON user_login_logs;
DROP POLICY IF EXISTS "Users can view own login logs" ON user_login_logs;
DROP POLICY IF EXISTS "Admins can view all login logs" ON user_login_logs;

CREATE POLICY "Users can insert own login logs" ON user_login_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own login logs" ON user_login_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own login logs" ON user_login_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all login logs" ON user_login_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND LOWER(profiles.role) = 'admin'
    )
  );

-- ============================================
-- 12. Admin DELETE policy for maincourses
-- ============================================
DROP POLICY IF EXISTS "Only admins can delete courses" ON maincourses;

CREATE POLICY "Only admins can delete courses" ON maincourses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND LOWER(profiles.role) = 'admin'
    )
  );

-- ============================================
-- 13. Normalize all role values to lowercase
-- ============================================
UPDATE profiles SET role = LOWER(role) WHERE role IS NOT NULL AND role != LOWER(role);
