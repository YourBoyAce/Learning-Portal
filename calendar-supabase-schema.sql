-- ============================================
-- Calendar & Schedule Supabase Database Schema
-- ============================================

-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('video', 'course', 'session', 'webinar')),
  tag VARCHAR(100),
  meet_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_notifications BOOLEAN DEFAULT true,
  in_app_alerts BOOLEAN DEFAULT true,
  sms_reminders BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);

-- Enable Row Level Security
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar_events
-- Users can view their own events
CREATE POLICY "Users can view own calendar events"
  ON calendar_events FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own events
CREATE POLICY "Users can insert own calendar events"
  ON calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own events
CREATE POLICY "Users can update own calendar events"
  ON calendar_events FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own events
CREATE POLICY "Users can delete own calendar events"
  ON calendar_events FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for notification_preferences
-- Users can view their own preferences
CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Enable Real-time for calendar_events
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;

-- Enable Real-time for notification_preferences
ALTER PUBLICATION supabase_realtime ADD TABLE notification_preferences;

-- Create updated_at trigger for calendar_events
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get events for a specific month
CREATE OR REPLACE FUNCTION get_events_for_month(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  description TEXT,
  event_date DATE,
  event_time TIME,
  event_type VARCHAR(50),
  tag VARCHAR(100)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.id,
    ce.title,
    ce.description,
    ce.event_date,
    ce.event_time,
    ce.event_type,
    ce.tag
  FROM calendar_events ce
  WHERE ce.user_id = p_user_id
    AND EXTRACT(YEAR FROM ce.event_date) = p_year
    AND EXTRACT(MONTH FROM ce.event_date) = p_month
  ORDER BY ce.event_date, ce.event_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get upcoming events
CREATE OR REPLACE FUNCTION get_upcoming_events(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  description TEXT,
  event_date DATE,
  event_time TIME,
  event_type VARCHAR(50),
  tag VARCHAR(100)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.id,
    ce.title,
    ce.description,
    ce.event_date,
    ce.event_time,
    ce.event_type,
    ce.tag
  FROM calendar_events ce
  WHERE ce.user_id = p_user_id
    AND (ce.event_date > CURRENT_DATE 
         OR (ce.event_date = CURRENT_DATE AND ce.event_time >= CURRENT_TIME))
  ORDER BY ce.event_date, ce.event_time
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create notification preferences
CREATE OR REPLACE FUNCTION get_or_create_notification_preferences(p_user_id UUID)
RETURNS notification_preferences AS $$
DECLARE
  pref notification_preferences;
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO pref;
  
  IF NOT FOUND THEN
    SELECT * INTO pref FROM notification_preferences WHERE user_id = p_user_id;
  END IF;
  
  RETURN pref;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Sample Data (Optional - for testing)
-- ============================================

-- Uncomment to insert sample data for the current user
-- INSERT INTO calendar_events (user_id, title, description, event_date, event_time, event_type, tag)
-- VALUES 
--   (auth.uid(), 'Neural Networks – Session 3 Live', 'Deep dive into neural network architectures and backpropagation algorithms.', CURRENT_DATE, '18:00:00', 'session', 'Live Session'),
--   (auth.uid(), 'Advanced React Patterns Release', 'Learn advanced React patterns including compound components, render props, and custom hooks.', CURRENT_DATE + INTERVAL '1 day', '10:00:00', 'video', 'Video Release'),
--   (auth.uid(), 'Cybersecurity Bootcamp Begins', 'Comprehensive cybersecurity bootcamp covering network security, ethical hacking, and more.', '2024-05-12', '09:00:00', 'course', 'Course Start'),
--   (auth.uid(), 'AI in Enterprise Webinar', 'Explore how AI is transforming enterprise operations and business processes.', '2024-05-15', '19:30:00', 'webinar', 'Webinar');
