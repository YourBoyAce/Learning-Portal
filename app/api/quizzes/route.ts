import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
    supabaseAdmin: createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as unknown as SupabaseClient,
  } as const;
}

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if ("error" in auth) return auth.error;

  const courseId = new URL(request.url).searchParams.get("courseId")?.trim();
  const { data: enrollments, error: enrollmentError } = await auth.supabaseAdmin
    .schema("phase2")
    .from("enrollments")
    .select("course_id, users!inner(auth_user_id), bundles!inner(bundle_name)")
    .eq("status", "active")
    .eq("users.auth_user_id", auth.userId)
    .order("created_at", { ascending: false });
  if (enrollmentError) return NextResponse.json({ error: enrollmentError.message }, { status: 500 });

  const accessibleCourseIds = ((enrollments ?? []) as EnrollmentRow[])
    .filter((enrollment) => {
      const bundleName = String((Array.isArray(enrollment.bundles) ? enrollment.bundles[0] : enrollment.bundles)?.bundle_name || "").toLowerCase();
      return bundleName.includes("pro") || bundleName.includes("premium");
    })
    .map((enrollment) => String(enrollment.course_id));

  const requestedCourseIds = courseId ? accessibleCourseIds.filter((id) => id === courseId) : accessibleCourseIds;
  if (requestedCourseIds.length === 0) return NextResponse.json({ quizzes: [] }, { headers: { "Cache-Control": "no-store" } });

  const { data: quizzes, error: quizError } = await auth.supabaseAdmin
    .schema("phase2")
    .from("quizzes")
    .select("id, course_id, title, questions, passing_score, status")
    .eq("status", "Active")
    .in("course_id", requestedCourseIds)
    .order("created_at", { ascending: false });
  if (quizError) return NextResponse.json({ error: quizError.message }, { status: 500 });
  return NextResponse.json({ quizzes: quizzes ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
