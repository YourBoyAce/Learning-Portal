"use server";

import { createClient } from "@supabase/supabase-js";

export type UserTier = "Starter" | "Pro" | "Premium" | null;

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
  if (authPlan === "starter") return "Starter";
  if (authPlan === "pro") return "Pro";
  if (authPlan === "premium") return "Premium";

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
  if (authPlan === "starter") return "Starter";
  if (authPlan === "pro") return "Pro";
  if (authPlan === "premium") return "Premium";

  const { data: phase2User } = await supabaseAdmin
    .schema("phase2")
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const targetUserId = phase2User?.id || authUserId;

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
    const { data: courseMember } = await supabaseAdmin
      .from("course_members")
      .select("id")
      .eq("maincourse_id", courseId)
      .eq("status", "active")
      .maybeSingle();

    return courseMember ? "Starter" : null;
  }

  const bundleName: string =
    (enrollment.bundles as any)?.bundle_name || "Starter";
  const lower = bundleName.toLowerCase();

  if (lower.includes("premium")) return "Premium";
  if (lower.includes("pro")) return "Pro";
  return "Starter";
}
