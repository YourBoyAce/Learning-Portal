"use client";

import { useEffect, useState, useMemo } from "react";
import { useLoading } from "@/app/context/LoadingContext";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase, resolveUserName } from "@/app/lib/supabase";
import { fetchLearnerQuizzes, recordQuizCompletion, verifyLearnerAnswer } from "@/app/lib/quiz-completion";
import { upsertUserProgress } from "@/app/actions/user-progress";
import Certificate from "@/app/components/certificate/Certificate";
import CertificateDownload from "@/app/components/certificate/CertificateDownload";
import Image from "next/image";
import {
  PlayCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  BookOpen,
  Loader2,
  AlertCircle,
  HelpCircle,
  Award,
  Check,
  RefreshCw,
  X as XIcon,
  Star,
  FileText,
  FileArchive,
  FileCode,
  Layers,
  DownloadCloud,
  MoreVertical,
  Trash2,
  MessageSquare,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import ReviewForm from "@/components/ui/review-form";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";

// IMPORT OUR NEW VIDEO PLAYER
import CourseVideoPlayer from "./components/CourseVideoPlayer";
import { ICONS } from "@/app/styles/icons";
import { useCoursePermissions } from "@/app/hooks/useSecurityGatedData";
import { UpgradeRequired } from "@/app/components/UpgradeRequired";


interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail_url: string;
}

interface Module {
  id: string;
  title: string;
  description: string;
  video_cf_id: string;
  thumbnail_url?: string | null;
  created_at?: string | null;
  duration: string;
  order_index: number;
  module_type?: "video" | "quiz" | "artifact";
  questions?: any;
  section_id?: string | number | null;
}

interface CourseSection {
  id: string | number;
  title: string;
  description?: string;
  order_index?: number;
}


const ARTIFACT_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_ARTIFACTS_BUCKET || "course-artifacts";
const ARTIFACT_BUCKET_FALLBACKS = ["course-artifacts", "course_artifacts"];

const normalizeModuleLookupId = (value: unknown) =>
  String(value ?? "").trim().replaceAll("-", "").toLowerCase();

const getModuleKey = (module: Pick<Module, "id">) => String(module.id);

const findModuleByLookupId = (moduleList: Module[], value: unknown) => {
  const normalizedValue = normalizeModuleLookupId(value);
  if (!normalizedValue) return null;

  return (
    moduleList.find((module) => {
      return (
        normalizeModuleLookupId(module.id) === normalizedValue ||
        normalizeModuleLookupId(module.video_cf_id) === normalizedValue
      );
    }) ?? null
  );
};

