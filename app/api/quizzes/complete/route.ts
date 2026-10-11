import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { apiErrorResponse } from "@/app/lib/error-handler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const QUIZ_COMPLETION_POINTS = 2;

type QuizQuestion = {
  id: string;
  options: string[];
  correctAnswer: number;
};

type QuizRow = {
  id: string;
  course_id: string;
  status: string;
  questions: QuizQuestion[];
};

function parseAnswers(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0 || entries.some(([questionId, answer]) => !questionId || !Number.isInteger(answer))) {
    return null;
  }
  return Object.fromEntries(entries.map(([questionId, answer]) => [questionId, Number(answer)]));
}

function isQuizQuestion(value: unknown): value is QuizQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Record<string, unknown>;
  return typeof question.id === "string" &&
    Array.isArray(question.options) &&
    question.options.every((option) => typeof option === "string") &&
    Number.isInteger(question.correctAnswer);
}

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

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if ("error" in auth) return auth.error;

  const body: unknown = await request.json().catch(() => null);
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const quizId = typeof payload.quizId === "string" ? payload.quizId.trim() : "";
  const answers = parseAnswers(payload.answers);
  if (!quizId || !answers) return NextResponse.json({ error: "A quiz and its answers are required." }, { status: 400 });

  const { data: quiz, error: quizError } = await auth.supabaseAdmin
    .schema("phase2")
    .from("quizzes")
    .select("id, course_id, status, questions")
    .eq("id", quizId)
    .maybeSingle();
  if (quizError) return apiErrorResponse(quizError, undefined, 500);
  if (!quiz || quiz.status !== "Active" || !Array.isArray(quiz.questions) || !quiz.questions.every(isQuizQuestion)) {
    return NextResponse.json({ error: "This quiz is not available." }, { status: 404 });
  }

  const quizRow = quiz as QuizRow;

  // Check role from profiles
  const { data: profile } = await auth.supabaseAdmin
    .from("profiles")
    .select("role, email")
    .eq("id", auth.userId)
    .maybeSingle();

  const role = (profile?.role || "").toLowerCase();
  const isAdminOrInstructor = role === "admin" || role === "instructor";

  if (!isAdminOrInstructor) {
    const { data: enrollment, error: enrollmentError } = await auth.supabaseAdmin
      .schema("phase2")
      .from("enrollments")
      .select("course_id, users!inner(auth_user_id), bundles(bundle_name)")
      .eq("course_id", quizRow.course_id)
      .eq("status", "active")
      .eq("users.auth_user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (enrollmentError) return apiErrorResponse(enrollmentError, undefined, 500);

    const bundleName = String((enrollment as { bundles?: { bundle_name?: string } | null } | null)?.bundles?.bundle_name || "").toLowerCase();
    let hasAccess = Boolean(enrollment && (bundleName.includes("pro") || bundleName.includes("premium")));

    if (!hasAccess) {
      const emailToMatch = profile?.email?.trim().toLowerCase() || auth.userEmail;
      if (emailToMatch) {
        const { data: member } = await auth.supabaseAdmin
          .from("course_members")
          .select("id")
          .eq("maincourse_id", quizRow.course_id)
          .eq("email", emailToMatch)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (member) hasAccess = true;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Quiz access is not available for this enrollment." }, { status: 403 });
    }
  }

  const answersAreCompleteAndValid = quizRow.questions.every((question) => {
    const answer = answers[question.id];
    return Number.isInteger(answer) && answer >= 0 && answer < question.options.length;
  });
  if (!answersAreCompleteAndValid) return NextResponse.json({ error: "Complete every quiz question before viewing results." }, { status: 400 });

  const correctAnswers = quizRow.questions.filter((question) => answers[question.id] === question.correctAnswer).length;
  const score = Math.round((correctAnswers / quizRow.questions.length) * 100);
  // The table's existing (user_id, course_id, quiz_id) unique constraint is
  // the concurrency-safe guard against awarding points for a retake.
  const { error: insertError } = await auth.supabaseAdmin
    .schema("phase2")
    .from("user_quiz_attempts")
    .insert({
      user_id: auth.userId,
      course_id: quizRow.course_id,
      quiz_id: quizRow.id,
      score,
      points_awarded: QUIZ_COMPLETION_POINTS,
      completed_at: new Date().toISOString(),
    });

  if (insertError?.code === "23505") {
    return NextResponse.json({ success: true, awarded: false, score });
  }
  if (insertError) return apiErrorResponse(insertError, undefined, 500);
  return NextResponse.json({ success: true, awarded: true, score });
}
