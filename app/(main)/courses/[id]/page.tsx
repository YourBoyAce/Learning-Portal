"use client";

import { useEffect, useState, useMemo } from "react";
import { useLoading } from "@/app/context/LoadingContext";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { upsertUserProgress } from "@/app/actions/user-progress";
import Certificate from "@/app/components/certificate/Certificate";
import CertificateDownload from "@/app/components/certificate/CertificateDownload";
import Image from "next/image";
import {
  PlayCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  BookOpen,
  Loader2,
  AlertCircle,
  HelpCircle,
  Award,
  Check,
  RefreshCw,
  X as XIcon,
  FileText,
  FileArchive,
  FileCode,
  Layers,
  DownloadCloud,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";

// IMPORT OUR NEW VIDEO PLAYER
import CourseVideoPlayer from "./components/CourseVideoPlayer";
import { ICONS } from "@/app/styles/icons";

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
  const [userBatchIds, setUserBatchIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setGlobalLoading(loading);
    return () => setGlobalLoading(false);
  }, [loading, setGlobalLoading]);
  const [course, setCourse] = useState<Course | null>(null);
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
  const [autoPlayModuleId, setAutoPlayModuleId] = useState<string | null>(null);

  // --- QUIZZES & ARTIFACTS INTEGRATION STATE ---
  const [activeTab, setActiveTab] = useState<
    "overview" | "modules" | "quizzes" | "artifacts"
  >("modules");
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
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
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
      // 1. Fetch quizzes from localStorage
      const saved = localStorage.getItem("automate_portal_quizzes");
      let allQuizzes = [];
      if (saved) {
        try {
          allQuizzes = JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse quizzes:", e);
        }
      }

      // 2. Filter quizzes for this course + batch access
      const filteredQuizzes = allQuizzes.filter((q: any) => {
        if (q.status !== "Active") return false;
        const courseMatch = String(q.courseId) === String(id) ||
          q.courseName.toLowerCase() === course.title.toLowerCase();
        if (!courseMatch) return false;
        if (!q.batchId) return true;
        return userBatchIds.includes(String(q.batchId));
      });
      setCourseQuizzes(filteredQuizzes);

      // 3. Fetch artifacts directly from Supabase (admin panel saves to DB, not localStorage)
      const fetchArtifacts = async () => {
        try {
          const { data: dbArtifacts, error } = await supabase
            .from("course_artifacts")
            .select(`*, maincourses(title)`)
            .eq("status", "Published")
            .eq("course_id", id);

          if (!error && dbArtifacts && dbArtifacts.length > 0) {
            const batchFiltered = dbArtifacts.filter((it: any) => {
              if (!it.batch_id) return true;
              return userBatchIds.includes(String(it.batch_id));
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
  }, [course, id, userBatchIds]);

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

  const handleStartQuiz = (quiz: any) => {
    setActiveQuiz(quiz);
    setQuizStep("intro");
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setIsAnswerSubmitted(false);
    setUserAnswers({});
    setShowQuizModal(true);
  };

  const handleAnswerSelect = (optionIndex: number) => {
    if (!isAnswerSubmitted) {
      setSelectedAnswer(optionIndex);
    }
  };

  const handleVerifyAnswer = () => {
    if (selectedAnswer === null || isAnswerSubmitted) return;

    const currentQuestion = activeQuiz.questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
    }

    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: selectedAnswer,
    }));

    setIsAnswerSubmitted(true);
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setCurrentQuestionIndex((prev) => prev + 1);
  };

  const handleViewResults = () => {
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
  };

  const handleRestartQuiz = () => {
    setQuizStep("questions");
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setIsAnswerSubmitted(false);
    setUserAnswers({});
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
        const { data: batchRows } = await supabase
          .from("batch_members")
          .select("batch_id")
          .eq("email", userEmail);
        setUserBatchIds((batchRows || []).map((r: any) => String(r.batch_id)));
      }

      const { data: courseData, error: courseError } = await supabase
        .from("maincourses")
        .select("*")
        .eq("id", id)
        .single();

      if (courseError || !courseData)
        throw courseError || new Error("Course not found");
      setCourse(courseData);

      const { data: modulesData, error: modulesError } = await supabase
        .from("coursemodules")
        .select("*")
        .eq("maincourse_id", id)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      if (modulesError) throw modulesError;
      const orderedModules = modulesData || [];
      setModules(orderedModules);

      let { data: progressData, error: progressError }: {
        data: any[] | null;
        error: any;
      } = await supabase
        .from("user_video_progress")
        .select("video_id, completed, completed_at, updated_at, last_position_seconds")
        .eq("user_id", user.id)
        .eq("course_id", id);

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
          .eq("course_id", id);
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
      if (orderedModules.length > 0) {
        const requestedModuleId = searchParams.get("module");
        const requestedModule = findModuleByLookupId(
          orderedModules,
          requestedModuleId
        );

        let targetModule = requestedModule;

        if (!targetModule) {
          // First priority: unfinished module that already has watch progress
          targetModule = orderedModules.find((module) => {
            const moduleKey = getModuleKey(module);
            return (
              !progressMap[moduleKey] &&
              (positionMap[moduleKey] ?? 0) > 0
            );
          });

          // Second priority: first unfinished module
          if (!targetModule) {
            targetModule = orderedModules.find((module) => {
              const moduleKey = getModuleKey(module);
              return !progressMap[moduleKey];
            });
          }

          // Third priority: course fully completed, show last module
          if (!targetModule) {
            targetModule = orderedModules[orderedModules.length - 1];
          }
        }

        if (targetModule) {
          setActiveModuleId(getModuleKey(targetModule));
        }
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.full_name) {
        setStudentName(profile.full_name);
      } else {
        setStudentName(user.email?.split("@")[0] || "Learner");
      }

      const { data: certData } = await supabase
        .from("certificates")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", id)
        .maybeSingle();

      setHasCertificate(!!certData);
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
            {/* Kept as a fallback / visual acknowledgement badge! */}
            {activeModuleId && (
              <div className="flex flex-col items-end gap-2">
                <Button
                  onClick={() => handleMarkAsCompleted(activeModuleId)}
                  disabled={isMarkingCompleted || !activeModule?.video_cf_id}
                  className={`rounded-full px-6 py-5 text-xs font-bold tracking-wide transition ${!activeModule?.video_cf_id
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : isCurrentModuleComplete
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : !isMarkingCompleted
                        ? "bg-brand-heading hover:bg-brand-heading-hover text-white"
                        : "bg-gray-200 text-gray-500 cursor-not-allowed"
                    }`}
                >
                  {isMarkingCompleted
                    ? "Saving..."
                    : isCurrentModuleComplete
                      ? "Mark as Incomplete"
                      : isCurrentModuleAcknowledged
                        ? "Mark as Complete"
                        : "Mark as Complete"}
                </Button>
                {!activeModule?.video_cf_id && (
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
              onClick={() => setShowCertificateModal(true)}
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
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleDeleteModule = async (mod: Module) => {
    if (!isAdminCoursePage || deletingModuleId) return;

    const confirmed = window.confirm(
      `Delete "${mod.title}" from this course? This cannot be undone.`,
    );
    if (!confirmed) {
      setOpenModuleMenuId(null);
      return;
    }

    try {
      setDeletingModuleId(String(mod.id));
      setModuleDeleteError("");

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      const response = await fetch(
        `/api/admin/coursemodules?moduleId=${encodeURIComponent(
          String(mod.id),
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

      const deletedKey = getModuleKey(mod);
      const nextModules = modules.filter(
        (moduleItem) => getModuleKey(moduleItem) !== deletedKey,
      );
      setModules(nextModules);
      setUserProgress((prev) => {
        const next = { ...prev };
        for (const progressId of getModuleProgressIds(mod)) {
          delete next[progressId];
        }
        return next;
      });
      setModuleCompletedAt((prev) => {
        const next = { ...prev };
        for (const progressId of getModuleProgressIds(mod)) {
          delete next[progressId];
        }
        return next;
      });
      setPlaybackPositions((prev) => {
        const next = { ...prev };
        for (const progressId of getModuleProgressIds(mod)) {
          delete next[progressId];
        }
        return next;
      });

      if (activeModuleId && getModuleProgressIds(mod).includes(activeModuleId)) {
        setActiveModuleId(nextModules[0] ? getModuleKey(nextModules[0]) : null);
        setAutoPlayModuleId(null);
      }

      setOpenModuleMenuId(null);
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
    return (
      <>
        <div className="p-6 border-b border-gray-50 bg-gray-50/10 text-left">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">
            Curriculum Outline
          </h3>
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold">
            <span className="flex items-center gap-1.5">
              <BookOpen size={14} /> {modules.length} Modules
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} /> {totalDuration || "—"}
            </span>
          </div>
        </div>

        {isAdminCoursePage && moduleDeleteError && (
          <div className="mx-5 mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {moduleDeleteError}
          </div>
        )}

        {modules.map((mod, index) => {
          const moduleKey = getModuleKey(mod);
          const isActive = moduleKey === activeModuleId;
          const isCompleted = userProgress[moduleKey];

          return (
            <div
              key={mod.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                selectModule(moduleKey);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectModule(moduleKey);
                }
              }}
              className={`relative w-full cursor-pointer text-left p-5 transition-all flex items-start gap-4 group ${isActive
                ? "bg-blue-50/50 border-r-4 border-brand-heading"
                : "hover:bg-gray-50"
                }`}
            >
              <div
                className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${isCompleted
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : isActive
                    ? "bg-brand-heading border-brand-heading text-white"
                    : "bg-white border-gray-200 text-gray-400 group-hover:border-brand-heading group-hover:text-brand-heading"
                  }`}
              >
                {isCompleted ? <CheckCircle2 size={14} /> : index + 1}
              </div>

              <div className="flex-1 min-w-0">
                <h4
                  className={`text-sm font-bold mb-1 leading-snug transition-colors ${isActive
                    ? "text-brand-heading"
                    : "text-gray-900 group-hover:text-brand-heading"
                    }`}
                >
                  {mod.title}
                </h4>
                {mod.description && (
                  <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2 mb-1.5">
                    {mod.description}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                    <Clock size={10} /> {mod.duration || "—"}
                  </span>
                </div>
              </div>

              {isAdminCoursePage && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenModuleMenuId((current) =>
                        current === moduleKey ? null : moduleKey,
                      );
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                    className="rounded-lg p-1.5 text-gray-400 opacity-100 transition-colors hover:bg-white hover:text-gray-700 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={`Open actions for ${mod.title}`}
                  >
                    <MoreVertical size={16} />
                  </button>

                  {openModuleMenuId === moduleKey && (
                    <div
                      className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-lg"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleDeleteModule(mod)}
                        onKeyDown={(event) => event.stopPropagation()}
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
        })}

        {modules.length === 0 && (
          <div className="p-10 text-center text-gray-400">
            <Loader2
              size={32}
              className="mx-auto mb-4 animate-spin opacity-20"
            />
            <p className="text-xs font-bold uppercase tracking-widest">
              No modules available
            </p>
          </div>
        )}
      </>
    );
  };

  const renderQuizzesList = () => {
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

        {courseQuizzes.length === 0 && (
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

        {courseArtifacts.length === 0 && (
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

      <main className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-64px)]">
        <div className="lg:col-span-9 p-4 sm:p-6 lg:p-8 lg:border-r border-gray-100 bg-white/30">
          <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
            {/* INTEGRATED VIDEO PLAYER WITH AUTO-COMPLETION */}
            <div className="relative aspect-video bg-black rounded-xl sm:rounded-[2rem] overflow-hidden shadow-2xl group border-4 sm:border-[8px] border-white ring-1 ring-gray-100">
              {activeModule && userId && videoEmbedUrl ? (
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
            <div className="lg:hidden">
              <div className="flex border-b border-gray-100 bg-gray-50/50 rounded-xl overflow-hidden mb-6">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${activeTab === "overview"
                    ? "border-brand-heading text-brand-heading bg-white"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                    }`}
                >
                  <BookOpen size={13} />
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("modules")}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${activeTab === "modules"
                    ? "border-brand-heading text-brand-heading bg-white"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                    }`}
                >
                  <Clock size={13} />
                  Modules
                </button>
                <button
                  onClick={() => setActiveTab("quizzes")}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 relative ${activeTab === "quizzes"
                    ? "border-brand-heading text-brand-heading bg-white"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                    }`}
                >
                  <HelpCircle size={13} />
                  Quizzes
                  {courseQuizzes.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-alt"></span>
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("artifacts")}
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
            <div className="hidden lg:block">{renderModuleOverview()}</div>
          </div>
        </div>

        {/* Right: Module Sidebar (Desktop Only) */}
        <div className="hidden lg:flex lg:col-span-3 bg-white lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] overflow-y-auto border-l border-gray-100 flex-col">
          <div className="flex border-b border-gray-100 bg-gray-50/50 shrink-0">
            <button
              onClick={() => setActiveTab("modules")}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${activeTab === "modules" || activeTab === "overview"
                ? "border-brand-heading text-brand-heading bg-white"
                : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                }`}
            >
              <BookOpen size={13} />
              Modules
            </button>
            <button
              onClick={() => setActiveTab("quizzes")}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 relative ${activeTab === "quizzes"
                ? "border-brand-heading text-brand-heading bg-white"
                : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                }`}
            >
              <HelpCircle size={13} />
              Quizzes
              {courseQuizzes.length > 0 && (
                <span className="absolute top-2 right-2 flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-alt"></span>
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("artifacts")}
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

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
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
                        {activeQuiz.questions[currentQuestionIndex].type ||
                          "Multiple Choice"}
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mb-8">
                      {activeQuiz.questions[currentQuestionIndex].text}
                    </h3>

                    <div className="space-y-3">
                      {activeQuiz.questions[currentQuestionIndex].options.map(
                        (option: string, idx: number) => {
                          const isSelected = selectedAnswer === idx;
                          const isCorrectAnswer =
                            activeQuiz.questions[currentQuestionIndex]
                              .correctAnswer === idx;

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
                              disabled={isAnswerSubmitted}
                              className={`w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start gap-3 sm:gap-4 ${optionClass}`}
                            >
                              <div
                                className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${isAnswerSubmitted && isCorrectAnswer
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
                          disabled={selectedAnswer === null}
                          className="px-8 py-6 rounded-xl bg-brand-heading hover:bg-brand-heading-hover text-white font-bold"
                        >
                          Submit Answer
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
            {/* Close Button */}
            <button
              onClick={() => setShowCourseFinishedPopup(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
            >
              <XIcon size={20} />
            </button>

            {/* Trophy / Award Icon */}
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Award size={40} className="text-white" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              🎉 Course Finished!
            </h2>
            <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
              Congratulations on completing <span className="font-semibold text-gray-800">{course?.title}</span>! Your certificate of achievement has been generated and is ready to download.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={() => {
                  setShowCourseFinishedPopup(false);
                  setShowCertificateModal(true);
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-600/10 border border-amber-700/10 transition-all cursor-pointer"
              >
                <Award size={16} /> Download Certificate
              </Button>
              <Button
                onClick={() => setShowCourseFinishedPopup(false)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-all cursor-pointer"
              >
                Continue Exploring
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCertificateModal && canViewCertificate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-gray-100 relative p-1 bg-gradient-to-br from-amber-400 via-white to-amber-400 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="bg-white rounded-[22px] p-6 sm:p-8 md:p-12 flex flex-col items-center justify-center text-center relative border border-amber-500/10">

              {/* Close Button */}
              <button
                onClick={() => setShowCertificateModal(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
              >
                <XIcon size={20} />
              </button>

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
          </div>
        </div>
      )}

    </div>
  );
}
