"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function upsertUserProgress(
  userId: string,
  courseId: string,
  moduleId: string,
  progressPercentage: number,
  completed: boolean
) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const payload = {
    user_id: userId,
    course_id: courseId,
    video_id: moduleId,
    completed,
    completed_at: completed ? new Date().toISOString() : null,
    progress_percentage: progressPercentage,
    updated_at: new Date().toISOString(),
  };

  const { data: existingRow, error: existingRowError } = await supabaseAdmin
    .from("user_video_progress")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("video_id", moduleId)
    .maybeSingle();

  if (existingRowError) {
    console.error("Error checking existing progress row:", existingRowError);
    throw new Error(
      "Failed to check existing video progress: " + existingRowError.message,
    );
  }

  if (existingRow?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("user_video_progress")
      .update(payload)
      .eq("id", existingRow.id);

    if (updateError) {
      console.error("Error updating progress:", updateError);
      throw new Error("Failed to update video progress: " + updateError.message);
    }
  } else {
    const { error: insertError } = await supabaseAdmin
      .from("user_video_progress")
      .insert(payload);

    if (insertError) {
      console.error("Error inserting progress:", insertError);
      throw new Error("Failed to insert video progress: " + insertError.message);
    }
  }

  return { success: true };
}
