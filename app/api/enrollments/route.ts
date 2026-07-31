import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type BatchMemberRow = {
  batch_id: number | string;
};

type BatchRow = {
  id: number | string;
  name: string | null;
  course_id: number | string | null;
  start_date: string | null;
};

type CourseRow = {
  id: number | string;
  title: string | null;
  description: string | null;
  category?: string | null;
  thumbnail_url?: string | null;
};

async function authenticateUser(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return {
      error: NextResponse.json(
        { error: "Supabase environment variables are not configured." },
        { status: 500 },
      ),
    } as const;
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    } as const;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return {
      error: NextResponse.json({ error: "Invalid session." }, { status: 401 }),
    } as const;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as unknown as SupabaseClient;

  return {
    user: authData.user,
    supabaseAdmin,
  } as const;
}

export async function GET(request: Request) {
  const authContext = await authenticateUser(request);
  if ("error" in authContext) {
    return authContext.error;
  }

  const userEmail = authContext.user.email?.trim().toLowerCase();
  if (!userEmail) {
    return NextResponse.json({ success: true, enrollments: [] });
  }

  const { data: memberRows, error: memberError } = await authContext.supabaseAdmin
    .schema("phase2")
    .from("enrollments")
    .select("course_id, batch_type, users!inner(auth_user_id)")
    .eq("users.auth_user_id", authContext.user.id)
    .eq("status", "active");

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const courseIds = ((memberRows ?? []) as any[])
    .map((row) => row.course_id)
    .filter((value) => value !== null && value !== undefined);

  if (courseIds.length === 0) {
    return NextResponse.json({ success: true, enrollments: [] });
  }

  const { data: courseRows, error: courseError } = await authContext.supabaseAdmin
    .from("maincourses")
    .select("id, title, description, category, thumbnail_url, created_at")
    .in("id", courseIds)
    .order("created_at", { ascending: false });

  if (courseError) {
    return NextResponse.json({ error: courseError.message }, { status: 500 });
  }

  const enrollments = ((courseRows ?? []) as any[]).map((course) => {
    // Find the matching enrollment row to get the batch_type
    const matchingEnrollment = memberRows?.find(r => r.course_id === course.id);
    const batchName = matchingEnrollment?.batch_type || course.batch_type || "Weekday";

    return {
      batchId: null,
      batchName: batchName,
      startDate: course.created_at, // fallback
      courseId: course.id,
      courseTitle: course.title ?? "Unassigned Course",
      courseDescription: course.description ?? "",
      courseCategory: course.category ?? "General",
      courseThumbnail: course.thumbnail_url ?? "",
    };
  });

  return NextResponse.json({ success: true, enrollments });
}
