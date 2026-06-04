"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const normalizeProgressIds = (moduleId: string, aliasIds: string[] = []) =>
  Array.from(
    new Set(
      [moduleId, ...aliasIds]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

const isMissingResumeColumnError = (error: { message?: string; code?: string }) => {
  const message = String(error.message || "").toLowerCase();
  return (
    error.code === "42703" ||
    (message.includes("last_position_seconds") && message.includes("column"))
  );
};

export async function upsertUserProgress(
  userId: string,
  courseId: string,
  moduleId: string,
  progressPercentage: number,
  completed: boolean,
  aliasIds: string[] = [],
  lastPositionSeconds?: number,
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

  const progressPayload = {
    completed,
    completed_at: completed ? new Date().toISOString() : null,
    progress_percentage: progressPercentage,
    updated_at: new Date().toISOString(),
    ...(typeof lastPositionSeconds === "number" && {
      last_position_seconds: completed
        ? 0
        : Math.max(0, Math.floor(lastPositionSeconds)),
    }),
  };

  const videoIds = normalizeProgressIds(moduleId, aliasIds);

  const primaryVideoId = videoIds[0];
  if (!primaryVideoId) {
    throw new Error("A module/video id is required to save progress.");
  }

  const { data: existingRows, error: existingRowError } = await supabaseAdmin
    .from("user_video_progress")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .in("video_id", videoIds);

  if (existingRowError) {
    console.error("Error checking existing progress row:", existingRowError);
    throw new Error(
      "Failed to check existing video progress: " + existingRowError.message,
    );
  }

  const existingIds = existingRows?.map((row) => row.id).filter(Boolean) ?? [];

  if (existingIds.length > 0) {
    let { error: updateError } = await supabaseAdmin
      .from("user_video_progress")
      .update(progressPayload)
      .in("id", existingIds);

    if (updateError && isMissingResumeColumnError(updateError)) {
      const { last_position_seconds: _lastPositionSeconds, ...fallbackPayload } =
        progressPayload as typeof progressPayload & {
          last_position_seconds?: number;
        };
      const fallbackResult = await supabaseAdmin
        .from("user_video_progress")
        .update(fallbackPayload)
        .in("id", existingIds);
      updateError = fallbackResult.error;
    }

    if (updateError) {
      console.error("Error updating progress:", updateError);
      throw new Error("Failed to update video progress: " + updateError.message);
    }
  } else {
    const insertPayload = {
      user_id: userId,
      course_id: courseId,
      video_id: primaryVideoId,
      ...progressPayload,
    };

    let { error: insertError } = await supabaseAdmin
      .from("user_video_progress")
      .insert(insertPayload);

    if (insertError && isMissingResumeColumnError(insertError)) {
      const { last_position_seconds: _lastPositionSeconds, ...fallbackPayload } =
        insertPayload as typeof insertPayload & {
          last_position_seconds?: number;
        };
      const fallbackResult = await supabaseAdmin
        .from("user_video_progress")
        .insert(fallbackPayload);
      insertError = fallbackResult.error;
    }

    if (insertError) {
      console.error("Error inserting progress:", insertError);
      throw new Error("Failed to insert video progress: " + insertError.message);
    }
  }

  return { success: true };
}

export async function saveUserPlaybackPosition(
  userId: string,
  courseId: string,
  moduleId: string,
  lastPositionSeconds: number,
  progressPercentage: number,
  aliasIds: string[] = [],
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

  const videoIds = normalizeProgressIds(moduleId, aliasIds);
  const primaryVideoId = videoIds[0];
  if (!primaryVideoId) {
    throw new Error("A module/video id is required to save playback position.");
  }

  const resumePayload = {
    last_position_seconds: Math.max(0, Math.floor(lastPositionSeconds)),
    progress_percentage: Math.max(0, Math.min(99, Math.floor(progressPercentage))),
    updated_at: new Date().toISOString(),
  };

  const { data: existingRows, error: existingRowError } = await supabaseAdmin
    .from("user_video_progress")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .in("video_id", videoIds);

  if (existingRowError) {
    throw new Error(
      "Failed to check existing playback position: " + existingRowError.message,
    );
  }

  const existingIds = existingRows?.map((row) => row.id).filter(Boolean) ?? [];
  if (existingIds.length > 0) {
    let { error: updateError } = await supabaseAdmin
      .from("user_video_progress")
      .update(resumePayload)
      .in("id", existingIds);

    if (updateError && isMissingResumeColumnError(updateError)) {
      const { last_position_seconds: _lastPositionSeconds, ...fallbackPayload } =
        resumePayload;
      const fallbackResult = await supabaseAdmin
        .from("user_video_progress")
        .update(fallbackPayload)
        .in("id", existingIds);
      updateError = fallbackResult.error;
    }

    if (updateError) {
      throw new Error(
        "Failed to update playback position: " + updateError.message,
      );
    }
  } else {
    const insertPayload = {
      user_id: userId,
      course_id: courseId,
      video_id: primaryVideoId,
      completed: false,
      completed_at: null,
      ...resumePayload,
    };

    let { error: insertError } = await supabaseAdmin
      .from("user_video_progress")
      .insert(insertPayload);

    if (insertError && isMissingResumeColumnError(insertError)) {
      const { last_position_seconds: _lastPositionSeconds, ...fallbackPayload } =
        insertPayload;
      const fallbackResult = await supabaseAdmin
        .from("user_video_progress")
        .insert(fallbackPayload);
      insertError = fallbackResult.error;
    }

    if (insertError) {
      throw new Error(
        "Failed to insert playback position: " + insertError.message,
      );
    }
  }

  return { success: true };
}
