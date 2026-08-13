"use server";

import { createClient } from "@supabase/supabase-js";

export async function getPremiumMentors(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseServiceRoleKey) return { mentors: [], error: "Missing env vars" };

  try {
    // 1. Verify user identity
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user } } = await authClient.auth.getUser(accessToken);
    if (!user) return { mentors: [], error: "Unauthorized" };

    const authUserId = user.id;

    // 2. Admin client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Resolve phase2 user id
    const { data: phase2User } = await supabaseAdmin
      .schema("phase2")
      .from("users")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    const targetUserId = phase2User?.id || authUserId;

    // 4. Find all active enrollments for this user and their bundles
    const { data: enrollments } = await supabaseAdmin
      .schema("phase2")
      .from("enrollments")
      .select("course_id, bundles(bundle_name)")
      .eq("user_id", targetUserId)
      .eq("status", "active");

    if (!enrollments || enrollments.length === 0) {
      return { mentors: [], error: null };
    }

    // Filter only Pro/Premium courses
    const premiumCourseIds: (string | number)[] = [];
    for (const enrollment of enrollments) {
      const bundleName = (enrollment.bundles as any)?.bundle_name || "Starter";
      const lower = bundleName.toLowerCase();
      if (lower.includes("premium") || lower.includes("pro")) {
        if (enrollment.course_id) {
          premiumCourseIds.push(enrollment.course_id);
        }
      }
    }

    if (premiumCourseIds.length === 0) {
      return { mentors: [], error: null };
    }

    // 5. Find all mentors assigned to these premium courses
    const { data: siblingCourseMembers, error: siblingError } = await supabaseAdmin
      .from("course_members")
      .select("email")
      .in("maincourse_id", premiumCourseIds);

    if (siblingError) throw siblingError;

    const mentorEmails = (siblingCourseMembers ?? [])
      .map((cm: any) => cm.email?.trim().toLowerCase())
      .filter(Boolean);

    if (mentorEmails.length === 0) {
      return { mentors: [], error: null };
    }

    // 6. Query profiles to get the actual mentors
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, cal_link, mentor_bio, mentor_expertise")
      .in("email", mentorEmails)
      .in("role", ["instructor", "admin"]);

    if (error) throw error;

    if (data) {
      const formatted = data.map((item: any) => ({
        id: item.id,
        full_name: item.full_name || "Instructor",
        email: item.email || "",
        role: item.role === "admin" ? "Lead Mentor" : "Cohort Mentor",
        cal_link: item.cal_link || "",
        mentor_bio: item.mentor_bio || "Experienced technical educator ready to help you master your curriculum journey.",
        mentor_expertise: Array.isArray(item.mentor_expertise) ? item.mentor_expertise : [],
      }));
      return { mentors: formatted, error: null };
    }

    return { mentors: [], error: null };
  } catch (err: any) {
    console.error("Error fetching premium mentors:", err);
    return { mentors: [], error: err.message || "Failed to fetch mentors" };
  }
}
