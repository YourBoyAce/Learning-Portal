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
