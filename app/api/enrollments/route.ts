import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { apiErrorResponse } from "@/app/lib/error-handler";

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
    .select("course_id, product_id, users!inner(auth_user_id)")
    .eq("users.auth_user_id", authContext.user.id)
    .eq("status", "active");

  if (memberError) {
    return apiErrorResponse(memberError, undefined, 500);
  }

  const { data: courseMembersData, error: courseMemberError } = await authContext.supabaseAdmin
    .from("course_members")
    .select("maincourse_id")
    .eq("email", userEmail)
    .eq("status", "active");

  const enrollmentCourseIds = ((memberRows ?? []) as any[])
    .map((row) => row.course_id)
    .filter((value) => value !== null && value !== undefined);

  const enrollmentProductIds = ((memberRows ?? []) as any[])
    .map((row) => row.product_id)
    .filter((value) => value !== null && value !== undefined);

  const memberCourseIds = ((courseMembersData ?? []) as any[])
    .map((row) => row.maincourse_id)
    .filter((value) => value !== null && value !== undefined);

  const directCourseIds = Array.from(new Set([...enrollmentCourseIds, ...memberCourseIds]));

  let courseQuery = authContext.supabaseAdmin
    .from("maincourses")
    .select("id, title, description, category, thumbnail_url, created_at, product_id");

  if (directCourseIds.length > 0 && enrollmentProductIds.length > 0) {
    courseQuery = courseQuery.or(
      `id.in.(${directCourseIds.join(",")}),product_id.in.(${enrollmentProductIds.join(",")})`
    );
  } else if (directCourseIds.length > 0) {
    courseQuery = courseQuery.in("id", directCourseIds);
  } else if (enrollmentProductIds.length > 0) {
    courseQuery = courseQuery.in("product_id", enrollmentProductIds);
  } else {
    return NextResponse.json({ success: true, enrollments: [] });
  }

  const { data: courseRows, error: courseError } = await courseQuery.order("created_at", { ascending: false });

  if (courseError) {
    return apiErrorResponse(courseError, undefined, 500);
  }

  const enrollments = ((courseRows ?? []) as any[]).map((course) => {
    // Find the matching enrollment row
    const matchingEnrollment = memberRows?.find(
      (r) => r.course_id === course.id || (course.product_id && r.product_id === course.product_id)
    );
    const isMentorAssignment = !matchingEnrollment && memberCourseIds.includes(course.id);
    const batchName = isMentorAssignment ? "Mentor Assignment" : (matchingEnrollment ? course.title : "");

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
