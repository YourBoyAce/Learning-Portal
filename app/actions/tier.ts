"use server";

import { createClient } from "@supabase/supabase-js";

export type UserTier = "Starter" | "Pro" | "Premium" | null;

export async function getUserTier(accessToken: string): Promise<UserTier> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseServiceRoleKey) return null;

  // 1. Verify user
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user } } = await authClient.auth.getUser(accessToken);
  if (!user) return null;

  const authUserId = user.id;

  // 2. Admin client to bypass RLS on bundles table
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", authUserId)
    .single();

  if (profile?.role?.toLowerCase() === "instructor" || profile?.role?.toLowerCase() === "admin") {
    return "Premium";
  }

  // 3. Get phase2 user id
  const { data: phase2User } = await supabaseAdmin
    .schema("phase2")
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const targetUserId = phase2User?.id || authUserId;

  // 4. Get enrollments with bundles
  const { data: enrollments } = await supabaseAdmin
    .schema("phase2")
    .from("enrollments")
    .select("*, bundles(bundle_name)")
    .eq("user_id", targetUserId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (!enrollments || enrollments.length === 0) return null;

  let resolvedTier: UserTier = "Starter";
  for (const enrollment of enrollments) {
    const bundleName = (enrollment.bundles as any)?.bundle_name || "Starter";
    if (typeof bundleName === "string") {
      const lowerName = bundleName.toLowerCase();
      if (lowerName.includes("premium")) {
        resolvedTier = "Premium";
        break;
      } else if (lowerName.includes("pro") && resolvedTier === "Starter") {
        resolvedTier = "Pro";
      }
    }
  }

  return resolvedTier;
}

/**
 * Returns the plan tier for a specific course enrollment.
 * Unlike getUserTier (which returns the global max tier across all enrollments),
 * this function scopes the tier strictly to the given courseId.
 *
 * Feature gates on the course player MUST use this function so that:
 *   - Course A (Starter) does NOT inherit Pro features from Course B (Pro).
 *   - Course B (Pro) only unlocks Pro features within Course B.
 *
 * @param accessToken - The user's current Supabase access token
 * @param courseId    - The specific course UUID to evaluate
 */
export async function getCourseUserTier(
  accessToken: string,
  courseId: string,
): Promise<UserTier> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseServiceRoleKey || !courseId) return null;

  // 1. Verify user identity
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user } } = await authClient.auth.getUser(accessToken);
  if (!user) return null;

  const authUserId = user.id;

  // 2. Admin client to bypass RLS
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Instructors and admins always get Premium on any course
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", authUserId)
    .single();

  if (
    profile?.role?.toLowerCase() === "instructor" ||
    profile?.role?.toLowerCase() === "admin"
  ) {
    return "Premium";
  }

  // 4. Resolve phase2 user id
  const { data: phase2User } = await supabaseAdmin
    .schema("phase2")
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const targetUserId = phase2User?.id || authUserId;

  // 5. Find the enrollment for this specific course
  const { data: enrollment } = await supabaseAdmin
    .schema("phase2")
    .from("enrollments")
    .select("*, bundles(bundle_name)")
    .eq("user_id", targetUserId)
    .eq("course_id", courseId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!enrollment) {
    // No active enrollment for this course — check legacy course_members fallback
    const { data: courseMember } = await supabaseAdmin
      .from("course_members")
      .select("id")
      .eq("maincourse_id", courseId)
      .eq("status", "active")
      .maybeSingle();

    // course_members entries are typically mentor-assigned (Starter by default)
    return courseMember ? "Starter" : null;
  }

  // 6. Derive tier from the bundle linked to this enrollment
  const bundleName: string = (enrollment.bundles as any)?.bundle_name || "Starter";
  const lower = bundleName.toLowerCase();

  if (lower.includes("premium")) return "Premium";
  if (lower.includes("pro")) return "Pro";
  return "Starter";
}
