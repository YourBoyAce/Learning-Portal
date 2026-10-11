import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { apiErrorResponse } from "@/app/lib/error-handler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type EnrollmentRow = {
  course_id: string;
  bundles: { bundle_name?: string } | Array<{ bundle_name?: string }> | null;
};

async function authenticate(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return { error: NextResponse.json({ error: "Supabase environment variables are not configured." }, { status: 500 }) } as const;
  }
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) } as const;

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return { error: NextResponse.json({ error: "Invalid session." }, { status: 401 }) } as const;

  return {
    userId: data.user.id,
    userEmail: data.user.email?.trim().toLowerCase() || "",
    supabaseAdmin: createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as unknown as SupabaseClient,
  } as const;
}

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if ("error" in auth) return auth.error;

  const courseId = new URL(request.url).searchParams.get("courseId")?.trim();

  // Check user role from profiles
  const { data: profile } = await auth.supabaseAdmin
    .from("profiles")
    .select("role, email")
    .eq("id", auth.userId)
    .maybeSingle();

  const role = (profile?.role || "").toLowerCase();
  const isAdminOrInstructor = role === "admin" || role === "instructor";

  let requestedCourseIds: string[] | null = null;

  if (isAdminOrInstructor) {
    if (courseId) {
      requestedCourseIds = [courseId];
    }
  } else {
    const accessibleCourseIds = new Set<string>();

    // 1. Check phase2 enrollments
    const { data: enrollments, error: enrollmentError } = await auth.supabaseAdmin
      .schema("phase2")
      .from("enrollments")
      .select("course_id, users!inner(auth_user_id), bundles(bundle_name)")
      .eq("status", "active")
      .eq("users.auth_user_id", auth.userId)
      .order("created_at", { ascending: false });

    if (!enrollmentError && enrollments) {
      for (const e of enrollments as any[]) {
        if (e.course_id) accessibleCourseIds.add(String(e.course_id));
      }
    }

    // 2. Check course_members table
    const emailToMatch = profile?.email?.trim().toLowerCase() || auth.userEmail;
    if (emailToMatch) {
      const { data: memberRows } = await auth.supabaseAdmin
        .from("course_members")
        .select("maincourse_id")
        .eq("email", emailToMatch)
        .eq("status", "active");

      if (memberRows) {
        for (const m of memberRows as any[]) {
          if (m.maincourse_id) accessibleCourseIds.add(String(m.maincourse_id));
        }
      }
    }

    if (courseId) {
      if (!accessibleCourseIds.has(courseId)) {
        return NextResponse.json({ quizzes: [] }, { headers: { "Cache-Control": "no-store" } });
      }
      requestedCourseIds = [courseId];
    } else {
      if (accessibleCourseIds.size === 0) {
        return NextResponse.json({ quizzes: [] }, { headers: { "Cache-Control": "no-store" } });
      }
      requestedCourseIds = Array.from(accessibleCourseIds);
    }
  }

  let query = auth.supabaseAdmin
    .schema("phase2")
    .from("quizzes")
    .select("id, course_id, title, questions, passing_score, status")
    .eq("status", "Active")
    .order("created_at", { ascending: false });

  if (requestedCourseIds && requestedCourseIds.length > 0) {
    query = query.in("course_id", requestedCourseIds);
  }

  const { data: quizzes, error: quizError } = await query;
  if (quizError) return apiErrorResponse(quizError, undefined, 500);
  return NextResponse.json({ quizzes: quizzes ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
