import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { apiErrorResponse } from "@/app/lib/error-handler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function authenticate(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return {
      error: NextResponse.json(
        { error: "Supabase environment variables are not configured." },
        { status: 500 },
      ),
    } as const;
  }

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    } as const;
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return {
      error: NextResponse.json({ error: "Invalid session." }, { status: 401 }),
    } as const;
  }

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

  const body = await request.json().catch(() => null);
  const { quizId, questionId, selectedAnswer } = body || {};

  if (!quizId || questionId === undefined || selectedAnswer === undefined || selectedAnswer === null) {
    return NextResponse.json(
      { error: "quizId, questionId, and selectedAnswer are required." },
      { status: 400 },
    );
  }

  // 1. Fetch quiz
  const { data: quiz, error: quizError } = await auth.supabaseAdmin
    .schema("phase2")
    .from("quizzes")
    .select("id, course_id, questions, status")
    .eq("id", quizId)
    .eq("status", "Active")
    .maybeSingle();

  if (quizError || !quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  // 2. Validate course access
  const { data: profile } = await auth.supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", auth.userId)
    .maybeSingle();

  const role = profile?.role?.toLowerCase() || "";
  const isAdmin = role === "admin" || role === "instructor";

  if (!isAdmin) {
    const { data: enrollment } = await auth.supabaseAdmin
      .schema("phase2")
      .from("enrollments")
      .select("id, users!inner(auth_user_id)")
      .eq("course_id", quiz.course_id)
      .eq("status", "active")
      .eq("users.auth_user_id", auth.userId)
      .maybeSingle();

    let hasAccess = Boolean(enrollment);

    if (!hasAccess && auth.userEmail) {
      const { data: member } = await auth.supabaseAdmin
        .from("course_members")
        .select("id")
        .eq("maincourse_id", quiz.course_id)
        .eq("email", auth.userEmail)
        .eq("status", "active")
        .maybeSingle();

      hasAccess = Boolean(member);
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You are not enrolled in this course." },
        { status: 403 },
      );
    }
  }

  // 3. Find question and verify answer securely
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const question = questions.find((q: any, idx: number) => 
    String(q.id) === String(questionId) || String(idx) === String(questionId)
  );

  if (!question) {
    return NextResponse.json({ error: "Question not found in this quiz." }, { status: 404 });
  }

  const targetAnswer = question.correctAnswer;
  let isCorrect = false;

  if (typeof targetAnswer === "number") {
    isCorrect = Number(selectedAnswer) === targetAnswer;
  } else if (typeof targetAnswer === "string") {
    isCorrect = String(selectedAnswer).trim().toLowerCase() === targetAnswer.trim().toLowerCase();
  } else {
    isCorrect = selectedAnswer === targetAnswer;
  }

  return NextResponse.json({
    isCorrect,
    correctAnswer: targetAnswer,
  });
}
