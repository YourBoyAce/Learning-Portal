-- ============================================
-- Supabase Database Setup for Completed Courses
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Main Courses Table
-- ============================================
CREATE TABLE IF NOT EXISTS maincourses (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'General',
  duration_weeks INTEGER DEFAULT 4,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_maincourses_created_at ON maincourses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maincourses_category ON maincourses(category);

-- ============================================
-- 2. User Video Progress Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_video_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id BIGINT NOT NULL REFERENCES maincourses(id) ON DELETE CASCADE,
  video_id TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  progress_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id, video_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_video_progress_user_id ON user_video_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_video_progress_course_id ON user_video_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_user_video_progress_completed ON user_video_progress(completed);
CREATE INDEX IF NOT EXISTS idx_user_video_progress_completed_at ON user_video_progress(completed_at DESC);

-- ============================================
-- 3. Course Enrollments Table (for totalStudents)
-- ============================================
CREATE TABLE IF NOT EXISTS course_enrollments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id BIGINT NOT NULL REFERENCES maincourses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed', 'dropped')),
  UNIQUE(user_id, course_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user_id ON course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_status ON course_enrollments(status);

-- ============================================
-- 4. Course Ratings Table (for avgRating)
-- ============================================
CREATE TABLE IF NOT EXISTS course_ratings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id BIGINT NOT NULL REFERENCES maincourses(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_course_ratings_user_id ON course_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_course_ratings_course_id ON course_ratings(course_id);

-- ============================================
-- 5. Certificates Table (for certificatesIssued)
-- ============================================
CREATE TABLE IF NOT EXISTS certificates (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id BIGINT NOT NULL REFERENCES maincourses(id) ON DELETE CASCADE,
  certificate_url TEXT,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_issued_at ON certificates(issued_at DESC);

-- ============================================
-- 6. Enable Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE maincourses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. RLS Policies
-- ============================================

-- Main Courses: Everyone can read, only admins can write
CREATE POLICY "Anyone can view courses" ON maincourses
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert courses" ON maincourses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update courses" ON maincourses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- User Video Progress: Users can read/write their own progress
CREATE POLICY "Users can view own progress" ON user_video_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" ON user_video_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON user_video_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- Course Enrollments: Users can read/write their own enrollments
CREATE POLICY "Users can view own enrollments" ON course_enrollments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own enrollments" ON course_enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own enrollments" ON course_enrollments
  FOR UPDATE USING (auth.uid() = user_id);

-- Course Ratings: Users can read all, write their own
CREATE POLICY "Anyone can view ratings" ON course_ratings
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own ratings" ON course_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings" ON course_ratings
  FOR UPDATE USING (auth.uid() = user_id);

-- Certificates: Users can read their own, system can write
CREATE POLICY "Users can view own certificates" ON certificates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert certificates" ON certificates
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 8. Sample Data (Optional - for testing)
-- ============================================

-- Insert sample courses
INSERT INTO maincourses (title, description, category, duration_weeks) VALUES
('Neural Networks & Deep Learning', 'Advanced study of neural architectures, backpropagation, and deep learning applications in modern AI systems.', 'AI / ML', 6),
('Classical Rhetoric in Modernity', 'Exploration of ancient rhetorical principles and their application to contemporary communication and persuasion.', 'Humanities', 4),
('The Ethics of Bio-Design', 'Critical examination of ethical considerations in biotechnology, genetic engineering, and sustainable design practices.', 'Ethics', 5),
('Hermeneutics of Narrative', 'Advanced hermeneutical analysis of narrative structures across literature, film, and digital media.', 'Humanities', 4),
('Quantum Computing Fundamentals', 'Introduction to quantum mechanics principles, qubits, and quantum algorithms for computational problems.', 'Computer Science', 8),
('Sustainable Architecture', 'Design principles for environmentally conscious buildings, materials, and urban planning strategies.', 'Design', 6)
ON CONFLICT DO NOTHING;

-- ============================================
-- 9. Helper Functions (Optional)
-- ============================================

-- Function to calculate course completion rate for a user
CREATE OR REPLACE FUNCTION calculate_course_completion(p_user_id UUID, p_course_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
  total_videos INTEGER;
  completed_videos INTEGER;
  completion_rate INTEGER;
BEGIN
  -- Count total videos for this course
  SELECT COUNT(*) INTO total_videos
  FROM user_video_progress
  WHERE course_id = p_course_id AND user_id = p_user_id;
  
  -- Count completed videos
  SELECT COUNT(*) INTO completed_videos
  FROM user_video_progress
  WHERE course_id = p_course_id AND user_id = p_user_id AND completed = TRUE;
  
  -- Calculate percentage
  IF total_videos > 0 THEN
    completion_rate := ROUND((completed_videos::FLOAT / total_videos::FLOAT) * 100);
  ELSE
    completion_rate := 0;
  END IF;
  
  RETURN completion_rate;
END;
$$ LANGUAGE plpgsql;

-- Function to get total students enrolled in a course
CREATE OR REPLACE FUNCTION get_course_students(p_course_id BIGINT)
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
CREATE OR REPLACE FUNCTION get_course_avg_rating(p_course_id BIGINT)
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
CREATE OR REPLACE FUNCTION get_course_certificates(p_course_id BIGINT)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM certificates
    WHERE course_id = p_course_id
  );
END;
$$ LANGUAGE plpgsql;
