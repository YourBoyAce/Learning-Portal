"use server";

import { createClient } from "@supabase/supabase-js";

import { UserTier } from "@/app/lib/tier.constants";

const DEMO_PREMIUM_EMAILS = [
  "premium@gmail.com",
  "demouser@gmail.com",
  "user@example.com",
];

function getAuthUserPlanFromMetadata(
  user: {
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  } | null,
): string | null {
  const metadataPlan =
    user?.user_metadata?.plan ??
    user?.app_metadata?.plan ??
    user?.user_metadata?.tier ??
    user?.app_metadata?.tier;

  const normalized = String(metadataPlan ?? "")
    .trim()
    .toLowerCase();
  return ["starter", "pro", "premium"].includes(normalized) ? normalized : null;
}

export async function getUserTier(accessToken: string): Promise<UserTier> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseServiceRoleKey) return null;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
  } = await authClient.auth.getUser(accessToken);
  if (!user) return null;

  const authUserId = user.id;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", authUserId)
    .maybeSingle();

  const role = profile?.role?.toLowerCase() ?? "";
  if (role === "admin" || role === "instructor") return "Premium";

  if (DEMO_PREMIUM_EMAILS.includes((user.email ?? "").toLowerCase())) {
    return "Premium";
  }

  const authPlan = getAuthUserPlanFromMetadata(user);
  let resolvedTier: UserTier = null;
  
  if (authPlan === "premium") resolvedTier = "Premium";
  else if (authPlan === "pro") resolvedTier = "Pro";
  else if (authPlan === "starter") resolvedTier = "Starter";

  const { data: phase2User } = await supabaseAdmin
    .schema("phase2")
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const targetUserId = phase2User?.id || authUserId;

  const { data: enrollments } = await supabaseAdmin
    .schema("phase2")
    .from("enrollments")
    .select("*, bundles(bundle_name)")
    .eq("user_id", targetUserId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (enrollments && enrollments.length > 0) {
    if (resolvedTier === null) resolvedTier = "Starter"; // Baseline if they have enrollments
    for (const enrollment of enrollments) {
      const b = enrollment.bundles as any;
      const bundleName = Array.isArray(b) ? (b[0]?.bundle_name ?? "Starter") : (b?.bundle_name ?? "Starter");
      if (typeof bundleName === "string") {
        const lowerName = bundleName.toLowerCase();
        if (lowerName.includes("premium")) {
          resolvedTier = "Premium";
          break; // Max possible tier
        } else if (lowerName.includes("pro") && resolvedTier !== "Premium") {
          resolvedTier = "Pro";
        }
      }
    }
  }

  return resolvedTier;
}

export async function getCourseUserTier(
  accessToken: string,
  courseId: string,
): Promise<UserTier> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseServiceRoleKey || !courseId) return null;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
  } = await authClient.auth.getUser(accessToken);
  if (!user) return null;

  const authUserId = user.id;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", authUserId)
    .maybeSingle();

  const role = profile?.role?.toLowerCase() ?? "";
  if (role === "admin" || role === "instructor") {
    return "Premium";
  }

  const authPlan = getAuthUserPlanFromMetadata(user);
  let resolvedTier: UserTier = null;
  
  if (authPlan === "premium") resolvedTier = "Premium";
  else if (authPlan === "pro") resolvedTier = "Pro";
  else if (authPlan === "starter") resolvedTier = "Starter";

  const { data: phase2User } = await supabaseAdmin
    .schema("phase2")
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const targetUserId = phase2User?.id || authUserId;

  const { data: enrollments } = await supabaseAdmin
    .schema("phase2")
    .from("enrollments")
    .select("*, bundles(bundle_name)")
    .eq("user_id", targetUserId)
    .or(`course_id.eq.${courseId},product_id.eq.${courseId}`)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (!enrollments || enrollments.length === 0) {
    const { data: courseMember } = await supabaseAdmin
      .from("course_members")
      .select("id")
      .eq("maincourse_id", courseId)
      .eq("email", user.email)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (courseMember && resolvedTier === null) {
      resolvedTier = "Starter";
    }
  } else {
    if (resolvedTier === null) resolvedTier = "Starter";
    for (const enrollment of enrollments) {
      const b = enrollment.bundles as any;
      const bundleName = Array.isArray(b) ? (b[0]?.bundle_name ?? "Starter") : (b?.bundle_name ?? "Starter");
      if (typeof bundleName === "string") {
        const lowerName = bundleName.toLowerCase();
        if (lowerName.includes("premium")) {
          resolvedTier = "Premium";
          break; // Max possible
        } else if (lowerName.includes("pro") && resolvedTier !== "Premium") {
          resolvedTier = "Pro";
        }
      }
    }
  }

  return resolvedTier;
}
