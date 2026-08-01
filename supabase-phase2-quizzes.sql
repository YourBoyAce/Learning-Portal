-- Phase 2 quiz definitions. Apply this migration before deploying the quiz UI changes.
-- Quiz IDs intentionally remain text so existing `quiz-1` and local best-score keys stay valid.

CREATE TABLE IF NOT EXISTS phase2.quizzes (
  id TEXT PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.maincourses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  questions JSONB NOT NULL,
  passing_score INTEGER NOT NULL DEFAULT 80 CHECK (passing_score BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  attempts_count INTEGER NOT NULL DEFAULT 0 CHECK (attempts_count >= 0),
  average_score INTEGER NOT NULL DEFAULT 0 CHECK (average_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS phase2_quizzes_course_status_idx
  ON phase2.quizzes (course_id, status);

ALTER TABLE phase2.quizzes ENABLE ROW LEVEL SECURITY;

-- Bundles are intentionally not browser-readable in the existing application.
-- Run this lookup as the function owner so quiz RLS can still enforce the
-- learner's course-specific bundle without exposing the bundles table.
CREATE OR REPLACE FUNCTION phase2.can_access_course_quizzes(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = phase2, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM phase2.enrollments enrollment
    JOIN phase2.users phase2_user ON phase2_user.id = enrollment.user_id
    JOIN phase2.bundles bundle ON bundle.id = enrollment.bundle_id
    WHERE enrollment.course_id = p_course_id
      AND enrollment.status = 'active'
      AND phase2_user.auth_user_id = auth.uid()
      AND (
        LOWER(bundle.bundle_name) LIKE '%pro%'
        OR LOWER(bundle.bundle_name) LIKE '%premium%'
      )
  );
$$;

REVOKE ALL ON FUNCTION phase2.can_access_course_quizzes(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION phase2.can_access_course_quizzes(UUID) TO authenticated;

DROP POLICY IF EXISTS "Learners can read assigned active quizzes" ON phase2.quizzes;
CREATE POLICY "Learners can read assigned active quizzes"
  ON phase2.quizzes FOR SELECT TO authenticated
  USING (
    status = 'Active'
    AND phase2.can_access_course_quizzes(course_id)
  );

DROP POLICY IF EXISTS "Admins and instructors manage quizzes" ON phase2.quizzes;
CREATE POLICY "Admins and instructors manage quizzes"
  ON phase2.quizzes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND LOWER(profiles.role) IN ('admin', 'instructor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND LOWER(profiles.role) IN ('admin', 'instructor')
    )
  );

CREATE OR REPLACE FUNCTION phase2.set_quiz_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_phase2_quizzes_updated_at ON phase2.quizzes;
CREATE TRIGGER set_phase2_quizzes_updated_at
  BEFORE UPDATE ON phase2.quizzes
  FOR EACH ROW EXECUTE FUNCTION phase2.set_quiz_updated_at();

-- Idempotent seed for the three previous hard-coded definitions. A course title
-- must already exist. Fail before seeding so a missing association is never silent.
DO $$
DECLARE
  missing_course_titles TEXT;
BEGIN
  SELECT string_agg(required.title, ', ' ORDER BY required.title)
  INTO missing_course_titles
  FROM (VALUES
    ('Playwright Mastery'),
    ('CI/CD Foundations'),
    ('Ultimate Automation')
  ) AS required(title)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.maincourses
    WHERE maincourses.title = required.title
  );

  IF missing_course_titles IS NOT NULL THEN
    RAISE EXCEPTION
      'Quiz seed was not applied because these courses do not exist: %',
      missing_course_titles;
  END IF;
END;
$$;

DO $$
DECLARE
  target_course_id UUID;
BEGIN
  SELECT id INTO target_course_id FROM public.maincourses
  WHERE title = 'Playwright Mastery' LIMIT 1;
  IF target_course_id IS NULL THEN
    RAISE EXCEPTION 'Quiz seed course "Playwright Mastery" was not found.';
  ELSE
    INSERT INTO phase2.quizzes (id, course_id, title, questions, passing_score, status, attempts_count, average_score)
    VALUES ('quiz-1', target_course_id, 'Playwright Core Concepts',
      '[{"id":"q-1-1","text":"Which command is used to run Playwright tests in headless mode?","options":["npx playwright test","npx playwright test --headed","npx playwright run","npx playwright start"],"correctAnswer":0},{"id":"q-1-2","text":"What is the default test timeout in Playwright?","options":["10 seconds","30 seconds","45 seconds","60 seconds"],"correctAnswer":1},{"id":"q-1-3","text":"Which fixture provides a clean browser context for each test?","options":["browser","context","page","request"],"correctAnswer":2},{"id":"q-1-4","text":"How do you generate codegen scripts in Playwright?","options":["npx playwright record","npx playwright codegen","npx playwright generate","npx playwright build"],"correctAnswer":1},{"id":"q-1-5","text":"Which method is used to wait for a network response in Playwright?","options":["page.waitForLoadState()","page.waitForNavigation()","page.waitForResponse()","page.waitForSelector()"],"correctAnswer":2}]'::jsonb,
      80, 'Active', 48, 86)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  SELECT id INTO target_course_id FROM public.maincourses
  WHERE title = 'CI/CD Foundations' LIMIT 1;
  IF target_course_id IS NULL THEN
    RAISE EXCEPTION 'Quiz seed course "CI/CD Foundations" was not found.';
  ELSE
    INSERT INTO phase2.quizzes (id, course_id, title, questions, passing_score, status, attempts_count, average_score)
    VALUES ('quiz-2', target_course_id, 'GitHub Actions CI/CD Basics',
      '[{"id":"q-2-1","text":"In GitHub Actions, what is the default filename and extension for workflows?","options":[".github/workflows/main.json",".github/workflows/main.yml","config/workflows/main.yml",".github/actions/main.yml"],"correctAnswer":1},{"id":"q-2-2","text":"Which keyword defines the triggers for a GitHub Actions workflow?","options":["trigger","events","on","when"],"correctAnswer":2},{"id":"q-2-3","text":"Where do self-hosted runners execute workflow jobs?","options":["On GitHub's cloud virtual machines","On your own local or cloud infrastructure","Directly in the web browser console","Inside the GitHub repository's git folder"],"correctAnswer":1}]'::jsonb,
      70, 'Active', 32, 78)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  SELECT id INTO target_course_id FROM public.maincourses
  WHERE title = 'Ultimate Automation' LIMIT 1;
  IF target_course_id IS NULL THEN
    RAISE EXCEPTION 'Quiz seed course "Ultimate Automation" was not found.';
  ELSE
    INSERT INTO phase2.quizzes (id, course_id, title, questions, passing_score, status, attempts_count, average_score)
    VALUES ('quiz-3', target_course_id, 'Advanced Locators and Assertions',
      '[{"id":"q-3-1","text":"Which Playwright assertion is used to check if an element is visible?","options":["await expect(locator).toBeVisible()","await expect(locator).isVisible()","await expect(locator).toExist()","await expect(locator).toBePresent()"],"correctAnswer":0},{"id":"q-3-2","text":"Which locator strategy is highly recommended for accessibility-friendly testing?","options":["page.locator('xpath=...')","page.getByRole()","page.locator('.css-class')","page.locator('#element-id')"],"correctAnswer":1}]'::jsonb,
      80, 'Inactive', 15, 74)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;
