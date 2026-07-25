-- ============================================
-- Mentor Connect profiles extension Setup
-- ============================================

-- Add columns to the public.profiles table if they don't already exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cal_link TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mentor_bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mentor_expertise TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cal_event_type_id INTEGER;

-- Update RLS policies to allow profiles update on own profile (normally already true, but let's make sure it is set up)
-- Since it's public.profiles, user can update their own row.
