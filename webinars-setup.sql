-- ============================================
-- Webinars Table Setup
-- ============================================

CREATE TABLE IF NOT EXISTS webinars (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  event_date TEXT, 
  icon TEXT DEFAULT '📋',
  status TEXT DEFAULT 'streaming', -- 'streaming' or 'link'
  link_text TEXT,
  attendees_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE webinars ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view webinars" ON webinars;
DROP POLICY IF EXISTS "Only admins can manage webinars" ON webinars;

-- Create Policies
CREATE POLICY "Anyone can view webinars" ON webinars
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage webinars" ON webinars
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Insert Initial Sample Data
INSERT INTO webinars (title, subtitle, event_date, icon, status, attendees_count) VALUES
('Advanced Epistemology', 'Seminar Room R12 · Prof. Ariadne', 'TOMORROW, 10:00 AM', '📋', 'streaming', 2),
('The Architecture of Silence', 'Virtual Session · Dr. Lena Vance', 'WED, 2:30 PM', '▶', 'link', 1),
('Linguistic Relativity', 'Workshop Room 12 · Prof. Ch...', 'FRI, 11:00 AM', '📋', 'streaming', 0)
ON CONFLICT DO NOTHING;
