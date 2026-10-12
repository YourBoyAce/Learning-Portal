import { supabase } from "@/app/lib/supabase";

type QuizQuestionReference = { id: string };
export type LearnerQuizDefinition = {
  id: string;
  course_id: string;
  title: string;
  questions: QuizQuestionReference[];
  passing_score: number;
  status: "Active" | "Inactive";
};

export async function fetchLearnerQuizzes(courseId?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please log in again to load quizzes.");

  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : "";
  const response = await fetch(`/api/quizzes${query}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "Unable to load quizzes.");
  return (result?.quizzes || []) as LearnerQuizDefinition[];
}

export async function recordQuizCompletion(
  quizId: string,
  questions: QuizQuestionReference[],
  answersByIndex: Record<number, number | string>,
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please log in again to record quiz completion.");

  const answers = Object.fromEntries(
    questions.map((question, index) => [question.id, answersByIndex[index]]),
  );
  const response = await fetch("/api/quizzes/complete", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ quizId, answers }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "Unable to record quiz completion.");
  return result as { success: true; awarded: boolean; score: number };
}

export async function verifyLearnerAnswer(
  quizId: string,
  questionId: string,
  selectedAnswer: number | string,
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please log in again to verify answers.");

  const response = await fetch("/api/quizzes/verify-answer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ quizId, questionId, selectedAnswer }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "Unable to verify answer.");
  return result as { isCorrect: boolean; correctAnswer: number | string };
}
