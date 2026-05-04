"use server";

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
};

export type MyLearningPayload = {
  enrollments: Array<{
    batchId: number | string;
    batchName: string;
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
    .from("batch_members")
    .select("batch_id")
    .eq("email", userEmail);

  const batchIds = ((memberRows ?? []) as BatchMemberRow[])
    .map((row) => row.batch_id)
    .filter((value) => value !== null && value !== undefined);

  if (batchIds.length === 0) {
    return {
      enrollments: [],
      upcomingEvents: (eventRows ?? []) as MyLearningPayload["upcomingEvents"],
    };
  }

  const { data: batchRows } = await supabaseAdmin
    .from("batches")
    .select("id, name, course_id, start_date")
    .in("id", batchIds)
    .order("start_date", { ascending: true });

  const courseIds = Array.from(
    new Set(
      ((batchRows ?? []) as BatchRow[])
        .map((batch) => batch.course_id)
        .filter((courseId): courseId is string | number => courseId !== null),
    ),
  );

  let courseById = new Map<string, CourseRow>();
  if (courseIds.length > 0) {
    const { data: courseRows } = await supabaseAdmin
      .from("maincourses")
      .select("id, title, description")
      .in("id", courseIds);

    courseById = new Map(
      ((courseRows ?? []) as CourseRow[]).map((course) => [
        String(course.id),
        course,
      ]),
    );
  }

  const enrollments = ((batchRows ?? []) as BatchRow[]).map((batch) => {
    const course = batch.course_id ? courseById.get(String(batch.course_id)) : null;
    return {
      batchId: batch.id,
      batchName: batch.name ?? "Untitled Batch",
      startDate: batch.start_date,
      courseId: batch.course_id,
      courseTitle: course?.title ?? "Unassigned Course",
      courseDescription: course?.description ?? "",
    };
  });

  return {
    enrollments,
    upcomingEvents: (eventRows ?? []) as MyLearningPayload["upcomingEvents"],
  };
}