const getModuleProgressIds = (module?: Module | null) =>
  Array.from(
    new Set(
      [module?.id, module?.video_cf_id]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );

export default function CoursePlayerPage() {
  const { id } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setLoading: setGlobalLoading } = useLoading();
  const isAdminCoursePage = pathname.startsWith("/admin/courses");
  const courseListPath = pathname.startsWith("/admin/courses")
    ? "/admin/courses"
    : "/courses";

  // Helper functions for artifact downloading (from practice page)
  const getArtifactBucketCandidates = (art: any) => {
    const fromUrl = typeof art?.fileUrl === "string"
      ? (art.fileUrl.match(/\/object\/public\/([^/]+)\//)?.[1] || "")
      : "";

    return Array.from(
      new Set([ARTIFACT_STORAGE_BUCKET, ...ARTIFACT_BUCKET_FALLBACKS, fromUrl].filter(Boolean))
    );
  };

  const normalizeArtifactFilePath = (rawPath: string, buckets: string[]) => {
    let normalized = (rawPath || "").trim();
    if (!normalized) return "";

    // Remove any full storage URL prefix if accidentally persisted.
    normalized = normalized.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/[^/]+\//, "");

    // Remove accidental leading "<bucket>/" if included in DB file_path.
    for (const bucket of buckets) {
      if (normalized.startsWith(`${bucket}/`)) {
        normalized = normalized.slice(bucket.length + 1);
        break;
      }
    }

    // Remove a leading slash if present.
    normalized = normalized.replace(/^\/+/, "");
    return normalized;
  };

  const getArtifactFilePath = (art: any) => {
    const buckets = getArtifactBucketCandidates(art);
    if (art?.filePath) {
      return normalizeArtifactFilePath(art.filePath, buckets);
    }

    if (typeof art?.fileUrl !== "string") {
      return "";
    }

    const match = art.fileUrl.match(/\/object\/public\/[^/]+\/(.+)$/);
    return match?.[1]
      ? normalizeArtifactFilePath(decodeURIComponent(match[1]), buckets)
      : "";
  };

  // Added userId to state so we can pass it down to the video player
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const { isLoading: isTierLoading, tier, canAccess } = useCoursePermissions(course?.id || String(id));
  const isCurrentlyLoading = loading || isTierLoading;

  useEffect(() => {
    setGlobalLoading(isCurrentlyLoading);
    return () => setGlobalLoading(false);
  }, [isCurrentlyLoading, setGlobalLoading]);
  const [modules, setModules] = useState<Module[]>([]);
  const [userProgress, setUserProgress] = useState<Record<string, boolean>>({});
  const [moduleCompletedAt, setModuleCompletedAt] = useState<Record<string, string>>({});
  const [playbackPositions, setPlaybackPositions] = useState<Record<string, number>>({});
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [modulePlaybackFinished, setModulePlaybackFinished] = useState<
    Record<string, boolean>
  >({});
  const [completionAcknowledged, setCompletionAcknowledged] = useState<
    Record<string, boolean>
  >({});
  const [isMarkingCompleted, setIsMarkingCompleted] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const [hasCertificate, setHasCertificate] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showCourseFinishedPopup, setShowCourseFinishedPopup] = useState(false);
  const [studentName, setStudentName] = useState("Learner");
  const [isGeneratingCertificate, setIsGeneratingCertificate] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState<Module | null>(null);
  const [autoPlayModuleId, setAutoPlayModuleId] = useState<string | null>(null);

  // Section state for accordion grouping
  const [courseSections, setCourseSections] = useState<CourseSection[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // --- QUIZZES, ARTIFACTS & COMMUNITY INTEGRATION STATE ---
  const [activeTab, setActiveTab] = useState<
    "overview" | "modules" | "quizzes" | "artifacts" | "community"
  >("modules");

  // Persist tab state across reloads
  useEffect(() => {
    if (id && typeof window !== "undefined") {
      const saved = sessionStorage.getItem(`activeTab_${id}`);
      if (saved && ["overview", "modules", "quizzes", "artifacts", "community"].includes(saved)) {
        setActiveTab(saved as any);
      }
    }
  }, [id]);

  const handleTabChange = (tab: "overview" | "modules" | "quizzes" | "artifacts" | "community") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`activeTab_${id}`, tab);
    }
  };

  const [courseQuizzes, setCourseQuizzes] = useState<any[]>([]);
  const [courseArtifacts, setCourseArtifacts] = useState<any[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [openModuleMenuId, setOpenModuleMenuId] = useState<string | null>(null);
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);
  const [moduleDeleteError, setModuleDeleteError] = useState("");

  // Interactive Quiz Player State
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizStep, setQuizStep] = useState<"intro" | "questions" | "results">(
    "intro",
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, number | string>>({});
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, any>>({});
  const [isVerifyingQuiz, setIsVerifyingQuiz] = useState(false);

  // In-Module Quiz Player state
  const [modQuizQIdx, setModQuizQIdx] = useState(0);
  const [modQuizSelectedAnswer, setModQuizSelectedAnswer] = useState<number | string | null>(null);
  const [modQuizIsSubmitted, setModQuizIsSubmitted] = useState(false);
  const [modQuizScore, setModQuizScore] = useState(0);
  const [modQuizFinished, setModQuizFinished] = useState(false);

  useEffect(() => {
    setModQuizQIdx(0);
    setModQuizSelectedAnswer(null);
    setModQuizIsSubmitted(false);
    setModQuizScore(0);
    setModQuizFinished(false);
  }, [activeModuleId]);
  const getProgressStorageKey = (uid: string, courseId: string) =>
    `course_progress_${uid}_${courseId}`;

  const getPlaybackPositionStorageKey = (uid: string, courseId: string) =>
    `course_playback_positions_${uid}_${courseId}`;

  useEffect(() => {
    if (id) {
      loadCourseData();
    }
  }, [id, searchParams]);

  useEffect(() => {
    if (course) {
      // The authenticated server route verifies the learner's current
      // course-specific Pro/Premium enrollment before returning definitions.
      const fetchQuizzes = async () => {
        try {
          let data = await fetchLearnerQuizzes(String(course.id));
          if ((!data || data.length === 0) && id && String(id) !== String(course.id)) {
            try {
              data = await fetchLearnerQuizzes(String(id));
            } catch {}
          }
          setCourseQuizzes((data || []).map((quiz) => ({
            id: String(quiz.id),
            courseId: quiz.course_id,
            courseName: course.title,
            title: quiz.title,
            questions: Array.isArray(quiz.questions) ? quiz.questions : [],
            questionsCount: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
            passingScore: Number(quiz.passing_score || 80),
            status: quiz.status,
          })));
        } catch (error) {
          console.error("Failed to fetch quizzes:", error);
          setCourseQuizzes([]);
        }
      };
      void fetchQuizzes();

      // 3. Fetch artifacts directly from Supabase (admin panel saves to DB, not localStorage)
      const fetchArtifacts = async () => {
        try {
          const courseFilter = id && String(id) !== String(course.id)
            ? `course_id.eq.${course.id},course_id.eq.${id}`
            : `course_id.eq.${course.id}`;

          const { data: dbArtifacts, error } = await supabase
            .from("course_artifacts")
            .select(`*, maincourses(title)`)
            .eq("status", "Published")
            .or(courseFilter);

          if (!error && dbArtifacts && dbArtifacts.length > 0) {
            const batchFiltered = dbArtifacts.filter((it: any) => {
              return true;
            });
            setCourseArtifacts(
              batchFiltered.map((it: any) => ({
                id: it.id,
                name: it.name,
                type: it.type,
                courseName: it.maincourses?.title || "",
                courseId: it.course_id,
                size: it.size,
                description: it.description || "",
                downloadsCount: it.downloads_count || 0,
                status: it.status,
                fileUrl: it.file_url,
                filePath: it.file_path,
              }))
            );
          } else {
            setCourseArtifacts([]);
          }
        } catch (dbErr) {
          console.error("Failed to fetch artifacts from DB:", dbErr);
          setCourseArtifacts([]);
        }
      };

      // invoke
      fetchArtifacts();

      // 5. Load best attempts from localStorage
      const savedScores = localStorage.getItem(`best_scores_${course.id}`);
      if (savedScores) {
        try {
          setBestScores(JSON.parse(savedScores));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [course, id]);

  const handleDownloadArtifact = async (art: any) => {
    try {
      const filePath = getArtifactFilePath(art);
      if (!filePath && !art?.fileUrl) {
        console.error("Artifact has no file path/url:", art);
        return;
      }

      let downloadedBlob: Blob | null = null;
      if (filePath) {
        const bucketCandidates = getArtifactBucketCandidates(art);
        for (const bucket of bucketCandidates) {
          const { data, error } = await supabase.storage.from(bucket).download(filePath);
          if (!error && data) {
            downloadedBlob = data;
            break;
          }
        }
      }

      if (downloadedBlob) {
        const objectUrl = URL.createObjectURL(downloadedBlob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = art?.name || "artifact";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      } else if (art.fileUrl) {
        // Final fallback for legacy rows where only file_url is usable.
        window.open(art.fileUrl, "_blank");
      } else {
        console.error("Unable to resolve a valid downloadable artifact:", art);
        return;
      }

      // Update download count
      const currentCount = art.downloadsCount || 0;
      await supabase
        .from("course_artifacts")
        .update({
          downloads_count: currentCount + 1,
        })
        .eq("id", art.id);

      // Update UI instantly
      setCourseArtifacts((prev) =>
        prev.map((a) =>
          a.id === art.id
            ? {
              ...a,
              downloadsCount: currentCount + 1,
            }
            : a,
        ),
      );
    } catch (error) {
      console.error("Error downloading artifact:", error);
    }
  };

  const [downloadingArtifactId, setDownloadingArtifactId] = useState<string | null>(null);

  const downloadArtifactFile = async (
    fileUrl: string,
    fileName: string,
    filePath?: string,
    artifactId?: string,
  ) => {
    try {
      if (artifactId) setDownloadingArtifactId(artifactId);

      // 1. Try direct fetch for blob download with proper filename
      if (fileUrl) {
        try {
          const res = await fetch(fileUrl);
          if (res.ok) {
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = fileName || "artifact.pdf";
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            return;
          }
        } catch (fetchErr) {
          console.warn("Direct fetch failed, trying storage fallback:", fetchErr);
        }
      }

      // 2. Try supabase storage download
      if (filePath) {
        const cleanPath = filePath.replace(/^artifacts\//, "");
        const candidates = [filePath, cleanPath, `artifacts/${cleanPath}`];
        for (const p of candidates) {
          const { data, error } = await supabase.storage
            .from(ARTIFACT_STORAGE_BUCKET)
            .download(p);
          if (!error && data) {
            const blobUrl = URL.createObjectURL(data);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = fileName || "artifact.pdf";
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            return;
          }
        }
      }

      // 3. Fallback: window.open
      if (fileUrl) {
        window.open(fileUrl, "_blank");
      }
    } catch (error) {
      console.error("Failed to download artifact:", error);
      if (fileUrl) {
        window.open(fileUrl, "_blank");
      }
    } finally {
      if (artifactId) setDownloadingArtifactId(null);
    }
  };

  const handleStartQuiz = (quiz: any) => {
    setActiveQuiz(quiz);
    setQuizStep("intro");
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setIsAnswerSubmitted(false);
    setUserAnswers({});
    setRevealedAnswers({});
    setIsVerifyingQuiz(false);
    setShowQuizModal(true);
  };

  const handleAnswerSelect = (optionIndex: number) => {
    if (!isAnswerSubmitted && !isVerifyingQuiz) {
      setSelectedAnswer(optionIndex);
    }
  };

  const handleVerifyAnswer = async () => {
    if (selectedAnswer === null || selectedAnswer === "" || isAnswerSubmitted || isVerifyingQuiz || !activeQuiz) return;
    setIsVerifyingQuiz(true);
    try {
      const currentQuestion = activeQuiz.questions[currentQuestionIndex];
      const result = await verifyLearnerAnswer(
        activeQuiz.id,
        currentQuestion.id || String(currentQuestionIndex),
        selectedAnswer,
      );

      if (result.isCorrect) {
        setQuizScore((prev) => prev + 1);
      }

      setRevealedAnswers((prev) => ({
        ...prev,
        [currentQuestionIndex]: result.correctAnswer,
      }));

      setUserAnswers((prev) => ({
        ...prev,
        [currentQuestionIndex]: selectedAnswer,
      }));

      setIsAnswerSubmitted(true);
    } catch (err) {
      console.error("Unable to verify quiz answer:", err);
    } finally {
      setIsVerifyingQuiz(false);
    }
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setCurrentQuestionIndex((prev) => prev + 1);
  };

  const handleViewResults = async () => {
    if (!activeQuiz) return;
    const totalQuestions = activeQuiz.questions.length;
    const scorePercentage = Math.round((quizScore / totalQuestions) * 100);

    const currentBest = bestScores[activeQuiz.id] || 0;
    if (scorePercentage > currentBest) {
      const updatedBest = {
        ...bestScores,
        [activeQuiz.id]: scorePercentage,
      };
      setBestScores(updatedBest);
      if (course) {
        localStorage.setItem(
          `best_scores_${course.id}`,
          JSON.stringify(updatedBest),
        );
      }
    }

    setQuizStep("results");
    try {
      await recordQuizCompletion(activeQuiz.id, activeQuiz.questions, userAnswers);
    } catch (error) {
      console.error("Unable to record quiz completion:", error);
    }
  };

  const handleRestartQuiz = () => {
    setQuizStep("questions");
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setIsAnswerSubmitted(false);
    setUserAnswers({});
    setRevealedAnswers({});
    setIsVerifyingQuiz(false);
  };

  const loadCourseData = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Store user ID for the video player component
      setUserId(user.id);

      const userEmail = user.email?.trim().toLowerCase() || "";
      if (userEmail) {
        // Check if user is a member of this specific course via course_members
        const { data: memberRows } = await supabase
          .from("course_members")
          .select("maincourse_id")
          .eq("email", userEmail)
          .eq("maincourse_id", String(id));
        // Populate a compatibility array (used downstream for module filtering)
      }

      let { data: courseData, error: courseError } = await supabase
        .from("maincourses")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!courseData) {
        // Fallback: try looking up by product_id if id is a product UUID
        const { data: fallbackCourse, error: fallbackError } = await supabase
          .from("maincourses")
          .select("*")
          .eq("product_id", id)
          .maybeSingle();

        if (fallbackCourse) {
          courseData = fallbackCourse;
          courseError = null;
        } else if (fallbackError) {
          courseError = fallbackError;
        }
      }

      if (courseError || !courseData)
        throw courseError || new Error("Course not found");
      setCourse(courseData);

      // Fetch modules purely based on the course
      const { data: courseModules, error: modulesError } = await supabase
        .from("coursemodules")
        .select("*, section_id")
        .eq("maincourse_id", courseData.id)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      if (modulesError) throw modulesError;
      
      // Fetch sections for this course
      let sectionRows: any[] = [];
      try {
        const { data: sectionData } = await supabase
          .from("course_sections")
          .select("id, title, description, order_index")
          .eq("maincourse_id", courseData.id)
          .order("order_index", { ascending: true })
          .order("created_at", { ascending: true });

        if (sectionData && sectionData.length > 0) {
          sectionRows = sectionData;
          setCourseSections(sectionData);
        }
      } catch {
        // Sections are optional, continue without them
      }

      // order_index restarts within each section, so order modules by
      // section position first, then by their position inside the section.
      const rawModules = courseModules ?? [];
      const sectionPosition = new Map<string, number>(
        sectionRows.map((s: any, i: number) => [String(s.id), i]),
      );
      const orderedModules =
        sectionRows.length > 0
          ? rawModules
              .map((m: any, i: number) => ({ m, i }))
              .sort((a, b) => {
                const sa = a.m.section_id != null ? sectionPosition.get(String(a.m.section_id)) : undefined;
                const sb = b.m.section_id != null ? sectionPosition.get(String(b.m.section_id)) : undefined;
                const pa = sa ?? Number.MAX_SAFE_INTEGER;
                const pb = sb ?? Number.MAX_SAFE_INTEGER;
                if (pa !== pb) return pa - pb;
                return a.i - b.i; // keep query order (order_index, created_at, id)
              })
              .map(({ m }) => m)
          : rawModules;
      setModules(orderedModules);

      let { data: progressData, error: progressError }: {
        data: any[] | null;
        error: any;
      } = await supabase
        .from("user_video_progress")
        .select("video_id, completed, completed_at, updated_at, last_position_seconds")
        .eq("user_id", user.id)
        .or(`course_id.eq.${courseData.id},course_id.eq.${id}`);

      if (
        progressError &&
        String(progressError.message || "")
          .toLowerCase()
          .includes("last_position_seconds")
      ) {
        const fallbackResult = await supabase
          .from("user_video_progress")
          .select("video_id, completed, completed_at, updated_at")
          .eq("user_id", user.id)
          .or(`course_id.eq.${courseData.id},course_id.eq.${id}`);
        progressData = fallbackResult.data;
        progressError = fallbackResult.error;
      }

      if (progressError) throw progressError;

      const progressMap: Record<string, boolean> = {};
      const completedAtMap: Record<string, string> = {};
      const positionMap: Record<string, number> = {};
      const progressUpdatedAt: Record<string, string> = {};
      progressData?.forEach((p: any) => {
        const matchedModule = findModuleByLookupId(orderedModules, p.video_id);
        if (!matchedModule) return;

        const moduleKey = getModuleKey(matchedModule);
        const updatedAt = String(p.updated_at || "");
        if (
          !progressUpdatedAt[moduleKey] ||
          updatedAt >= progressUpdatedAt[moduleKey]
        ) {
          progressMap[moduleKey] = Boolean(p.completed);
          if (p.completed) {
            completedAtMap[moduleKey] = String(p.completed_at || p.updated_at || "");
          } else {
            delete completedAtMap[moduleKey];
          }
          positionMap[moduleKey] = p.completed
            ? 0
            : Math.max(0, Number(p.last_position_seconds || 0));
          progressUpdatedAt[moduleKey] = updatedAt;
        }
      });

      // Merge locally persisted progress as a fallback when DB writes fail.
      try {
        const localProgressRaw = localStorage.getItem(
          getProgressStorageKey(user.id, String(id)),
        );
        if (localProgressRaw) {
          const localProgress = JSON.parse(localProgressRaw) as Record<
            string,
            boolean
          >;
          Object.entries(localProgress).forEach(([videoId, completed]) => {
            if (completed) progressMap[String(videoId)] = true;
          });
        }
      } catch (localProgressError) {
        console.warn(
          "Failed to read local progress fallback:",
          localProgressError,
        );
      }

      try {
        const localPositionsRaw = localStorage.getItem(
          getPlaybackPositionStorageKey(user.id, String(id)),
        );
        if (localPositionsRaw) {
          const localPositions = JSON.parse(localPositionsRaw) as Record<
            string,
            number
          >;
          Object.entries(localPositions).forEach(([moduleId, position]) => {
            const module = findModuleByLookupId(orderedModules, moduleId);
            if (!module) return;
            const moduleKey = getModuleKey(module);
            if (!progressMap[moduleKey] && Number(position) > 0) {
              positionMap[moduleKey] = Math.max(0, Number(position));
            }
          });
        }
      } catch (localPositionError) {
        console.warn(
          "Failed to read local playback position fallback:",
          localPositionError,
        );
      }

      setUserProgress(progressMap);
      setModuleCompletedAt(completedAtMap);
      setPlaybackPositions(positionMap);

      // Select the best module to play
      const playableModules = orderedModules.filter((m) => m.module_type !== "quiz");
      const modulesForPlayback = playableModules.length > 0 ? playableModules : orderedModules;

      if (modulesForPlayback.length > 0) {
        const requestedModuleId = searchParams.get("module");
        const requestedModule = findModuleByLookupId(
          orderedModules,
          requestedModuleId
        );

        let targetModule = requestedModule;

        if (!targetModule) {
          // First priority: unfinished module that already has watch progress
          targetModule = modulesForPlayback.find((module) => {
            const moduleKey = getModuleKey(module);
            return (
              !progressMap[moduleKey] &&
              (positionMap[moduleKey] ?? 0) > 0
            );
          });

          // Second priority: first unfinished module
          if (!targetModule) {
            targetModule = modulesForPlayback.find((module) => {
              const moduleKey = getModuleKey(module);
              return !progressMap[moduleKey];
            });
          }

          // Third priority: course fully completed, show last module
          if (!targetModule) {
            targetModule = modulesForPlayback[modulesForPlayback.length - 1];
          }
        }

        if (targetModule) {
          setActiveModuleId(getModuleKey(targetModule));
        }
      }

      const studentNameResolved = await resolveUserName(supabase, user.id, user.email);
      setStudentName(studentNameResolved);

      const { data: certData } = await supabase
        .from("certificates")
        .select("id")
        .eq("user_id", user.id)
        .or(`course_id.eq.${courseData.id},course_id.eq.${id}`)
        .maybeSingle();

      setHasCertificate(!!certData);

      const { data: reviewData, error: reviewDataError } = await supabase
        .from("course_ratings")
        .select("rating, review")
        .eq("user_id", user.id)
        .or(`course_id.eq.${courseData.id},course_id.eq.${id}`)
        .maybeSingle();

      if (!reviewDataError && reviewData) {
        setReviewSaved(true);
        setReviewRating(Number(reviewData.rating) || 0);
        setReviewText(String(reviewData.review || ""));
      }
    } catch (error) {
      console.error("Error loading course:", error);
    } finally {
      setLoading(false);
    }
  };

  const activeModule = useMemo(
    () => findModuleByLookupId(modules, activeModuleId),
    [modules, activeModuleId],
  );

  const videoEmbedUrl = useMemo(() => {
    if (!activeModule?.video_cf_id) return null;
    const rawId = activeModule.video_cf_id.trim();
    if (!rawId) return null;

    if (rawId.startsWith("https://iframe.videodelivery.net/")) {
      return rawId;
    }

    const cleanId = rawId.split("?")[0].split("/").pop() || "";
    return `https://iframe.videodelivery.net/${cleanId}`;
  }, [activeModule]);

  const playerThumbnailUrl = useMemo(() => {
    const explicitThumbnail = String(activeModule?.thumbnail_url || "").trim();
    if (explicitThumbnail) return explicitThumbnail;

    const rawId = String(activeModule?.video_cf_id || "").trim();
    if (!rawId) return null;
    const cleanId = rawId.split("?")[0].split("/").pop() || "";
    if (!cleanId) return null;
    return `https://videodelivery.net/${cleanId}/thumbnails/thumbnail.jpg?time=1s`;
  }, [activeModule]);

  // Updated to pass the required "100" progress percentage variable
  const handleMarkAsCompleted = async (moduleId: string) => {
    if (!userId || !id) return;

    const moduleKey = String(moduleId);
    const nextCompletedState = !Boolean(userProgress[moduleKey]);
    const module = findModuleByLookupId(modules, moduleKey);
    const persistenceIds = getModuleProgressIds(module);
    const persistenceVideoId = persistenceIds[0] || moduleKey;
    try {
      setIsMarkingCompleted(true);
      setCompletionError("");
      // Optimistic UI update so progress bar reflects completion immediately.
      setUserProgress((prev) => ({ ...prev, [moduleKey]: nextCompletedState }));
      setModuleCompletedAt((prev) => {
        const next = { ...prev };
        if (nextCompletedState) {
          next[moduleKey] = new Date().toISOString();
        } else {
          delete next[moduleKey];
        }
        return next;
      });
      setModulePlaybackFinished((prev) => ({
        ...prev,
        [moduleKey]: nextCompletedState,
      }));
      setCompletionAcknowledged((prev) => ({
        ...prev,
        [moduleKey]: nextCompletedState,
      }));

      // Persist local fallback so refresh still reflects completion.
      try {
        const key = getProgressStorageKey(userId, String(id));
        const existing = localStorage.getItem(key);
        const parsed = existing
          ? (JSON.parse(existing) as Record<string, boolean>)
          : {};
        parsed[moduleKey] = nextCompletedState;
        persistenceIds.forEach((progressId) => {
          parsed[progressId] = nextCompletedState;
        });
        localStorage.setItem(key, JSON.stringify(parsed));

        if (nextCompletedState) {
          const positionKey = getPlaybackPositionStorageKey(userId, String(id));
          const existingPositions = localStorage.getItem(positionKey);
          const parsedPositions = existingPositions
            ? (JSON.parse(existingPositions) as Record<string, number>)
            : {};
          parsedPositions[moduleKey] = 0;
          persistenceIds.forEach((progressId) => {
            parsedPositions[progressId] = 0;
          });
          localStorage.setItem(positionKey, JSON.stringify(parsedPositions));
          setPlaybackPositions((prev) => ({ ...prev, [moduleKey]: 0 }));
        }
      } catch (localProgressError) {
        console.warn(
          "Failed to save local progress fallback:",
          localProgressError,
        );
      }

      await upsertUserProgress(
        userId,
        String(id),
        persistenceVideoId,
        nextCompletedState ? 100 : 0,
        nextCompletedState,
        persistenceIds,
      );
    } catch (error) {
      console.error("Failed to mark module as completed:", error);
      const details =
        error instanceof Error && error.message ? ` (${error.message})` : "";
      setCompletionError(
        `Unable to save completion right now. Please try again.${details}`,
      );
    } finally {
      setIsMarkingCompleted(false);
    }
  };

  const applyAutoCompletionState = (moduleId: string) => {
    const moduleKey = String(moduleId);
    setCompletionError("");
    setUserProgress((prev) => ({ ...prev, [moduleKey]: true }));
    setModuleCompletedAt((prev) => ({
      ...prev,
      [moduleKey]: new Date().toISOString(),
    }));
    setModulePlaybackFinished((prev) => ({
      ...prev,
      [moduleKey]: true,
    }));
    setCompletionAcknowledged((prev) => ({
      ...prev,
      [moduleKey]: true,
    }));
    setPlaybackPositions((prev) => ({ ...prev, [moduleKey]: 0 }));
  };

  const markArtifactCompleted = async (moduleId: string) => {
    if (!userId || !id) return;
    const moduleKey = String(moduleId);
    if (userProgress[moduleKey]) return;

    const mod = findModuleByLookupId(modules, moduleKey);
    const persistenceIds = getModuleProgressIds(mod);
    const persistenceVideoId = persistenceIds[0] || moduleKey;

    // Optimistically update UI so progress bar and checkmarks reflect completion immediately
    setUserProgress((prev) => ({ ...prev, [moduleKey]: true }));
    setModuleCompletedAt((prev) => ({
      ...prev,
      [moduleKey]: new Date().toISOString(),
    }));
    setModulePlaybackFinished((prev) => ({
      ...prev,
      [moduleKey]: true,
    }));
    setCompletionAcknowledged((prev) => ({
      ...prev,
      [moduleKey]: true,
    }));

    // Update local storage fallback
    try {
      const key = getProgressStorageKey(userId, String(id));
      const existing = localStorage.getItem(key);
      const parsed = existing
        ? (JSON.parse(existing) as Record<string, boolean>)
        : {};
      parsed[moduleKey] = true;
      persistenceIds.forEach((progressId) => {
        parsed[progressId] = true;
      });
      localStorage.setItem(key, JSON.stringify(parsed));

      const positionKey = getPlaybackPositionStorageKey(userId, String(id));
      const existingPositions = localStorage.getItem(positionKey);
      const parsedPositions = existingPositions
        ? (JSON.parse(existingPositions) as Record<string, number>)
        : {};
      parsedPositions[moduleKey] = 0;
      persistenceIds.forEach((progressId) => {
        parsedPositions[progressId] = 0;
      });
      localStorage.setItem(positionKey, JSON.stringify(parsedPositions));
      setPlaybackPositions((prev) => ({ ...prev, [moduleKey]: 0 }));
    } catch (localErr) {
      console.warn("Failed to save local progress fallback for artifact:", localErr);
    }

    try {
      await upsertUserProgress(
        userId,
        String(id),
        persistenceVideoId,
        100,
        true,
        persistenceIds,
      );
    } catch (err) {
      console.error("Failed to mark artifact module as completed in DB:", err);
    }
  };

  const saveLocalPlaybackPosition = (
    moduleId: string,
    positionSeconds: number,
    updateState = true,
  ) => {
    if (!userId || !id) return;
    const module = findModuleByLookupId(modules, moduleId);
    const moduleKey = getModuleKey(module ?? { id: moduleId });
    const progressIds = getModuleProgressIds(module);
    const safePosition = Math.max(0, Math.floor(positionSeconds));

    if (updateState) {
      setPlaybackPositions((prev) => ({ ...prev, [moduleKey]: safePosition }));
    }

    try {
      const key = getPlaybackPositionStorageKey(userId, String(id));
      const existing = localStorage.getItem(key);
      const parsed = existing
        ? (JSON.parse(existing) as Record<string, number>)
        : {};
      parsed[moduleKey] = safePosition;
      progressIds.forEach((progressId) => {
        parsed[progressId] = safePosition;
      });
      localStorage.setItem(key, JSON.stringify(parsed));
    } catch (localPositionError) {
      console.warn(
        "Failed to save local playback position fallback:",
        localPositionError,
      );
    }
  };

  const isCurrentModuleComplete = activeModuleId
    ? !!userProgress[String(activeModuleId)]
    : false;
  const isCurrentModulePlaybackFinished = activeModuleId
    ? !!modulePlaybackFinished[String(activeModuleId)]
    : false;
  const isCurrentModuleAcknowledged = activeModuleId
    ? !!completionAcknowledged[String(activeModuleId)]
    : false;

  const progressPercentage = useMemo(() => {
    if (modules.length === 0) return 0;
    const completedCount = modules.filter(
      (m) => userProgress[String(m.id)],
    ).length;
    return Math.round((completedCount / modules.length) * 100);
  }, [modules, userProgress]);

  const hasCompletedAllModulesInOrder = useMemo(() => {
    if (modules.length === 0) return false;

    let previousCompletedAt = 0;
    for (const module of modules) {
      const moduleKey = String(module.id);
      if (!userProgress[moduleKey]) return false;

      const completedAt = Date.parse(moduleCompletedAt[moduleKey] || "");
      if (!Number.isFinite(completedAt) || completedAt < previousCompletedAt) {
        return false;
      }

      previousCompletedAt = completedAt;
    }

    return true;
  }, [moduleCompletedAt, modules, userProgress]);

  // Show certificate button when progress reaches 100%
  const canViewCertificate = progressPercentage === 100;

  // Auto-generate certificate in DB when progress reaches 100%.
  useEffect(() => {
    const generateCertificateInDb = async () => {
      if (progressPercentage === 100 && !hasCertificate && !loading && userId && id) {
        try {
          setIsGeneratingCertificate(true);
          const { error } = await supabase
            .from("certificates")
            .insert({
              user_id: userId,
              course_id: id,
              issued_at: new Date().toISOString(),
            });

          if (error && error.code !== "23505") { // Ignore unique constraint violation
            throw error;
          }
          setHasCertificate(true);
          setShowCourseFinishedPopup(true);
        } catch (err) {
          console.error("Error generating certificate in DB:", err);
        } finally {
          setIsGeneratingCertificate(false);
        }
      }
    };
    generateCertificateInDb();
  }, [progressPercentage, hasCertificate, loading, userId, id],);

  // Automatically mark artifact module as completed when opened / active
  useEffect(() => {
    if (!userId || !id || loading) return;
    if (activeModule?.module_type === "artifact" && activeModuleId) {
      const moduleKey = String(activeModuleId);
      if (!userProgress[moduleKey]) {
        markArtifactCompleted(moduleKey);
      }
    }
  }, [activeModule?.module_type, activeModuleId, userProgress, userId, id, loading]);

  const totalDuration = useMemo(() => {
    let totalSeconds = 0;
    modules.forEach((mod) => {
      if (mod.duration) {
        const parts = mod.duration.split(":").map(Number);
        if (parts.length === 3)
          totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) totalSeconds += parts[0] * 60 + parts[1];
      }
    });
    if (totalSeconds === 0) return null;
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m Total`;
    return `${mins}m Total`;
  }, [modules]);

  const handleSubmitReview = async (event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();

    const resolvedCourseId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : null;

    if (reviewRating < 1) {
      setReviewError("Please select a rating from 1 to 5 stars.");
      return;
    }

    if (!reviewText.trim()) {
      setReviewError("Please share a short description of your experience.");
      return;
    }

    if (!userId || !resolvedCourseId) {
      setReviewError("Please sign in again to save your review.");
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewError("");

      const { error } = await supabase
        .from("course_ratings")
        .upsert(
          {
            user_id: userId,
            course_id: resolvedCourseId,
            rating: reviewRating,
            review: reviewText.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,course_id" },
        );

      if (error) throw error;

      setReviewSaved(true);
    } catch (err) {
      console.error("Error saving course review:", err);
      setReviewError("We could not save your review right now. Please try again.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (feedbackRating < 1) {
      setFeedbackError("Please select a rating from 1 to 5 stars.");
      return;
    }

    if (!feedbackText.trim()) {
      setFeedbackError("Please share a short description of your experience.");
      return;
    }

    const resolvedCourseId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : null;

    if (!userId || !resolvedCourseId) {
      setFeedbackError("Please sign in again to send your feedback.");
      return;
    }

    try {
      setFeedbackSubmitting(true);
      setFeedbackError("");

      const { error } = await supabase
        .from("course_ratings")
        .upsert(
          {
            user_id: userId,
            course_id: resolvedCourseId,
            rating: feedbackRating,
            review: feedbackText.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,course_id" },
        );

      if (error) throw error;

      // Keep end-course review state in sync with saved review
      setReviewRating(feedbackRating);
      setReviewText(feedbackText.trim());
      setReviewSaved(true);

      setFeedbackSaved(true);
      setTimeout(() => {
        setFeedbackSaved(false);
      }, 3000);
    } catch (err) {
      console.error("Error submitting course review:", err);
      setFeedbackError("We could not save your review right now. Please try again.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleOpenCertificateModal = () => {
    if (!reviewSaved || !reviewText.trim() || reviewRating < 1) {
      setReviewError("Please complete and save your review before downloading your certificate.");
      setShowCourseFinishedPopup(true);
      setShowCertificateModal(false);
      return;
    }

    setShowCourseFinishedPopup(false);
    setShowCertificateModal(true);
  };

  const renderModuleOverview = () => {
    return (
      <div className="space-y-6 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-brand-heading text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                Module {modules.findIndex((m) => getModuleKey(m) === activeModuleId) + 1}
              </span>
              {userProgress[String(activeModuleId || "")] && (
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider border border-emerald-100 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Completed
                </span>
              )}
            </div>
            <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
              {activeModule?.title || "Module Selection"}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Kept as a fallback / visual acknowledgement badge for non-artifact modules */}
            {activeModuleId && activeModule?.module_type !== "artifact" && (
              <div className="flex flex-col items-end gap-2">
                <Button
                  onClick={() => handleMarkAsCompleted(activeModuleId)}
                  disabled={
                    isMarkingCompleted ||
                    (activeModule?.module_type !== "quiz" && !activeModule?.video_cf_id)
                  }
                  className={`rounded-full px-6 py-5 text-xs font-bold tracking-wide transition ${
                    activeModule?.module_type !== "quiz" && !activeModule?.video_cf_id
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : isCurrentModuleComplete
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                        : !isMarkingCompleted
                          ? "bg-brand-heading hover:bg-brand-heading-hover text-white cursor-pointer"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isMarkingCompleted
                    ? "Saving..."
                    : isCurrentModuleComplete
                      ? "Mark as Incomplete"
                      : "Mark as Complete"}
                </Button>
                {activeModule?.module_type !== "quiz" && !activeModule?.video_cf_id && (
                  <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-1 rounded whitespace-nowrap">
                    No video uploaded
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {completionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {completionError}
          </div>
        )}

        <div className="prose prose-slate max-w-none">
          <p className="text-gray-600 leading-relaxed text-[15px] sm:text-[17px]">
            {activeModule?.description ||
              "In this module, we will explore the foundational principles and practical applications related to this subject matter. Our goal is to achieve a deep understanding through structured media and instructional assets."}
          </p>
        </div>

        <div className="p-5 sm:p-8 bg-gray-50 rounded-xl sm:rounded-[2rem] border border-gray-100 space-y-4">
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={16} className="text-brand-heading" />
            Instructional Context
          </h4>
          <p className="text-sm text-gray-500 leading-relaxed">
            As you progress through this curated video curriculum, ensure you
            take notes on key conceptual shifts. The material presented here is
            part of the core intellectual framework of{" "}
            <span className="font-bold text-brand-heading">{course?.title}</span>.
          </p>
        </div>

        {canViewCertificate && (
          <div className="p-5 sm:p-8 bg-amber-50/50 rounded-xl sm:rounded-[2rem] border border-amber-200/50 space-y-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h4 className={`${TYPOGRAPHY_CLASSES.INNERHEADING} flex items-center gap-2`}>
                <Image src={ICONS.CHAMPION} alt="Download Certificate" width={20} height={20} />
                Course Completed!
              </h4>
              <p className={TYPOGRAPHY_CLASSES.CAPTION}>
                Congratulations on masterfully completing this course! Your official certificate of achievement has been issued.
              </p>
            </div>
            <Button
              onClick={handleOpenCertificateModal}
              className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 self-start sm:self-center shadow-md shadow-amber-600/10 border border-amber-700/10 transition-all cursor-pointer"
            >
              Download Certificate
            </Button>
          </div>
        )}
      </div>
    );
  };

  const selectModule = (moduleKey: string) => {
    setAutoPlayModuleId(null);
    setActiveModuleId(moduleKey);
    setOpenModuleMenuId(null);
    const targetMod = findModuleByLookupId(modules, moduleKey);
    if (targetMod?.module_type === "artifact" && !userProgress[moduleKey]) {
      markArtifactCompleted(moduleKey);
    }
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleDeleteModule = async (mod: Module) => {
    if (!isAdminCoursePage || deletingModuleId) return;

    setModuleToDelete(mod);
    setShowDeleteConfirmModal(true);
    setOpenModuleMenuId(null);
  };

  const confirmDeleteModule = async () => {
    if (!moduleToDelete || !isAdminCoursePage || deletingModuleId) return;

    try {
      setDeletingModuleId(String(moduleToDelete.id));
      setModuleDeleteError("");
      setShowDeleteConfirmModal(false);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      const response = await fetch(
        `/api/admin/coursemodules?moduleId=${encodeURIComponent(
          String(moduleToDelete.id),
        )}&courseId=${encodeURIComponent(String(id))}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        },
      );

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          result?.error || `Request failed (${response.status}).`,
        );
      }

      const deletedKey = getModuleKey(moduleToDelete);
      const nextModules = modules.filter(
        (moduleItem) => getModuleKey(moduleItem) !== deletedKey,
      );
      setModules(nextModules);
      setUserProgress((prev) => {
        const next = { ...prev };
        for (const progressId of getModuleProgressIds(moduleToDelete)) {
          delete next[progressId];
        }
        return next;
      });
      setModuleCompletedAt((prev) => {
        const next = { ...prev };
        for (const progressId of getModuleProgressIds(moduleToDelete)) {
          delete next[progressId];
        }
        return next;
      });
      setPlaybackPositions((prev) => {
        const next = { ...prev };
        for (const progressId of getModuleProgressIds(moduleToDelete)) {
          delete next[progressId];
        }
        return next;
      });

      if (activeModuleId && getModuleProgressIds(moduleToDelete).includes(activeModuleId)) {
        setActiveModuleId(nextModules[0] ? getModuleKey(nextModules[0]) : null);
        setAutoPlayModuleId(null);
      }

      setModuleToDelete(null);
    } catch (error) {
      setModuleDeleteError(
        error instanceof Error
          ? error.message
          : "Failed to delete module. Please try again.",
      );
    } finally {
      setDeletingModuleId(null);
    }
  };

  const renderModulesList = () => {
    const videoModules = modules;
    const totalModuleCount = videoModules.length;

    return (
      <>
        {/* Header */}
        <div className="p-6 border-b border-gray-50 bg-gray-50/10 text-left flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">
              Curriculum Outline
            </h3>
            <div className="flex items-center gap-4 text-xs text-gray-400 font-bold">
              <span className="flex items-center gap-1.5">
                <BookOpen size={14} /> {totalModuleCount} Modules
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} /> {totalDuration || "—"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setFeedbackError("");
              if (feedbackRating === 0 && reviewRating > 0) {
                setFeedbackRating(reviewRating);
                setFeedbackText(reviewText);
              }
              setShowFeedbackModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-xs font-bold flex items-center gap-2 transition-all shadow-sm shrink-0 cursor-pointer hover:shadow-md"
            title="Leave feedback for this course"
          >
            <MessageSquare size={14} className="text-amber-600" />
            <span>Feedback</span>
          </button>
        </div>

        {isAdminCoursePage && moduleDeleteError && (
          <div className="mx-5 mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {moduleDeleteError}
          </div>
        )}

        {/* No content at all */}
        
        {/* Modules List */}
        <div className="flex flex-col gap-3 sm:gap-4 mt-6">
          {videoModules.length === 0 ? (
            <div className="text-center py-10 bg-white border border-gray-100 rounded-3xl">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Image src={ICONS.BOOK} alt="Empty" width={32} height={32} className="opacity-40" />
              </div>
              <h3 className={`${TYPOGRAPHY_CLASSES.SUBHEADING} text-gray-900 mb-2`}>
                No modules available yet
              </h3>
              <p className="text-gray-500 text-sm">Modules will appear here once they are added to the course.</p>
            </div>
          ) : courseSections.length > 0 ? (
            // Section-grouped accordion view
            <>
              {/* Expand/Collapse All */}
              <div className="flex justify-end mb-1">
                <button
                  type="button"
                  onClick={() => {
                    const allCollapsed = courseSections.every(
                      (sec) => collapsedSections[String(sec.id)]
                    );
                    const next: Record<string, boolean> = {};
                    courseSections.forEach((sec) => {
                      next[String(sec.id)] = !allCollapsed;
                    });
                    setCollapsedSections(next);
                  }}
                  className="text-[11px] font-semibold text-brand-primary hover:text-brand-heading transition-colors"
                >
                  {courseSections.every((sec) => collapsedSections[String(sec.id)])
                    ? "Expand All"
                    : "Collapse All"}
                </button>
              </div>

              {courseSections.map((section) => {
                const sectionId = String(section.id);
                const sectionModules = modules.filter(
                  (m) => String(m.section_id) === sectionId
                );
                const completedInSection = sectionModules.filter(
                  (m) => !!userProgress[getModuleKey(m)]
                ).length;
                const isCollapsed = !!collapsedSections[sectionId];

                return (
                  <div key={sectionId} className="rounded-2xl border border-gray-100 bg-white">
                    {/* Section Header */}
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedSections((prev) => ({
                          ...prev,
                          [sectionId]: !prev[sectionId],
                        }))
                      }
                      className={`w-full flex items-center justify-between px-5 py-3.5 bg-gray-50/80 hover:bg-gray-100/80 transition-colors text-left rounded-t-2xl ${
                        isCollapsed ? "rounded-b-2xl" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 bg-brand-primary/10 rounded-full flex items-center justify-center shrink-0">
                          <Layers size={14} className="text-brand-primary" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 truncate">
                            {section.title}
                          </h4>
                          <span className="text-[10px] font-semibold text-gray-400">
                            {completedInSection}/{sectionModules.length} completed
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-gray-400 transition-transform duration-200 shrink-0 ${isCollapsed ? "-rotate-90" : ""}`}
                      />
                    </button>

                    {/* Section Modules */}
                    {!isCollapsed && (
                      <div className="flex flex-col">
                        {sectionModules.length === 0 ? (
                          <p className="px-5 py-4 text-xs text-gray-400 italic">
                            No modules in this section yet.
                          </p>
                        ) : (
                          sectionModules.map((mod, idx) => {
                            const moduleKey = getModuleKey(mod);
                            const isActive = moduleKey === activeModuleId;
                            const isCompleted = !!userProgress[moduleKey];
                            // Calculate global index for numbering
                            const globalIndex = modules.indexOf(mod);
                            const isLastInSection = idx >= sectionModules.length - 1;

                            return (
                              <div
                                key={mod.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => selectModule(moduleKey)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    selectModule(moduleKey);
                                  }
                                }}
                                className={`relative w-full cursor-pointer text-left px-5 py-3 transition-all flex items-start gap-4 group border-b border-gray-50 last:border-b-0 ${
                                  idx === sectionModules.length - 1 ? "rounded-b-2xl" : ""
                                } ${
                                  isActive
                                    ? "bg-blue-50/50"
                                    : "hover:bg-gray-50"
                                }`}
                              >
                                <div
                                  className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                                    isCompleted
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : isActive
                                      ? "bg-brand-heading border-brand-heading text-white"
                                      : mod.module_type === "artifact"
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                      : "bg-white border-gray-200 text-gray-400 group-hover:border-brand-heading group-hover:text-brand-heading"
                                  }`}
                                >
                                  {isCompleted ? <CheckCircle2 size={12} /> : mod.module_type === "artifact" ? <FileText size={12} /> : idx + 1}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                    <h4
                                      className={`text-sm font-bold leading-snug transition-colors ${
                                        isActive
                                          ? "text-brand-heading"
                                          : "text-gray-900 group-hover:text-brand-heading"
                                      }`}
                                    >
                                      {mod.title}
                                    </h4>
                                    {mod.module_type === "artifact" ? (
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                        <FileText size={10} /> Artifact
                                      </span>
                                    ) : mod.module_type === "quiz" ? (
                                      <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                        <HelpCircle size={10} /> Quiz
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                        <PlayCircle size={10} /> Video
                                      </span>
                                    )}
                                  </div>
                                  {mod.description && (
                                    <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2 mb-1">
                                      {mod.description}
                                    </p>
                                  )}
                                </div>

                                {isAdminCoursePage && (
                                  <div className="shrink-0 relative">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenModuleMenuId(
                                          openModuleMenuId === moduleKey ? null : moduleKey
                                        );
                                      }}
                                      className="p-1 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-200"
                                      aria-label="Module options"
                                    >
                                      <MoreVertical size={16} />
                                    </button>

                                    {openModuleMenuId === moduleKey && (
                                      <div
                                        className={`absolute right-0 z-30 w-36 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-xl ${
                                          isLastInSection ? "bottom-full mb-1" : "top-8"
                                        }`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteModule(mod)}
                                          onKeyDown={(e) => e.stopPropagation()}
                                          disabled={deletingModuleId === String(mod.id)}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          <Trash2 size={14} />
                                          {deletingModuleId === String(mod.id)
                                            ? "Deleting..."
                                            : "Delete"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Ungrouped modules (those without a section_id) */}
              {(() => {
                const ungrouped = modules.filter(
                  (m) => (!m.section_id || !courseSections.some((s) => String(s.id) === String(m.section_id)))
                );
                if (ungrouped.length === 0) return null;
                return (
                  <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
                    <div className="px-5 py-3 bg-gray-50/80">
                      <h4 className="text-sm font-bold text-gray-600">General</h4>
                      <span className="text-[10px] font-semibold text-gray-400">
                        {ungrouped.filter((m) => !!userProgress[getModuleKey(m)]).length}/{ungrouped.length} completed
                      </span>
                    </div>
                    <div className="flex flex-col">
                      {ungrouped.map((mod, idx) => {
                        const moduleKey = getModuleKey(mod);
                        const isActive = moduleKey === activeModuleId;
                        const isCompleted = !!userProgress[moduleKey];

                        return (
                          <div
                            key={mod.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => selectModule(moduleKey)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                selectModule(moduleKey);
                              }
                            }}
                            className={`relative w-full cursor-pointer text-left px-5 py-3 transition-all flex items-start gap-4 group border-b border-gray-50 last:border-b-0 ${
                              isActive
                                ? "bg-blue-50/50"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <div
                              className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                                isCompleted
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : isActive
                                  ? "bg-brand-heading border-brand-heading text-white"
                                  : mod.module_type === "artifact"
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                  : "bg-white border-gray-200 text-gray-400"
                              }`}
                            >
                              {isCompleted ? <CheckCircle2 size={12} /> : mod.module_type === "artifact" ? <FileText size={12} /> : idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <h4 className={`text-sm font-bold leading-snug transition-colors ${
                                  isActive ? "text-brand-heading" : "text-gray-900 group-hover:text-brand-heading"
                                }`}>
                                  {mod.title}
                                </h4>
                                {mod.module_type === "artifact" && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                    <FileText size={10} /> Artifact
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            // Flat module list (no sections — legacy view)
            videoModules.map((mod, globalIndex) => {
              const moduleKey = getModuleKey(mod);
              const isActive = moduleKey === activeModuleId;
              const isCompleted = !!userProgress[moduleKey];

              return (
                <div
                  key={mod.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectModule(moduleKey)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectModule(moduleKey);
                    }
                  }}
                  className={`relative w-full cursor-pointer text-left px-5 py-3.5 transition-all flex items-start gap-4 group rounded-xl border border-gray-100 ${
                    isActive
                      ? "bg-blue-50/50 border-brand-heading"
                      : "hover:bg-gray-50 bg-white"
                  }`}
                >
                  <div
                    className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                      isCompleted
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : isActive
                        ? "bg-brand-heading border-brand-heading text-white"
                        : "bg-white border-gray-200 text-gray-400 group-hover:border-brand-heading group-hover:text-brand-heading"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={13} /> : globalIndex + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4
                      className={`text-sm font-bold mb-0.5 leading-snug transition-colors ${
                        isActive
                          ? "text-brand-heading"
                          : "text-gray-900 group-hover:text-brand-heading"
                      }`}
                    >
                      {mod.title}
                    </h4>
                    {mod.description && (
                      <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2 mb-1">
                        {mod.description}
                      </p>
                    )}
                  </div>
                  
                  {isAdminCoursePage && (
                    <div className="shrink-0 relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenModuleMenuId(
                            openModuleMenuId === moduleKey ? null : moduleKey
                          );
                        }}
                        className="p-1 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-200"
                        aria-label="Module options"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {openModuleMenuId === moduleKey && (
                        <div
                          className={`absolute right-0 z-30 w-36 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-xl ${
                            globalIndex >= modules.length - 1 ? "bottom-full mb-1" : "top-8"
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleDeleteModule(mod)}
                            onKeyDown={(e) => e.stopPropagation()}
                            disabled={deletingModuleId === String(mod.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            {deletingModuleId === String(mod.id)
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </>
    );
  };

  const renderQuizzesList = () => {
    if (!isTierLoading && !canAccess("Quizzes")) {
      return (
        <div className="p-6">
          <UpgradeRequired
            title="Quizzes Gated"
            description="Interactive practice quizzes for this course are available to all enrolled learners. Enroll in this course to test your learning and review your scores."
            requiredTier="Starter"
            courseSlug={String(id)}
          />
        </div>
      );
    }

    return (
      <>
        <div className="p-6 border-b border-gray-50 bg-gray-50/10 text-left">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">
            Practice Quizzes
          </h3>
          <p className="text-[11px] text-gray-400">
            Test your mastery of this course with curated interactive tests.
          </p>
        </div>

        {/* Sections for Quizzes */}
        {courseSections.map((section, sIdx) => {
          const sectionQuizzes = modules.filter(
            (m) => String(m.section_id) === String(section.id) && m.module_type === "quiz"
          );
          if (sectionQuizzes.length === 0) return null;

          return (
            <div key={section.id} className="mb-6">
              <div className="px-6 py-3 bg-gray-50/80 border-y border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">
                    Section {sIdx + 1}
                  </span>
                  <h4 className="text-sm font-bold text-gray-600">{section.title}</h4>
                </div>
              </div>
              <div className="flex flex-col">
                {sectionQuizzes.map((mod) => {
                  const moduleKey = getModuleKey(mod);
                  const isCompleted = !!userProgress[moduleKey];
                  const qCount = Array.isArray(mod.questions) ? mod.questions.length : 0;
                  
                  return (
                    <div
                      key={mod.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        selectModule(moduleKey);
                        if (window.innerWidth < 1280) handleTabChange("overview");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="p-5 hover:bg-gray-50/50 transition-all flex flex-col gap-2 border-b border-gray-100 group text-left cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${isCompleted ? "bg-emerald-500 text-white" : "bg-blue-50 text-brand-heading group-hover:bg-brand-heading group-hover:text-white"}`}>
                          {isCompleted ? <CheckCircle2 size={16} /> : <HelpCircle size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 group-hover:text-brand-heading transition-colors leading-snug mb-1">
                            {mod.title}
                          </h4>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            <span>{qCount} Qs</span>
                            <span>•</span>
                            <span>Course Module</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Global/Ungrouped Quizzes Header */}
        {(courseQuizzes.length > 0 || modules.some(m => m.module_type === "quiz" && (!m.section_id || !courseSections.some(s => String(s.id) === String(m.section_id))))) && (
          <div className="px-6 py-3 bg-gray-50/80 border-y border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-600">General Quizzes</h4>
          </div>
        )}

        {/* Ungrouped Module Quizzes */}
        {modules.filter(m => m.module_type === "quiz" && (!m.section_id || !courseSections.some(s => String(s.id) === String(m.section_id)))).map((mod) => {
          const moduleKey = getModuleKey(mod);
          const isCompleted = !!userProgress[moduleKey];
          const qCount = Array.isArray(mod.questions) ? mod.questions.length : 0;
          
          return (
            <div
              key={mod.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                selectModule(moduleKey);
                if (window.innerWidth < 1280) handleTabChange("overview");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="p-5 hover:bg-gray-50/50 transition-all flex flex-col gap-2 border-b border-gray-100 group text-left cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${isCompleted ? "bg-emerald-500 text-white" : "bg-blue-50 text-brand-heading group-hover:bg-brand-heading group-hover:text-white"}`}>
                  {isCompleted ? <CheckCircle2 size={16} /> : <HelpCircle size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-gray-900 group-hover:text-brand-heading transition-colors leading-snug mb-1">
                    {mod.title}
                  </h4>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <span>{qCount} Qs</span>
                    <span>•</span>
                    <span>Course Module</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {courseQuizzes.map((quiz) => {
          const score = bestScores[quiz.id];
          const hasAttempted = score !== undefined;
          const isPassed = hasAttempted && score >= quiz.passingScore;

          return (
            <div
              key={quiz.id}
              className="p-5 hover:bg-gray-50/50 transition-all flex flex-col gap-4 border-b border-gray-100 group text-left"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-blue-50 text-brand-heading group-hover:bg-brand-heading group-hover:text-white transition-all">
                  <HelpCircle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-gray-900 group-hover:text-brand-heading transition-colors leading-snug mb-1">
                    {quiz.title}
                  </h4>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <span>{quiz.questionsCount} Qs</span>
                    <span>•</span>
                    <span>Min {quiz.passingScore}% to pass</span>
                  </div>
                </div>
              </div>

              {hasAttempted && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    Best Score
                  </span>
                  <span
                    className={`text-xs font-bold flex items-center gap-1 ${isPassed ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {isPassed ? <Award size={14} /> : <AlertCircle size={14} />}
                    {score}%
                  </span>
                </div>
              )}

              <Button
                onClick={() => handleStartQuiz(quiz)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold shadow-none transition-all ${hasAttempted
                  ? "bg-white border-2 border-gray-100 text-gray-600 hover:border-brand-heading hover:text-brand-heading"
                  : "bg-brand-heading text-white hover:bg-brand-heading-hover"
                  }`}
              >
                {hasAttempted ? "Retake Quiz" : "Start Quiz"}
              </Button>
            </div>
          );
        })}

        {(courseQuizzes.length === 0 && modules.filter(m => m.module_type === "quiz").length === 0) && (
          <div className="p-10 text-center text-gray-400">
            <FileText size={32} className="mx-auto mb-4 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">
              No Quizzes Available
            </p>
          </div>
        )}
      </>
    );
  };

  const renderArtifactsList = () => {
    return (
      <>
        <div className="p-6 border-b border-gray-50 bg-gray-50/10 text-left">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">
            Learning Artifacts
          </h3>
          <p className="text-[11px] text-gray-400">
            Download supplementary materials, code snippets, and resources.
          </p>
        </div>

        {/* Sections for Artifacts */}
        {courseSections.map((section, sIdx) => {
          const sectionArtifacts = modules.filter(
            (m) => String(m.section_id) === String(section.id) && m.module_type === "artifact"
          );
          if (sectionArtifacts.length === 0) return null;

          return (
            <div key={section.id} className="mb-6">
              <div className="px-6 py-3 bg-gray-50/80 border-y border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">
                    Section {sIdx + 1}
                  </span>
                  <h4 className="text-sm font-bold text-gray-600">{section.title}</h4>
                </div>
              </div>
              <div className="flex flex-col">
                {sectionArtifacts.map((mod) => {
                  const moduleKey = getModuleKey(mod);
                  const isCompleted = !!userProgress[moduleKey];
                  const qArray = Array.isArray(mod.questions) ? mod.questions : [];
                  const fileName = qArray[0]?.options?.[0] || "Artifact File";
                  const fileSize = qArray[0]?.options?.[1] || "";
                  const fileUrl = qArray[0]?.text || "";

                  return (
                    <div
                      key={mod.id}
                      className="p-5 hover:bg-gray-50/50 transition-all flex flex-col gap-4 border-b border-gray-100 group text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${isCompleted ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"}`}>
                          {isCompleted ? <CheckCircle2 size={16} /> : <FileText size={16} />}
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                          selectModule(moduleKey);
                          if (window.innerWidth < 1280) handleTabChange("overview");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}>
                          <h4 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors leading-snug mb-1">
                            {mod.title}
                          </h4>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            <span className="text-emerald-600 truncate max-w-[150px] inline-block align-bottom">{fileName}</span>
                            {fileSize && (
                              <>
                                <span>•</span>
                                <span>{fileSize}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {mod.description && (
                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                          {mod.description}
                        </p>
                      )}

                      {fileUrl && (
                        <Button
                          onClick={async () => {
                            await downloadArtifactFile(fileUrl, fileName, qArray[0]?.correctAnswer, mod.id);
                            if (!userProgress[moduleKey]) {
                              markArtifactCompleted(moduleKey);
                            }
                          }}
                          disabled={downloadingArtifactId === mod.id}
                          className="w-full py-2.5 rounded-xl text-xs font-bold shadow-none bg-white border-2 border-gray-100 text-gray-600 hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {downloadingArtifactId === mod.id ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Downloading...
                            </>
                          ) : (
                            <>
                              <DownloadCloud size={14} /> Download File
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Global/Ungrouped Artifacts Header */}
        {(courseArtifacts.length > 0 || modules.some(m => m.module_type === "artifact" && (!m.section_id || !courseSections.some(s => String(s.id) === String(m.section_id))))) && (
          <div className="px-6 py-3 bg-gray-50/80 border-y border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-600">General Artifacts</h4>
          </div>
        )}

        {/* Ungrouped Module Artifacts */}
        {modules.filter(m => m.module_type === "artifact" && (!m.section_id || !courseSections.some(s => String(s.id) === String(m.section_id)))).map((mod) => {
          const moduleKey = getModuleKey(mod);
          const isCompleted = !!userProgress[moduleKey];
          const qArray = Array.isArray(mod.questions) ? mod.questions : [];
          const fileName = qArray[0]?.options?.[0] || "Artifact File";
          const fileSize = qArray[0]?.options?.[1] || "";
          const fileUrl = qArray[0]?.text || "";

          return (
            <div
              key={mod.id}
              className="p-5 hover:bg-gray-50/50 transition-all flex flex-col gap-4 border-b border-gray-100 group text-left"
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${isCompleted ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"}`}>
                  {isCompleted ? <CheckCircle2 size={16} /> : <FileText size={16} />}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                  selectModule(moduleKey);
                  if (window.innerWidth < 1280) handleTabChange("overview");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}>
                  <h4 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors leading-snug mb-1">
                    {mod.title}
                  </h4>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <span className="text-emerald-600 truncate max-w-[150px] inline-block align-bottom">{fileName}</span>
                    {fileSize && (
                      <>
                        <span>•</span>
                        <span>{fileSize}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {mod.description && (
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                  {mod.description}
                </p>
              )}

              {fileUrl && (
                <Button
                  onClick={async () => {
                    await downloadArtifactFile(fileUrl, fileName, qArray[0]?.correctAnswer, mod.id);
                    if (userId && id) {
                      try {
                        const key = getProgressStorageKey(userId, String(id));
                        const existing = localStorage.getItem(key);
                        const parsed = existing ? (JSON.parse(existing) as Record<string, boolean>) : {};
                        parsed[moduleKey] = true;
                        localStorage.setItem(key, JSON.stringify(parsed));
                        setUserProgress(parsed);
                      } catch(e) {}
                    }
                  }}
                  disabled={downloadingArtifactId === mod.id}
                  className="w-full py-2.5 rounded-xl text-xs font-bold shadow-none bg-white border-2 border-gray-100 text-gray-600 hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {downloadingArtifactId === mod.id ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Downloading...
                    </>
                  ) : (
                    <>
                      <DownloadCloud size={14} /> Download File
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        })}

        {courseArtifacts.map((art) => (
          <div
            key={art.id}
            className="p-5 hover:bg-gray-50/50 transition-all flex flex-col gap-4 border-b border-gray-100 group text-left"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-all">
                {art.type === "Code" || art.type === "Code Snippet" ? (
                  <FileCode size={16} />
                ) : art.type === "Sheet" || art.type === "Presentation" ? (
                  <Layers size={16} />
                ) : art.type === "PDF" ? (
                  <FileText size={16} />
                ) : (
                  <FileArchive size={16} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-gray-900 group-hover:text-amber-700 transition-colors leading-snug mb-1">
                  {art.name}
                </h4>
                <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <span className="text-amber-600">{art.type}</span>
                  <span>•</span>
                  <span>{art.size}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
              {art.description}
            </p>

            <Button
              onClick={() => handleDownloadArtifact(art)}
              className="w-full py-2.5 rounded-xl text-xs font-bold shadow-none bg-white border-2 border-gray-100 text-gray-600 hover:border-amber-500 hover:text-amber-600 transition-all flex items-center justify-center gap-2"
            >
              <DownloadCloud size={14} /> Download File
            </Button>
          </div>
        ))}

        {(courseArtifacts.length === 0 && modules.filter(m => m.module_type === "artifact").length === 0) && (
          <div className="p-10 text-center text-gray-400">
            <Layers size={32} className="mx-auto mb-4 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">
              No Artifacts Available
            </p>
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return null;
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-surface-subtle flex items-center justify-center p-6">
        <div className="text-center bg-white p-10 rounded-3xl shadow-sm border border-gray-100 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className={`${TYPOGRAPHY_CLASSES.SUBHEADING} mb-2`}>
            Course Unavailable
          </h2>
          <p className="text-gray-500 mb-6">
            We couldn't find the course you're looking for. It may have been
            moved or removed.
          </p>
          <Button
            onClick={() => router.push(courseListPath)}
            className="bg-brand-heading hover:bg-brand-heading-hover"
          >
            Return to Curriculum
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-subtle font-sans text-gray-900">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(courseListPath)}
              className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-400 hover:text-brand-heading"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="hidden sm:block">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">
                Currently Studying
              </span>
              <h1 className="text-sm font-bold text-gray-900 truncate max-w-[300px]">
                {course.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-6">

            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Your Progress
              </span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-heading transition-all duration-700 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-brand-heading">
                  {progressPercentage}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto grid grid-cols-1 xl:grid-cols-12 min-h-[calc(100vh-64px)]">
        <div className="xl:col-span-8 p-4 sm:p-6 lg:p-8 xl:border-r border-gray-100 bg-white/30">
          <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
            {/* INTEGRATED VIDEO PLAYER WITH AUTO-COMPLETION */}
            <div className="relative aspect-video bg-black rounded-xl sm:rounded-[2rem] overflow-hidden shadow-2xl group border-4 sm:border-[8px] border-white ring-1 ring-gray-100">
              {!isTierLoading && !canAccess("Videos") ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-gray-900 via-copy-dark to-slate-900">
                  <Lock className="h-10 w-10 text-amber-500 mb-3 animate-pulse" />
                  <h3 className="text-base font-bold text-white mb-1">
                    Course Videos Gated
                  </h3>
                  <p className="text-gray-400 text-xs max-w-xs mb-4">
                    Course modules are exclusively available to active members. Upgrade your plan to unlock video streaming.
                  </p>
                  <Button
                    asChild
                    size="sm"
                    className="bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs"
                  >
                    <a href={`/upgrade?course=${encodeURIComponent(String(id))}&mode=upgrade`}>
                      Upgrade to Unlock
                    </a>
                  </Button>
                </div>
              ) : activeModule && activeModule.module_type === "quiz" ? (
                <div className="w-full h-full min-h-[440px] bg-gradient-to-br from-brand-heading via-[#0F1E3B] to-[#162B50] text-white rounded-2xl sm:rounded-[2rem] p-6 sm:p-10 flex flex-col justify-between relative overflow-hidden shadow-2xl border border-white/10">
                  <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-primary/20 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

                  {(() => {
                    const qList = Array.isArray(activeModule.questions)
                      ? activeModule.questions
                      : typeof activeModule.questions === "string"
                      ? (JSON.parse(activeModule.questions) || [])
                      : [];

                    if (qList.length === 0) {
                      return (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 relative z-10">
                          <div className="w-16 h-16 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md">
                            <HelpCircle size={32} className="text-blue-300" />
                          </div>
                          <h3 className="text-xl font-bold text-white mb-2">{activeModule.title}</h3>
                          <p className="text-blue-200/70 text-sm max-w-md">
                            No questions have been added to this quiz module yet.
                          </p>
                        </div>
                      );
                    }

                    const currentQ = qList[modQuizQIdx] || {};
                    const isTextType = currentQ.questionType === "text" || !currentQ.options || currentQ.options.length === 0;

                    const handleVerifyModAnswer = () => {
                      if (modQuizSelectedAnswer === null || modQuizSelectedAnswer === "" || modQuizIsSubmitted) return;
                      let isCorrect = false;
                      if (isTextType) {
                        const userTyped = String(modQuizSelectedAnswer).trim().toLowerCase();
                        const targetAnswer = String(currentQ.correctAnswer || "").trim().toLowerCase();
                        isCorrect = userTyped === targetAnswer && userTyped.length > 0;
                      } else {
                        isCorrect = modQuizSelectedAnswer === currentQ.correctAnswer;
                      }
                      if (isCorrect) {
                        setModQuizScore((prev) => prev + 1);
                      }
                      setModQuizIsSubmitted(true);
                    };

                    const handleNextModQuestion = () => {
                      if (modQuizQIdx < qList.length - 1) {
                        setModQuizQIdx((prev) => prev + 1);
                        setModQuizSelectedAnswer(null);
                        setModQuizIsSubmitted(false);
                      } else {
                        setModQuizFinished(true);
                        if (activeModuleId) {
                          applyAutoCompletionState(String(activeModuleId));
                        }
                      }
                    };

                    if (modQuizFinished) {
                      const scorePct = Math.round((modQuizScore / qList.length) * 100);
                      return (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 relative z-10 space-y-6">
                          <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Check size={40} className="text-emerald-400" />
                          </div>
                          <div>
                            <span className="text-xs font-bold uppercase tracking-widest text-blue-300 block mb-1">
                              Quiz Complete
                            </span>
                            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                              {activeModule.title}
                            </h3>
                            <p className="text-blue-100/90 text-sm">
                              You scored <strong className="text-emerald-400 font-bold">{modQuizScore}</strong> out of <strong className="text-white font-bold">{qList.length}</strong> ({scorePct}%)
                            </p>
                          </div>
                          <div className="flex items-center gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setModQuizQIdx(0);
                                setModQuizSelectedAnswer(null);
                                setModQuizIsSubmitted(false);
                                setModQuizScore(0);
                                setModQuizFinished(false);
                              }}
                              className="px-5 py-2.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors backdrop-blur-md cursor-pointer"
                            >
                              Retake Quiz
                            </button>
                            {(() => {
                              const currentIndex = modules.findIndex((m) => String(m.id) === String(activeModule.id));
                              const nextMod = currentIndex >= 0 ? modules[currentIndex + 1] : null;
                              if (!nextMod) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveModuleId(String(nextMod.id));
                                    if (typeof window !== "undefined") {
                                      window.scrollTo({ top: 0, behavior: "smooth" });
                                    }
                                  }}
                                  className="px-6 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-brand-primary/30 cursor-pointer"
                                >
                                  Next Module <ChevronRight size={14} />
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="flex-1 flex flex-col justify-between relative z-10 space-y-6">
                        {/* Header Progress */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-blue-300 uppercase tracking-widest flex items-center gap-1.5">
                              <HelpCircle size={15} /> Question {modQuizQIdx + 1} of {qList.length}
                            </span>
                            <span className="text-[11px] font-semibold text-blue-100 bg-white/10 border border-white/15 px-3 py-1 rounded-full backdrop-blur-md">
                              {isTextType ? "Fill in the Blank" : "Multiple Choice"}
                            </span>
                          </div>
                          <div className="w-full bg-black/30 h-2 rounded-full overflow-hidden border border-white/5">
                            <div
                              className="bg-brand-primary h-full transition-all duration-300"
                              style={{ width: `${((modQuizQIdx + 1) / qList.length) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Question Text & Input / Options */}
                        <div className="space-y-6">
                          <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                            {currentQ.text}
                          </h3>

                          {isTextType ? (
                            <div className="space-y-3">
                              <label className="text-xs font-semibold text-blue-200/80 uppercase tracking-wider block">
                                Your Answer
                              </label>
                              <input
                                type="text"
                                placeholder="Type your answer here..."
                                value={String(modQuizSelectedAnswer ?? "")}
                                onChange={(e) => setModQuizSelectedAnswer(e.target.value)}
                                disabled={modQuizIsSubmitted}
                                className={`w-full p-4 sm:p-5 rounded-2xl border-2 text-base font-medium focus:outline-none transition-all ${
                                  modQuizIsSubmitted
                                    ? String(modQuizSelectedAnswer || "").trim().toLowerCase() === String(currentQ.correctAnswer || "").trim().toLowerCase()
                                      ? "border-emerald-500 bg-emerald-950/60 text-emerald-200 font-semibold"
                                      : "border-red-500 bg-red-950/60 text-red-200 font-semibold"
                                    : "border-white/20 bg-white/10 text-white focus:border-brand-primary focus:bg-white/15 placeholder-white/40"
                                }`}
                              />
                              {modQuizIsSubmitted && (
                                <div className="text-xs font-medium pt-1">
                                  {String(modQuizSelectedAnswer || "").trim().toLowerCase() === String(currentQ.correctAnswer || "").trim().toLowerCase() ? (
                                    <span className="text-emerald-400 flex items-center gap-1 font-bold">
                                      <Check size={14} /> Correct answer!
                                    </span>
                                  ) : (
                                    <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200">
                                      <span className="font-bold">Incorrect.</span> Correct answer:{" "}
                                      <strong className="text-white underline font-bold">{String(currentQ.correctAnswer)}</strong>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {(currentQ.options || []).map((opt: string, oIdx: number) => {
                                const isSelected = modQuizSelectedAnswer === oIdx;
                                const isCorrect = currentQ.correctAnswer === oIdx;

                                let optClass = "border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/30 text-white";

                                if (modQuizIsSubmitted) {
                                  if (isCorrect) {
                                    optClass = "border-emerald-500 bg-emerald-950/70 text-emerald-200 font-semibold";
                                  } else if (isSelected && !isCorrect) {
                                    optClass = "border-red-500 bg-red-950/70 text-red-200 font-semibold";
                                  } else {
                                    optClass = "border-white/10 bg-white/5 text-white/40 opacity-40";
                                  }
                                } else if (isSelected) {
                                  optClass = "border-brand-primary bg-brand-primary/20 text-white ring-2 ring-brand-primary font-semibold";
                                }

                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    onClick={() => !modQuizIsSubmitted && setModQuizSelectedAnswer(oIdx)}
                                    disabled={modQuizIsSubmitted}
                                    className={`w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-center gap-3.5 ${optClass}`}
                                  >
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                      modQuizIsSubmitted && isCorrect
                                        ? "bg-emerald-500 border-emerald-500 text-slate-950"
                                        : modQuizIsSubmitted && isSelected && !isCorrect
                                        ? "bg-red-500 border-red-500 text-white"
                                        : isSelected
                                        ? "border-brand-primary bg-brand-primary text-white"
                                        : "border-white/30 bg-white/5"
                                    }`}>
                                      {modQuizIsSubmitted && isCorrect ? (
                                        <Check size={12} strokeWidth={3} />
                                      ) : isSelected ? (
                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                      ) : null}
                                    </div>
                                    <span className="text-sm font-medium flex-1 leading-snug">{opt}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Bottom Right Action Button Bar */}
                        <div className="flex items-center justify-between pt-5 border-t border-white/10">
                          <span className="text-xs text-blue-200/60 font-medium">
                            {modQuizIsSubmitted ? "Answer verified" : "Select or type an answer"}
                          </span>

                          {!modQuizIsSubmitted ? (
                            <button
                              type="button"
                              onClick={handleVerifyModAnswer}
                              disabled={modQuizSelectedAnswer === null || modQuizSelectedAnswer === ""}
                              className="px-7 py-3 rounded-xl bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-40 disabled:hover:bg-brand-primary text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-brand-primary/20 cursor-pointer disabled:cursor-not-allowed"
                            >
                              Submit Answer
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleNextModQuestion}
                              className="px-7 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer"
                            >
                              {modQuizQIdx < qList.length - 1 ? (
                                <>
                                  Next Question <ChevronRight size={15} />
                                </>
                              ) : (
                                <>
                                  Finish Quiz <Check size={15} />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : activeModule && activeModule.module_type === "artifact" ? (
                <div className="w-full h-full min-h-[440px] bg-gradient-to-br from-[#0B1528] via-[#102347] to-[#0A1324] text-white rounded-2xl sm:rounded-[2rem] p-6 sm:p-10 flex flex-col justify-between relative overflow-hidden shadow-2xl border border-white/10">
                  <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                  {(() => {
                    const qArray = Array.isArray(activeModule.questions)
                      ? activeModule.questions
                      : typeof activeModule.questions === "string"
                      ? (JSON.parse(activeModule.questions) || [])
                      : [];
                    const fileName = qArray[0]?.options?.[0] || activeModule.title;
                    const fileSize = qArray[0]?.options?.[1] || "";
                    const fileUrl = qArray[0]?.text || "";
                    const filePath = qArray[0]?.correctAnswer || "";
                    const isDownloaded = Boolean(userProgress[getModuleKey(activeModule)]);

                    return (
                      <div className="flex-1 flex flex-col justify-between relative z-10">
                        {/* Top Badge & Title */}
                        <div>
                          <div className="flex items-center justify-between gap-4 mb-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                              <FileText size={12} />
                              Course Artifact
                            </span>
                            {isDownloaded && (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                                <CheckCircle2 size={14} /> Completed
                              </span>
                            )}
                          </div>
                          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 leading-tight">
                            {activeModule.title}
                          </h2>
                          {activeModule.description ? (
                            <p className="text-sm text-gray-300 max-w-2xl leading-relaxed">
                              {activeModule.description}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 max-w-xl">
                              This module contains a downloadable supplementary learning resource and reference document.
                            </p>
                          )}
                        </div>

                        {/* File Details Card */}
                        <div className="my-6 p-5 sm:p-6 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400">
                                <FileText size={28} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-base font-bold text-white truncate max-w-md sm:max-w-lg mb-1">
                                  {fileName}
                                </h4>
                                <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
                                  {fileSize && <span>{fileSize}</span>}
                                  {fileSize && <span>•</span>}
                                  <span>Downloadable Resource</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                              {fileUrl && (
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-2 justify-center"
                                  title="Preview in new tab"
                                >
                                  View
                                </a>
                              )}
                              <Button
                                onClick={async () => {
                                  await downloadArtifactFile(fileUrl, fileName, filePath, activeModule.id);
                                }}
                                disabled={downloadingArtifactId === activeModule.id}
                                className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
                              >
                                {downloadingArtifactId === activeModule.id ? (
                                  <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Downloading...
                                  </>
                                ) : (
                                  <>
                                    <DownloadCloud size={16} />
                                    Download Artifact
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Bottom hint */}
                        <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-white/10">
                          <span>Click download to save to your local machine and record module progress.</span>
                          <span className="text-emerald-400 font-semibold">Verified Safe Resource</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : activeModule && userId && videoEmbedUrl ? (
                <CourseVideoPlayer
                  key={`${activeModule.id}-${videoEmbedUrl}`}
                  userId={userId}
                  courseId={id as string}
                  moduleId={String(activeModule.video_cf_id || activeModule.id)}
                  videoUrl={videoEmbedUrl}
                  thumbnailUrl={playerThumbnailUrl}
                  autoPlay={autoPlayModuleId === String(activeModule.id)}
                  initialPositionSeconds={
                    playbackPositions[String(activeModule.id)] || 0
                  }
                  progressAliasIds={getModuleProgressIds(activeModule)}
                  onProgressPosition={(positionSeconds) => {
                    saveLocalPlaybackPosition(
                      String(activeModule.id),
                      positionSeconds,
                      false,
                    );
                  }}
                  onCompleted={() => {
                    const moduleKey = String(activeModule.id);
                    applyAutoCompletionState(moduleKey);
                    const currentIndex = modules.findIndex(
                      (module) => String(module.id) === moduleKey,
                    );
                    const nextModule =
                      currentIndex >= 0 ? modules[currentIndex + 1] : null;
                    if (userId && id) {
                      try {
                        const key = getProgressStorageKey(userId, String(id));
                        const existing = localStorage.getItem(key);
                        const parsed = existing
                          ? (JSON.parse(existing) as Record<string, boolean>)
                          : {};
                        parsed[moduleKey] = true;
                        localStorage.setItem(key, JSON.stringify(parsed));
                        saveLocalPlaybackPosition(moduleKey, 0);
                      } catch (localProgressError) {
                        console.warn(
                          "Failed to save local progress fallback:",
                          localProgressError,
                        );
                      }
                    }
                    if (nextModule) {
                      const nextModuleKey = String(nextModule.id);
                      saveLocalPlaybackPosition(nextModuleKey, 0);
                      setAutoPlayModuleId(nextModuleKey);
                      setActiveModuleId(nextModuleKey);
                      if (typeof window !== "undefined") {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    } else {
                      setAutoPlayModuleId(null);
                    }
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10 bg-gradient-to-br from-gray-900 to-copy-dark">
                  <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 backdrop-blur-md border border-white/10">
                    <PlayCircle
                      size={40}
                      className="text-white opacity-80"
                      strokeWidth={1}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {activeModule?.title || "Select a module"}
                  </h3>
                  <p className="text-gray-400 text-sm max-w-sm">
                    Instructional media for this module is being processed or
                    will be available soon.
                  </p>

                  <div className="absolute top-10 left-10 w-32 h-32 bg-brand-heading rounded-full blur-[100px] opacity-20" />
                  <div className="absolute bottom-10 right-10 w-32 h-32 bg-purple-500 rounded-full blur-[100px] opacity-10" />
                </div>
              )}
            </div>

            {/* Mobile Tab Selector & Tab Content */}
            <div className="xl:hidden">
              <div className="flex border-b border-gray-100 bg-gray-50/50 rounded-xl overflow-hidden mb-6">
                <button
                  onClick={() => handleTabChange("overview")}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${activeTab === "overview"
                    ? "border-brand-heading text-brand-heading bg-white"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                    }`}
                >
                  <BookOpen size={13} />
                  Overview
                </button>
                <button
                  onClick={() => handleTabChange("modules")}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${activeTab === "modules"
                    ? "border-brand-heading text-brand-heading bg-white"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                    }`}
                >
                  <Clock size={13} />
                  Modules
                </button>
                <button
                  onClick={() => handleTabChange("quizzes")}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 relative ${activeTab === "quizzes"
                    ? "border-brand-heading text-brand-heading bg-white"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                    }`}
                >
                  <HelpCircle size={13} />
                  Quizzes
                  {(courseQuizzes.length > 0 || modules.some((m) => m.module_type === "quiz")) && (
                    <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-alt"></span>
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleTabChange("artifacts")}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 relative ${activeTab === "artifacts"
                    ? "border-brand-heading text-brand-heading bg-white"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                    }`}
                >
                  <DownloadCloud size={13} />
                  Artifacts
                  {courseArtifacts.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                  )}
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {activeTab === "overview" && (
                  <div className="p-5 sm:p-6">{renderModuleOverview()}</div>
                )}
                {activeTab === "modules" && renderModulesList()}
                {activeTab === "quizzes" && renderQuizzesList()}
                {activeTab === "artifacts" && renderArtifactsList()}
              </div>
            </div>

            {/* Desktop Overview Block */}
            <div className="hidden xl:block">{renderModuleOverview()}</div>
          </div>
        </div>

        {/* Right: Module Sidebar (Desktop Only) */}
        <div className="hidden xl:flex xl:col-span-4 bg-white xl:sticky xl:top-16 xl:h-[calc(100vh-160px)] mb-6 self-start overflow-hidden border-l border-gray-100 flex-col rounded-bl-xl rounded-br-xl">
          <div className="flex border-b border-gray-100 bg-gray-50/50 shrink-0">
            <button
              onClick={() => handleTabChange("modules")}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${activeTab === "modules" || activeTab === "overview"
                ? "border-brand-heading text-brand-heading bg-white"
                : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                }`}
            >
              <BookOpen size={13} />
              Modules
            </button>
            <button
              onClick={() => handleTabChange("quizzes")}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 relative ${activeTab === "quizzes"
                ? "border-brand-heading text-brand-heading bg-white"
                : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                }`}
            >
              <HelpCircle size={13} />
              Quizzes
              {(courseQuizzes.length > 0 || modules.some((m) => m.module_type === "quiz")) && (
                <span className="absolute top-2 right-2 flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-alt"></span>
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange("artifacts")}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 relative ${activeTab === "artifacts"
                ? "border-brand-heading text-brand-heading bg-white"
                : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                }`}
            >
              <DownloadCloud size={13} />
              Artifacts
              {courseArtifacts.length > 0 && (
                <span className="absolute top-2 right-2 flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 flex flex-col divide-y divide-gray-50 overflow-y-auto">
            {(activeTab === "modules" || activeTab === "overview") &&
              renderModulesList()}
            {activeTab === "quizzes" && renderQuizzesList()}
            {activeTab === "artifacts" && renderArtifactsList()}
          </div>
        </div>
      </main>

      {/* QUIZ MODAL */}
      {showQuizModal && activeQuiz && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowQuizModal(false)}
          />

          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="h-2 w-full bg-gray-100 relative">
              {quizStep === "questions" && (
                <div
                  className="absolute top-0 left-0 h-full bg-brand-heading transition-all duration-500"
                  style={{
                    width: `${(currentQuestionIndex / activeQuiz.questions.length) * 100}%`,
                  }}
                />
              )}
            </div>

            <div className="p-6 sm:p-10 overflow-y-auto flex-1">
              <button
                onClick={() => setShowQuizModal(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <XIcon size={20} />
              </button>

              {quizStep === "intro" && (
                <div className="text-center py-10">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-brand-heading">
                    <HelpCircle size={40} />
                  </div>
                  <h2 className={`${TYPOGRAPHY_CLASSES.SUBHEADING} mb-3`}>
                    {activeQuiz.title}
                  </h2>
                  <p className="text-gray-500 mb-8 max-w-md mx-auto">
                    {activeQuiz.description}
                  </p>

                  <div className="flex items-center justify-center gap-8 mb-10">
                    <div className="text-center">
                      <span className="block text-2xl font-bold text-brand-heading">
                        {activeQuiz.questionsCount}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Questions
                      </span>
                    </div>
                    <div className="w-px h-10 bg-gray-200"></div>
                    <div className="text-center">
                      <span className="block text-2xl font-bold text-brand-heading">
                        {activeQuiz.passingScore}%
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        To Pass
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={() => setQuizStep("questions")}
                    className="w-full sm:w-auto px-10 py-6 rounded-full bg-brand-heading hover:bg-brand-heading-hover text-white font-bold tracking-wide shadow-lg shadow-blue-900/20"
                  >
                    Begin Assessment
                  </Button>
                </div>
              )}

              {quizStep === "questions" &&
                activeQuiz.questions[currentQuestionIndex] && (
                  <div className="py-4">
                    <div className="flex items-center justify-between mb-8">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Question {currentQuestionIndex + 1} of{" "}
                        {activeQuiz.questions.length}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-blue-50 text-brand-heading text-[10px] font-bold">
                        {activeQuiz.questions[currentQuestionIndex].questionType === "text"
                          ? "Fill in the Blank"
                          : activeQuiz.questions[currentQuestionIndex].type || "Multiple Choice"}
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mb-8">
                      {activeQuiz.questions[currentQuestionIndex].text}
                    </h3>

                    {activeQuiz.questions[currentQuestionIndex].questionType === "text" ||
                    !activeQuiz.questions[currentQuestionIndex].options ||
                    activeQuiz.questions[currentQuestionIndex].options.length === 0 ? (
                      <div className="space-y-3">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                          Your Answer (Short Text)
                        </label>
                        <input
                          type="text"
                          placeholder="Type your answer here..."
                          value={String(selectedAnswer ?? "")}
                          onChange={(e) => setSelectedAnswer(e.target.value)}
                          disabled={isAnswerSubmitted || isVerifyingQuiz}
                          className={`w-full p-4 sm:p-5 rounded-2xl border-2 text-base font-medium focus:outline-none transition-all ${
                            isAnswerSubmitted
                              ? String(selectedAnswer || "").trim().toLowerCase() ===
                                String(revealedAnswers[currentQuestionIndex] || "").trim().toLowerCase()
                                ? "border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold"
                                : "border-red-500 bg-red-50 text-red-900 font-semibold"
                              : "border-gray-200 focus:border-brand-heading focus:bg-blue-50/30 text-gray-900"
                          }`}
                        />
                        {isAnswerSubmitted && (
                          <div className="text-xs font-semibold mt-2">
                            {String(selectedAnswer || "").trim().toLowerCase() ===
                            String(revealedAnswers[currentQuestionIndex] || "").trim().toLowerCase() ? (
                              <span className="text-emerald-700 flex items-center gap-1 font-bold">
                                <Check size={14} /> Correct answer!
                              </span>
                            ) : (
                              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-800">
                                <span className="font-bold">Incorrect.</span> Correct answer:{" "}
                                <strong className="text-gray-900 underline font-bold">
                                  {String(revealedAnswers[currentQuestionIndex] || "")}
                                </strong>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeQuiz.questions[currentQuestionIndex].options.map(
                          (option: string, idx: number) => {
                            const isSelected = selectedAnswer === idx;
                            const isCorrectAnswer =
                              revealedAnswers[currentQuestionIndex] === idx;

                            let optionClass =
                              "border-gray-200 hover:border-brand-heading hover:bg-blue-50/50";

                            if (isAnswerSubmitted) {
                              if (isCorrectAnswer) {
                                optionClass =
                                  "border-emerald-500 bg-emerald-50 text-emerald-900";
                              } else if (isSelected && !isCorrectAnswer) {
                                optionClass =
                                  "border-red-500 bg-red-50 text-red-900";
                              } else {
                                optionClass = "border-gray-200 opacity-50";
                              }
                            } else if (isSelected) {
                              optionClass =
                                "border-brand-heading bg-blue-50 ring-1 ring-brand-heading";
                            }

                            return (
                              <button
                                key={idx}
                                onClick={() => handleAnswerSelect(idx)}
                                disabled={isAnswerSubmitted || isVerifyingQuiz}
                                className={`w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start gap-3 sm:gap-4 ${optionClass}`}
                              >
                                <div
                                  className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                                    isAnswerSubmitted && isCorrectAnswer
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : isAnswerSubmitted &&
                                        isSelected &&
                                        !isCorrectAnswer
                                        ? "bg-red-500 border-red-500 text-white"
                                        : isSelected
                                          ? "border-brand-heading bg-brand-heading text-white"
                                          : "border-gray-300"
                                  }`}
                                >
                                  {isAnswerSubmitted && isCorrectAnswer ? (
                                    <Check size={14} />
                                  ) : isAnswerSubmitted &&
                                    isSelected &&
                                    !isCorrectAnswer ? (
                                    <XIcon size={14} />
                                  ) : isSelected ? (
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                  ) : null}
                                </div>
                                <span className="font-medium flex-1 text-sm sm:text-base">
                                  {option}
                                </span>
                              </button>
                            );
                          },
                        )}
                      </div>
                    )}

                    {isAnswerSubmitted &&
                      activeQuiz.questions[currentQuestionIndex]
                        .explanation && (
                        <div className="mt-6 p-5 rounded-2xl bg-gray-50 border border-gray-100 flex items-start gap-3">
                          <HelpCircle
                            size={20}
                            className="text-brand-heading shrink-0 mt-0.5"
                          />
                          <div>
                            <span className="block text-xs font-bold text-gray-900 mb-1 uppercase tracking-wider">
                              Explanation
                            </span>
                            <p className="text-sm text-gray-600 leading-relaxed">
                              {
                                activeQuiz.questions[currentQuestionIndex]
                                  .explanation
                              }
                            </p>
                          </div>
                        </div>
                      )}

                    <div className="mt-10 flex justify-end">
                      {!isAnswerSubmitted ? (
                        <Button
                          onClick={handleVerifyAnswer}
                          disabled={selectedAnswer === null || isVerifyingQuiz}
                          className="px-8 py-6 rounded-xl bg-brand-heading hover:bg-brand-heading-hover text-white font-bold"
                        >
                          {isVerifyingQuiz ? "Verifying..." : "Submit Answer"}
                        </Button>
                      ) : currentQuestionIndex <
                        activeQuiz.questions.length - 1 ? (
                        <Button
                          onClick={handleNextQuestion}
                          className="px-8 py-6 rounded-xl bg-gray-900 hover:bg-black text-white font-bold"
                        >
                          Next Question
                        </Button>
                      ) : (
                        <Button
                          onClick={handleViewResults}
                          className="px-8 py-6 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20"
                        >
                          View Results
                        </Button>
                      )}
                    </div>
                  </div>
                )}

              {quizStep === "results" && (
                <div className="text-center py-8">
                  {(() => {
                    const totalQuestions = activeQuiz.questions.length;
                    const scorePercentage = Math.round(
                      (quizScore / totalQuestions) * 100,
                    );
                    const isPassed = scorePercentage >= activeQuiz.passingScore;

                    return (
                      <>
                        <div className="relative inline-block mb-6">
                          <svg className="w-32 h-32 transform -rotate-90">
                            <circle
                              className="text-gray-100"
                              strokeWidth="8"
                              stroke="currentColor"
                              fill="transparent"
                              r="58"
                              cx="64"
                              cy="64"
                            />
                            <circle
                              className={
                                isPassed ? "text-emerald-500" : "text-amber-500"
                              }
                              strokeWidth="8"
                              strokeDasharray={364.4}
                              strokeDashoffset={
                                364.4 - (364.4 * scorePercentage) / 100
                              }
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="transparent"
                              r="58"
                              cx="64"
                              cy="64"
                              style={{
                                transition:
                                  "stroke-dashoffset 1.5s ease-in-out",
                              }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-gray-900">
                              {scorePercentage}%
                            </span>
                          </div>
                        </div>

                        <h2 className={`${TYPOGRAPHY_CLASSES.SUBHEADING} mb-2`}>
                          {isPassed
                            ? "Assessment Passed!"
                            : "Needs Improvement"}
                        </h2>
                        <p className="text-gray-500 mb-8 max-w-md mx-auto">
                          {isPassed
                            ? "Great job! You have demonstrated a strong understanding of the material covered in this quiz."
                            : `You scored ${scorePercentage}%. You need ${activeQuiz.passingScore}% to pass. Review the material and try again.`}
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                          <Button
                            onClick={handleRestartQuiz}
                            className="w-full sm:w-auto px-8 py-6 rounded-xl bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 font-bold flex items-center justify-center gap-2"
                          >
                            <RefreshCw size={18} /> Retake Quiz
                          </Button>
                          <Button
                            onClick={() => setShowQuizModal(false)}
                            className="w-full sm:w-auto px-8 py-6 rounded-xl bg-brand-heading hover:bg-brand-heading-hover text-white font-bold"
                          >
                            Return to Course
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── COURSE FINISHED POPUP ─── */}
      {showCourseFinishedPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 sm:p-10 text-center relative animate-[fadeInUp_0.4s_ease-out]">
            {/* Trophy / Award Icon */}
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Award size={40} className="text-white" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              🎉 Course Finished!
            </h2>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
              Congratulations on completing <span className="font-semibold text-gray-800">{course?.title}</span>! Your certificate of achievement has been generated and is ready to download.
            </p>

            <div className="w-full rounded-3xl border border-amber-100 bg-amber-50/70 p-5 sm:p-6 text-left mb-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <Award size={18} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-800">Leave a quick review</h3>
                  <p className="text-xs text-gray-600">Rate your experience and share any feedback or concerns with us.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      setReviewRating(star);
                      setReviewError("");
                      if (reviewSaved) setReviewSaved(false);
                    }}
                    className="transition-transform hover:scale-110 p-1 rounded"
                    aria-label={`Rate ${star} out of 5`}
                  >
                    <Star
                      size={24}
                      className={star <= reviewRating ? "text-amber-500 fill-amber-500" : "text-gray-300"}
                      strokeWidth={1.6}
                    />
                  </button>
                ))}
              </div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                Your experience
              </label>
              <textarea
                value={reviewText}
                onChange={(event) => {
                  setReviewText(event.target.value);
                  if (reviewError) setReviewError("");
                  if (reviewSaved) setReviewSaved(false);
                }}
                rows={5}
                placeholder="Share what you liked, what felt difficult, or any suggestions you have..."
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 min-h-[120px]"
              />

              {reviewError && (
                <p className="mt-2 text-sm text-red-600">{reviewError}</p>
              )}
              {reviewSaved && (
                <p className="mt-2 text-sm font-medium text-emerald-600">
                  Thank you! Your review has been saved.
                </p>
              )}

              <Button
                onClick={() => handleSubmitReview()}
                disabled={reviewSubmitting || !reviewText.trim() || reviewRating < 1}
                className="mt-4 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-600 hover:bg-slate-700 text-white font-bold text-sm transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              >
                {reviewSubmitting ? "Saving review..." : reviewSaved ? "Update Review" : "Save Review"}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={handleOpenCertificateModal}
                disabled={!reviewSaved || !reviewText.trim() || reviewRating < 1}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-600/10 border border-amber-700/10 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Award size={16} /> Download Certificate
              </Button>
              <Button
                onClick={() => {
                  if (!reviewSaved || !reviewText.trim() || reviewRating < 1) {
                    setReviewError("Please complete and save your review before continuing.");
                    return;
                  }
                  setShowCourseFinishedPopup(false);
                }}
                disabled={!reviewSaved || !reviewText.trim() || reviewRating < 1}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              >
                Continue Exploring
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirmModal && Boolean(moduleToDelete)}
        onClose={() => {
          setShowDeleteConfirmModal(false);
          setModuleToDelete(null);
        }}
        title="Delete this module?"
        description={`This action will remove ${moduleToDelete?.title || "this module"} from the course. This cannot be undone.`}
        icon={<Trash2 size={28} />}
        confirmText={deletingModuleId === String(moduleToDelete?.id) ? "Deleting..." : "Yes, delete"}
        cancelText="Cancel"
        confirmDisabled={deletingModuleId === String(moduleToDelete?.id)}
        onConfirm={confirmDeleteModule}
      />

      <Modal
        open={showCertificateModal && canViewCertificate}
        onClose={() => setShowCertificateModal(false)}
        panelClassName="max-w-4xl w-full border border-gray-100 relative p-1 bg-gradient-to-br from-amber-400 via-white to-amber-400 max-h-[90vh] overflow-y-auto scrollbar-hide"
      >
        <div className="bg-white rounded-[22px] p-6 sm:p-8 md:p-12 flex flex-col items-center justify-center text-center relative border border-amber-500/10">

          {/* Responsive Certificate Preview */}
          <div className="w-full overflow-hidden flex justify-center items-center py-4 bg-gray-50 rounded-2xl border border-gray-100 mb-6 h-[300px] sm:h-[450px]">
            <div className="scale-[0.3] sm:scale-[0.5] md:scale-[0.6] origin-center shadow-lg rounded-lg border bg-white overflow-hidden shrink-0">
              <Certificate
                userName={studentName}
                courseName={course.title}
                completedDate={new Date().toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              />
            </div>
          </div>

          <div className="mb-2">
            <CertificateDownload
              userName={studentName}
              courseName={course.title}
              completedDate={new Date().toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            />
          </div>

        </div>
      </Modal>

      <Modal
        open={showFeedbackModal}
        onClose={() => {
          setShowFeedbackModal(false);
          setFeedbackSaved(false);
          setFeedbackError("");
        }}
        panelClassName="max-w-lg w-full p-6 bg-white border border-gray-100 shadow-2xl rounded-3xl"
      >
        <div className="mb-4 pr-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare size={20} className="text-amber-500" />
            Course Feedback
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            You can send feedback as many times as you like during your learning journey!
          </p>
        </div>
        <ReviewForm
          reviewRating={feedbackRating}
          reviewText={feedbackText}
          error={feedbackError}
          saved={feedbackSaved}
          submitting={feedbackSubmitting}
          onRatingChange={(rating) => {
            setFeedbackRating(rating);
            setFeedbackError("");
            if (feedbackSaved) setFeedbackSaved(false);
          }}
          onReviewTextChange={(value) => {
            setFeedbackText(value);
            if (feedbackError) setFeedbackError("");
            if (feedbackSaved) setFeedbackSaved(false);
          }}
          onSubmit={() => handleSubmitFeedback()}
        />
      </Modal>

    </div>
  );
}
