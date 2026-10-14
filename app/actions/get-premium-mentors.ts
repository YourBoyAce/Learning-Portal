"use server";

import { createClient } from "@supabase/supabase-js";
import { logError } from "@/app/lib/error-handler";

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
    const userEmail = user.email?.trim().toLowerCase();

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

    // 4. Collect all course IDs for this user from both phase2.enrollments AND course_members
    const userCourseIds = new Set<string | number>();

    // From phase2.enrollments
    const { data: enrollments } = await supabaseAdmin
      .schema("phase2")
      .from("enrollments")
      .select("course_id")
      .eq("user_id", targetUserId)
      .eq("status", "active");

    if (enrollments) {
      for (const e of enrollments) {
        if (e.course_id) userCourseIds.add(e.course_id);
      }
    }

    // From course_members
    if (userEmail) {
      const { data: memberships } = await supabaseAdmin
        .from("course_members")
        .select("maincourse_id")
        .ilike("email", userEmail);

      if (memberships) {
        for (const m of memberships) {
          if (m.maincourse_id) userCourseIds.add(m.maincourse_id);
        }
      }
    }

    // 5. Query sibling course members to find mentors assigned to user's courses
    let mentorEmails: string[] = [];
    if (userCourseIds.size > 0) {
      const { data: siblingCourseMembers } = await supabaseAdmin
        .from("course_members")
        .select("email")
        .in("maincourse_id", Array.from(userCourseIds));

      if (siblingCourseMembers) {
        mentorEmails = siblingCourseMembers
          .map((cm: any) => cm.email?.trim().toLowerCase())
          .filter((em: string) => Boolean(em) && em !== userEmail);
      }
    }

    let mentorsData: any[] = [];
    if (mentorEmails.length > 0) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, role, cal_link, mentor_bio, mentor_expertise, cal_event_type_id")
        .in("role", ["instructor", "admin"])
        .in("email", mentorEmails);

      if (data && data.length > 0) {
        mentorsData = data;
      }
    }

    // Fallback: If no mentors are explicitly assigned in the course yet, load active platform mentors
    if (mentorsData.length === 0) {
      const { data: allMentors } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, role, cal_link, mentor_bio, mentor_expertise, cal_event_type_id")
        .in("role", ["instructor", "admin"])
        .limit(10);

      mentorsData = allMentors || [];
    }

    const formatted = mentorsData.map((item: any) => ({
      id: item.id,
      full_name: item.full_name || "Instructor",
      email: item.email || "",
      role: item.role === "admin" ? "Lead Mentor" : "Cohort Mentor",
      cal_link: item.cal_link || "",
      cal_event_type_id: item.cal_event_type_id || null,
      mentor_bio: item.mentor_bio || "Experienced technical educator ready to help you master your curriculum journey.",
      mentor_expertise: Array.isArray(item.mentor_expertise) ? item.mentor_expertise : [],
    }));

    return { mentors: formatted, error: null };
  } catch (err: any) {
    console.error("Error fetching premium mentors:", err);
    return { mentors: [], error: logError(err).message };
  }
}
