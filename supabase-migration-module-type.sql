-- Migration: Add module_type and questions columns to coursemodules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coursemodules' AND column_name = 'module_type'
  ) THEN
    ALTER TABLE coursemodules ADD COLUMN module_type TEXT DEFAULT 'video';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coursemodules' AND column_name = 'questions'
  ) THEN
    ALTER TABLE coursemodules ADD COLUMN questions JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;
