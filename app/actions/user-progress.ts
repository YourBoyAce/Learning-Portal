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

  // 1. Ensure video exists in videos table (to satisfy foreign key constraints)
  const { data: existingVideo } = await supabaseAdmin
    .from("videos")
    .select("id")
    .eq("id", moduleId)
    .single();

  if (!existingVideo) {
    const { error: videoInsertError } = await supabaseAdmin
      .from("videos")
      .insert({
        id: moduleId,
        course_id: courseId,
      });

    if (videoInsertError) {
      console.error(videoInsertError);
      throw new Error(
        "Failed to register video: " + videoInsertError.message
      );
    }
  }

  // 2. Upsert progress with the continuous tracking percentage
  const { error: progressError } = await supabaseAdmin
    .from("user_video_progress")
    .upsert(
      {
        user_id: userId,
        course_id: courseId,
        video_id: moduleId,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        progress_percentage: progressPercentage, // Now uses the dynamic value
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,video_id", 
      }
    );

  if (progressError) {
    console.error("Error updating progress:", progressError);
    throw new Error(
      "Failed to update video progress: " + progressError.message
    );
  }

  return { success: true };
}