-- Add meet_link to store the Google Meet URL per session
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS meet_link TEXT;

-- Add Cal.com event type ID to mentor profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cal_event_type_id INTEGER;
