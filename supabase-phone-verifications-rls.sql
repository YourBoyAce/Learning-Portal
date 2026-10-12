-- ========================================================
-- Migration: Enable Row Level Security (RLS) on phone_verifications
-- ========================================================
-- Prevent public or anon key holders from reading or modifying
-- sensitive phone numbers and verification OTP hashes.
-- All operations are performed exclusively via server-side service_role.

ALTER TABLE IF EXISTS public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- Revoke default public permissions on the table
REVOKE ALL ON public.phone_verifications FROM anon, authenticated;

-- Ensure service_role maintains full access
GRANT ALL ON public.phone_verifications TO service_role;

-- Drop any existing permissive policies if they exist
DROP POLICY IF EXISTS "Deny all public access to phone_verifications" ON public.phone_verifications;
DROP POLICY IF EXISTS "Service role full access on phone_verifications" ON public.phone_verifications;

-- Explicit policy for service_role
CREATE POLICY "Service role full access on phone_verifications"
  ON public.phone_verifications
  TO service_role
  USING (true)
  WITH CHECK (true);
