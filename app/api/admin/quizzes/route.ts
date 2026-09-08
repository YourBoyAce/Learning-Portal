import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { apiErrorResponse } from "@/app/lib/error-handler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Question = { id: string; text: string; options: string[]; correctAnswer: number };
type QuizInput = { title: string; courseId: string; status: "Active" | "Inactive"; passingScore: number; questions: Question[] };
type QuizRow = { id: string; course_id: string; title: string; questions: Question[]; passing_score: number; status: string; attempts_count: number; average_score: number; created_at?: string; updated_at?: string };
type CourseRow = { id: string; title: string };

async function authenticateAdmin(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return { error: NextResponse.json({ error: "Supabase environment variables are not configured." }, { status: 500 }) } as const;
  }
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) } as const;

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return { error: NextResponse.json({ error: "Invalid session." }, { status: 401 }) } as const;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: profile } = await userClient.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
  if (profile?.role?.toLowerCase() !== "admin") return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) } as const;

  return { supabaseAdmin: createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }) as unknown as SupabaseClient } as const;
}

function validateQuiz(body: unknown): QuizInput | null {
  const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const courseId = typeof value.courseId === "string" ? value.courseId.trim() : typeof value.courseId === "number" ? String(value.courseId) : "";
  const status = value.status === "Inactive" ? "Inactive" : value.status === "Active" ? "Active" : null;
  const passingScore = Number(value.passingScore);
  const questions = Array.isArray(value.questions) ? value.questions : [];
  const validQuestions = questions.filter((question: unknown): question is Question => {
    const item = question && typeof question === "object" ? question as Record<string, unknown> : {};
    return typeof item.id === "string" && item.id.trim() !== "" &&
      typeof item.text === "string" && item.text.trim() !== "" &&
      Array.isArray(item.options) && item.options.length >= 2 && item.options.every((option: unknown) => typeof option === "string") &&
      Number.isInteger(item.correctAnswer) && Number(item.correctAnswer) >= 0 && Number(item.correctAnswer) < item.options.length;
  });
  if (!title || !courseId || !status || !Number.isInteger(passingScore) || passingScore < 1 || passingScore > 100 || validQuestions.length !== questions.length || validQuestions.length === 0) return null;
  return { title, courseId, status, passingScore, questions: validQuestions };
}

async function courseExists(supabaseAdmin: SupabaseClient, courseId: string) {
  const { data, error } = await supabaseAdmin.from("maincourses").select("id").eq("id", courseId).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request);
  if ("error" in auth) return auth.error;
  const { data: quizzes, error } = await auth.supabaseAdmin.schema("phase2").from("quizzes").select("id, course_id, title, questions, passing_score, status, attempts_count, average_score, created_at, updated_at").order("created_at", { ascending: false });
  if (error) return apiErrorResponse(error, undefined, 500);
  const quizRows = (quizzes ?? []) as QuizRow[];
  const courseIds = [...new Set(quizRows.map((quiz) => quiz.course_id))];
  const { data: courses } = courseIds.length ? await auth.supabaseAdmin.from("maincourses").select("id, title").in("id", courseIds) : { data: [] };
  const courseTitleById = new Map(((courses ?? []) as CourseRow[]).map((course) => [String(course.id), course.title]));
  return NextResponse.json({ quizzes: quizRows.map((quiz) => ({ ...quiz, course_name: courseTitleById.get(String(quiz.course_id)) ?? "Unknown Course" })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request);
  if ("error" in auth) return auth.error;
  const input = validateQuiz(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "Invalid quiz data." }, { status: 400 });
  if (!(await courseExists(auth.supabaseAdmin, input.courseId))) return NextResponse.json({ error: "The selected course does not exist." }, { status: 400 });
  const id = `quiz-${crypto.randomUUID()}`;
  const { data, error } = await auth.supabaseAdmin.schema("phase2").from("quizzes").insert({ id, course_id: input.courseId, title: input.title, questions: input.questions, passing_score: input.passingScore, status: input.status }).select("id, course_id, title, questions, passing_score, status, attempts_count, average_score").single();
  if (error) return apiErrorResponse(error, undefined, 500);
  return NextResponse.json({ quiz: data }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await authenticateAdmin(request);
  if ("error" in auth) return auth.error;
  const body: unknown = await request.json().catch(() => null);
  const id = body && typeof body === "object" && typeof (body as Record<string, unknown>).id === "string" ? ((body as Record<string, unknown>).id as string).trim() : "";
  const input = validateQuiz(body);
  if (!id || !input) return NextResponse.json({ error: "Invalid quiz data." }, { status: 400 });
  if (!(await courseExists(auth.supabaseAdmin, input.courseId))) return NextResponse.json({ error: "The selected course does not exist." }, { status: 400 });
  const { error } = await auth.supabaseAdmin.schema("phase2").from("quizzes").update({ course_id: input.courseId, title: input.title, questions: input.questions, passing_score: input.passingScore, status: input.status }).eq("id", id);
  if (error) return apiErrorResponse(error, undefined, 500);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdmin(request);
  if ("error" in auth) return auth.error;
  const body: unknown = await request.json().catch(() => null);
  const id = body && typeof body === "object" && typeof (body as Record<string, unknown>).id === "string" ? ((body as Record<string, unknown>).id as string).trim() : "";
  if (!id) return NextResponse.json({ error: "A quiz id is required." }, { status: 400 });
  const { error } = await auth.supabaseAdmin.schema("phase2").from("quizzes").delete().eq("id", id);
  if (error) return apiErrorResponse(error, undefined, 500);
  return NextResponse.json({ success: true });
}
