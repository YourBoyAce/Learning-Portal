import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { apiErrorResponse } from "@/app/lib/error-handler";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function mondayUtc(date = new Date()) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - offset);
  return value;
}

export async function GET(request: Request) {
  if (!url || !anon || !service) return NextResponse.json({ error: "Supabase environment variables are not configured." }, { status: 500 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const authClient = createClient(url, anon);
  const { data: authData } = await authClient.auth.getUser(token);
  if (!authData.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } }) as unknown as SupabaseClient;

  const { data: enrollments, error: enrollmentError } = await db.schema("phase2").from("enrollments")
    .select("course_id, users!inner(auth_user_id), bundles!inner(bundle_name)")
    .eq("status", "active").eq("users.auth_user_id", authData.user.id);
  if (enrollmentError) return apiErrorResponse(enrollmentError, undefined, 500);
  const coursePlans = new Map<string, string>();
  for (const row of enrollments ?? []) {
    const bundle = Array.isArray((row as any).bundles) ? (row as any).bundles[0] : (row as any).bundles;
    coursePlans.set(String((row as any).course_id), String(bundle?.bundle_name || "Starter"));
  }
  const courseIds = [...coursePlans.keys()];
  const weekStart = mondayUtc();
  const weekEnd = new Date(weekStart); weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const daily = DAY_NAMES.map((day) => ({ day, earnedPoints: 0, availablePoints: 0, activityPercent: 0 }));
  if (!courseIds.length) return NextResponse.json({ dailyPoints: daily, earnedToday: 0, availableToday: 0, currentPlan: null });

  const [modulesResult, quizzesResult, artifactsResult, attemptsResult, downloadsResult, progressResult] = await Promise.all([
    db.from("coursemodules").select("id, maincourse_id").in("maincourse_id", courseIds),
    db.schema("phase2").from("quizzes").select("id, course_id").eq("status", "Active").in("course_id", courseIds),
    db.from("course_artifacts").select("id, course_id").eq("status", "Published").in("course_id", courseIds),
    db.schema("phase2").from("user_quiz_attempts").select("quiz_id, course_id, points_awarded, completed_at").eq("user_id", authData.user.id).in("course_id", courseIds).gte("completed_at", weekStart.toISOString()).lt("completed_at", weekEnd.toISOString()),
    db.schema("phase2").from("user_artifact_downloads").select("artifact_id, course_id, points_awarded, downloaded_at").eq("user_id", authData.user.id).in("course_id", courseIds).gte("downloaded_at", weekStart.toISOString()).lt("downloaded_at", weekEnd.toISOString()),
    db.from("user_video_progress").select("video_id, course_id, completed, completed_at, updated_at").eq("user_id", authData.user.id).in("course_id", courseIds).eq("completed", true).gte("completed_at", weekStart.toISOString()).lt("completed_at", weekEnd.toISOString()),
  ]);
  const errors = [modulesResult, quizzesResult, artifactsResult, attemptsResult, downloadsResult, progressResult].map((result) => result.error).find(Boolean);
  if (errors) return apiErrorResponse(errors, undefined, 500);

  let available = 0;
  for (const courseId of courseIds) {
    available += (modulesResult.data ?? []).filter((row: any) => String(row.maincourse_id) === courseId).length * 3;
    const plan = coursePlans.get(courseId)?.toLowerCase() || "starter";
    if (plan.includes("pro") || plan.includes("premium")) {
      available += (quizzesResult.data ?? []).filter((row: any) => String(row.course_id) === courseId).length * 2;
      available += (artifactsResult.data ?? []).filter((row: any) => String(row.course_id) === courseId).length;
    }
  }
  daily.forEach((day) => { day.availablePoints = available; });
  const addPoints = (timestamp: string | null, points: number) => {
    if (!timestamp) return;
    const index = Math.floor((Date.parse(timestamp) - weekStart.getTime()) / 86_400_000);
    if (index >= 0 && index < 7) daily[index].earnedPoints += points;
  };
  (attemptsResult.data ?? []).forEach((row: any) => addPoints(row.completed_at, Number(row.points_awarded || 2)));
  (downloadsResult.data ?? []).forEach((row: any) => addPoints(row.downloaded_at, Number(row.points_awarded || 1)));
  const completedModules = new Set<string>();
  (progressResult.data ?? []).forEach((row: any) => {
    const key = `${row.course_id}:${row.video_id}`;
    if (!completedModules.has(key)) { completedModules.add(key); addPoints(row.completed_at || row.updated_at, 3); }
  });
  daily.forEach((day) => { day.activityPercent = day.availablePoints ? Math.round((day.earnedPoints / day.availablePoints) * 100) : 0; });
  const todayIndex = Math.floor((Date.now() - weekStart.getTime()) / 86_400_000);
  const planNames = [...new Set(coursePlans.values())];
  return NextResponse.json({ dailyPoints: daily, earnedToday: daily[todayIndex]?.earnedPoints || 0, availableToday: available, currentPlan: planNames.length === 1 ? planNames[0] : "Course-specific plans" });
}
