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

type CalendarEventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string;
  event_type: "video" | "course" | "session" | "webinar";
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
  const userId = authContext.user.id;

  const today = new Date().toISOString().split("T")[0];

  const { data: eventRows, error: eventError } = await authContext.supabaseAdmin
    .from("calendar_events")
    .select("id, title, description, event_date, event_time, event_type")
    .eq("user_id", userId)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true })
    .limit(6);

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  if (!userEmail) {
    return NextResponse.json({
      success: true,
      enrollments: [],
      upcomingEvents: (eventRows ?? []) as CalendarEventRow[],
    });
  }

  const { data: memberRows, error: memberError } = await authContext.supabaseAdmin
    .from("course_members")
    .select("maincourse_id")
    .eq("email", userEmail);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const courseIds = ((memberRows ?? []) as any[])
    .map((row) => row.maincourse_id)
    .filter((value) => value !== null && value !== undefined);

  if (courseIds.length === 0) {
    return NextResponse.json({
      success: true,
      enrollments: [],
      upcomingEvents: (eventRows ?? []) as CalendarEventRow[],
    });
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
    return {
      batchId: null,
      batchName: null,
      startDate: course.created_at, // fallback
      courseId: course.id,
      courseTitle: course.title ?? "Unassigned Course",
      courseDescription: course.description ?? "",
      courseCategory: course.category ?? "General",
      courseThumbnail: course.thumbnail_url ?? "",
    };
  });

  return NextResponse.json({
    success: true,
    enrollments,
    upcomingEvents: (eventRows ?? []) as CalendarEventRow[],
  });
}

