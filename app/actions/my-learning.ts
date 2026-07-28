"use server";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type CourseMemberRow = {
  maincourse_id: number | string;
};

type CourseRow = {
  id: number | string;
  title: string | null;
  description: string | null;
  created_at: string | null;
};

export type MyLearningPayload = {
  enrollments: Array<{
    batchId: null;
    batchName: null;
    startDate: string | null;
    courseId: number | string | null;
    courseTitle: string;
    courseDescription: string;
  }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    description: string | null;
    event_date: string;
    event_time: string;
    event_type: "video" | "course" | "session" | "webinar";
  }>;
};

export async function getMyLearningData(
  accessToken: string,
): Promise<MyLearningPayload> {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }
  if (!accessToken) {
    throw new Error("Unauthorized.");
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authError } =
    await authClient.auth.getUser(accessToken);

  if (authError || !authData.user) {
    throw new Error("Invalid session.");
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as SupabaseClient;

  const userEmail = authData.user.email?.trim().toLowerCase();
  const userId = authData.user.id;
  const today = new Date().toISOString().split("T")[0];

  const { data: eventRows } = await supabaseAdmin
    .from("calendar_events")
    .select("id, title, description, event_date, event_time, event_type")
    .eq("user_id", userId)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true })
    .limit(6);

  if (!userEmail) {
    return {
      enrollments: [],
      upcomingEvents: (eventRows ?? []) as MyLearningPayload["upcomingEvents"],
    };
  }

  const { data: memberRows } = await supabaseAdmin
    .from("course_members")
    .select("maincourse_id")
    .eq("email", userEmail);

  const courseIds = ((memberRows ?? []) as CourseMemberRow[])
    .map((row) => row.maincourse_id)
    .filter((value) => value !== null && value !== undefined);

  if (courseIds.length === 0) {
    return {
      enrollments: [],
      upcomingEvents: (eventRows ?? []) as MyLearningPayload["upcomingEvents"],
    };
  }

  const { data: courseRows } = await supabaseAdmin
    .from("maincourses")
    .select("id, title, description, created_at")
    .in("id", courseIds)
    .order("created_at", { ascending: false });

  const enrollments = ((courseRows ?? []) as CourseRow[]).map((course) => {
    return {
      batchId: null,
      batchName: null,
      startDate: course.created_at,
      courseId: course.id,
      courseTitle: course.title ?? "Unassigned Course",
      courseDescription: course.description ?? "",
    };
  });

  return {
    enrollments,
    upcomingEvents: (eventRows ?? []) as MyLearningPayload["upcomingEvents"],
  };
}

