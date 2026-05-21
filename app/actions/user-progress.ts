"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function upsertUserProgress(
  userId: string,
  courseId: string,
  moduleId: string,
  completed: boolean
) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Fetch a valid course_id from 'courses' table to satisfy the legacy foreign key constraint of 'videos'
  const { data: coursesData, error: coursesError } = await supabaseAdmin
    .from("courses")
    .select("id")
    .limit(1);

  if (coursesError || !coursesData || coursesData.length === 0) {
    throw new Error("Could not find a valid course in old courses table to link videos constraint.");
  }

  const legacyCourseId = coursesData[0].id;

  // 2. Ensure video exists in 'videos' table (violates foreign key constraint otherwise)
  const { error: videoError } = await supabaseAdmin
    .from("videos")
    .upsert({
      id: moduleId,
      course_id: legacyCourseId,
    });

  if (videoError) {
    console.error("Error upserting video constraint:", videoError);
    throw new Error("Failed to ensure video registration in database: " + videoError.message);
  }

  // 3. Upsert user progress into 'user_video_progress'
  const { error: progressError } = await supabaseAdmin
    .from("user_video_progress")
    .upsert({
      user_id: userId,
      course_id: courseId,
      video_id: moduleId,
      completed: completed,
      completed_at: new Date().toISOString(),
      progress_percentage: completed ? 100 : 0
    }, {
      onConflict: "user_id,course_id,video_id"
    });

  if (progressError) {
    console.error("Error upserting user progress:", progressError);
    throw new Error("Failed to update video progress: " + progressError.message);
  }

  return { success: true };
}
