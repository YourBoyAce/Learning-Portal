// "use server";

// import { createClient } from "@supabase/supabase-js";

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// export async function getCourseProgress(userId: string, courseId: string) {
//   if (!supabaseUrl || !supabaseServiceRoleKey) {
//     throw new Error("Supabase environment variables are not configured.");
//   }

//   const supabaseAdmin = createClient(
//     supabaseUrl,
//     supabaseServiceRoleKey,
//     {
//       auth: { persistSession: false },
//     }
//   );

//   try {
//     // 1. Get total number of course modules in this course
//     const { count: totalModules, error: totalError } = await supabaseAdmin
//       .from("coursemodules")
//       .select("*", { count: "exact", head: true })
//       .eq("maincourse_id", courseId);

//     if (totalError) throw totalError;

//     // 2. Get number of COMPLETED videos/modules for this specific user in this course
//     const { count: completedModules, error: completedError } = await supabaseAdmin
//       .from("user_video_progress")
//       .select("*", { count: "exact", head: true })
//       .eq("user_id", userId)
//       .eq("course_id", courseId)
//       .eq("completed", true);

//     if (completedError) throw completedError;

//     // 3. Calculate the percentage safely
//     const total = totalModules || 0;
//     const completed = completedModules || 0;
    
//     const progressPercentage = total > 0 
//       ? Math.round((completed / total) * 100) 
//       : 0;

//     return {
//       progressPercentage,
//       completedModules: completed,
//       totalModules: total,
//     };
    
//   } catch (error: any) {
//     console.error("Failed to fetch course progress:", error);
//     return {
//       progressPercentage: 0,
//       completedModules: 0,
//       totalModules: 0,
//     };
//   }
// }
"use server";

import { createClient } from "@supabase/supabase-js";
import { calculateCourseProgress } from "@/app/lib/course-progress";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function getCourseProgress(userId: string, courseId: string) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: { persistSession: false },
    }
  );

  try {
    // 1. Get all modules for this course
    const { data: modules, error: modulesError } = await supabaseAdmin
      .from("coursemodules")
      .select("id, video_cf_id, module_type, questions")
      .eq("maincourse_id", courseId)
      .order("order_index", { ascending: true });

    if (modulesError) throw modulesError;

    // 2. Get user's video progress for this course
    const { data: progressData, error: progressError } = await supabaseAdmin
      .from("user_video_progress")
      .select("video_id, completed, updated_at")
      .eq("user_id", userId)
      .eq("course_id", courseId);

    if (progressError) throw progressError;

    return calculateCourseProgress(modules ?? [], progressData ?? []);
    
  } catch (error: any) {
    console.error("Failed to fetch course progress:", error);
    return {
      progressPercentage: 0,
      completedModules: 0,
      totalModules: 0,
    };
  }
}
