"use client";

import { useEffect, useState } from "react";
import { useLoading } from "@/app/context/LoadingContext";
import { supabase } from "@/app/lib/supabase";
import {Button} from "@/components/ui/button";
import {ICONS} from "@/app/styles/icons";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import Image from "next/image";
import {
  FileText,
  FileArchive,
  FileCode,
  BarChart3,
  Layers,
  DownloadCloud,
  HelpCircle,
  Award,
  Check,
  RefreshCw,
  X as XIcon,
} from "lucide-react";

const ARTIFACT_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_ARTIFACTS_BUCKET || "course-artifacts";
const ARTIFACT_BUCKET_FALLBACKS = ["course-artifacts", "course_artifacts"];

export default function StudentPracticeCenter() {
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

  const { setLoading: setGlobalLoading } = useLoading();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setGlobalLoading(loading);
    return () => setGlobalLoading(false);
  }, [loading, setGlobalLoading]);
  const [activeTab, setActiveTab] = useState<"quizzes" | "artifacts">("quizzes");
  
  // Enrolled Courses & Data State
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [coursesMap, setCoursesMap] = useState<Record<string, string>>({});
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [bestScores, setBestScores] = useState<Record<string, Record<string, number>>>({}); // courseId -> quizId -> score

  // Interactive Quiz Taker Modal State
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<string | number>("");
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizStep, setQuizStep] = useState<"intro" | "questions" | "results">("intro");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    const loadStudentData = async () => {
      try {
        setLoading(true);

        // 1. Get user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        // 2. Fetch enrolled course IDs
        const { data: enrollments, error: enrollError } = await supabase
          .from("course_enrollments")
          .select("course_id")
          .eq("user_id", session.user.id);

        if (enrollError) throw enrollError;
        const enrolledIds = (enrollments || []).map(e => String(e.course_id));
        setEnrolledCourseIds(enrolledIds);

        // 3. Fetch courses to build Name mapping
        const { data: dbCourses } = await supabase
          .from("maincourses")
          .select("id, title");

        const mapping: Record<string, string> = {};
        const enrolledTitles: string[] = [];
        if (dbCourses) {
          dbCourses.forEach(c => {
            mapping[String(c.id)] = c.title;
            if (enrolledIds.includes(String(c.id))) {
              enrolledTitles.push(c.title.toLowerCase());
            }
          });
          setCoursesMap(mapping);
        }

        // 4. Load & Filter Quizzes from localStorage
        const savedQuizzes = localStorage.getItem("automate_portal_quizzes");
        let allQuizzes = [];
        if (savedQuizzes) {
          try { allQuizzes = JSON.parse(savedQuizzes); } catch (e) { console.error(e); }
        }

        const filteredQuizzes = allQuizzes.filter((q: any) =>
          q.status === "Active" &&
          (enrolledIds.includes(String(q.courseId)) ||
           enrolledTitles.includes(q.courseName.toLowerCase()))
        );
        setQuizzes(filteredQuizzes);

// 5. Load Artifacts from Supabase
const { data: artifactsData, error: artifactsError } = await supabase
  .from("course_artifacts")
  .select("*")
  .eq("status", "Published")
  .order("created_at", { ascending: false });

if (artifactsError) {
  console.error("Artifacts fetch error:", artifactsError);
} else {
  const formattedArtifacts =
    artifactsData
      ?.filter((art: any) =>
        enrolledIds.includes(String(art.course_id))
      )
      .map((art: any) => ({
        id: art.id,
        name: art.name,
        type: art.type,
        courseId: art.course_id,
        courseName:
          mapping[String(art.course_id)] || "Unknown Course",
        size: art.size,
        description: art.description,
        downloadsCount: art.downloads_count || 0,
        fileUrl: art.file_url,
        filePath: art.file_path,
        status: art.status,
      })) || [];

  setArtifacts(formattedArtifacts);
}

        // 6. Load Best Scores for each enrolled course
        const loadedBestScores: Record<string, Record<string, number>> = {};
        enrolledIds.forEach(cId => {
          const scoreData = localStorage.getItem(`best_scores_${cId}`);
          if (scoreData) {
            try { loadedBestScores[cId] = JSON.parse(scoreData); } catch (e) {}
          }
        });
        setBestScores(loadedBestScores);

      } catch (err) {
        console.error("Error loading practice data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadStudentData();
  }, []);

  // Practice Taker Actions
  const handleStartQuiz = (quiz: any) => {
    setActiveQuiz(quiz);
    setActiveCourseId(quiz.courseId || "");
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
      setQuizScore(prev => prev + 1);
    }
    
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: selectedAnswer
    }));
    
    setIsAnswerSubmitted(true);
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setCurrentQuestionIndex(prev => prev + 1);
  };

  const handleViewResults = () => {
    if (!activeQuiz) return;
    const totalQuestions = activeQuiz.questions.length;
    const scorePercentage = Math.round((quizScore / totalQuestions) * 100);
    const targetCourseId = String(activeCourseId || "general");

    // Save best score
    const courseScores = bestScores[targetCourseId] || {};
    const currentBest = courseScores[activeQuiz.id] || 0;
    
    if (scorePercentage > currentBest) {
      const updatedScores = {
        ...courseScores,
        [activeQuiz.id]: scorePercentage
      };
      
      const newBestScoresState = {
        ...bestScores,
        [targetCourseId]: updatedScores
      };
      
      setBestScores(newBestScoresState);
      localStorage.setItem(`best_scores_${targetCourseId}`, JSON.stringify(updatedScores));
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

  // Download Action
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
      setArtifacts((prev) =>
        prev.map((a) =>
          a.id === art.id
            ? {
                ...a,
                downloadsCount: currentCount + 1,
              }
            : a
        )
      );
    } catch (err) {
      console.error("Download error:", err);
    }
  };
  const getFileIcon = (type: string) => {
    switch (type) {
      case "PDF": return <FileText className="w-6 h-6 text-red-500" />;
      case "ZIP": return <FileArchive className="w-6 h-6 text-amber-500" />;
      case "Code": return <FileCode className="w-6 h-6 text-blue-500" />;
      case "Sheet": return <BarChart3 className="w-6 h-6 text-emerald-500" />;
      default: return <FileText className="w-6 h-6 text-gray-500" />;
    }
  };
  const quizIcon =
    activeTab === "quizzes"
      ? ICONS.BULBLIGHT
      : ICONS.BULB;

  const materialIcon =
    activeTab === "artifacts"
      ? ICONS.MATERIALLIGHT
      : ICONS.MATERIAL;




  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div>
            <h1 className={`${TYPOGRAPHY_CLASSES.MAIN_HEADING} flex items-center gap-2`}>
              Quizzes & Artifacts
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Access your practice assessments, cheat sheets, boilerplates, and downloadable materials in one integrated space.
            </p>
          </div>

          {/* Segmented control tabs */}
          <div className="grid w-full min-w-0 grid-cols-1 gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm sm:w-auto sm:grid-cols-2 sm:shrink-0">
            <Button
              onClick={() => setActiveTab("quizzes")}
              className={`w-full justify-center gap-2 px-3 text-xs sm:min-w-[150px] sm:text-sm ${
                activeTab === "quizzes"
                  ? "bg-brand-primary text-white"
                  : "bg-white text-gray-500 hover:bg-brand-primary/10 hover:text-brand-primary"
              }`}
            >
              <Image
  src={quizIcon}
  width={24}
  height={24}
  alt="Quizzes"
/>
              <span className="truncate">Quizzes ({quizzes.length})</span>
            </Button>
            <Button
              onClick={() => setActiveTab("artifacts")}
              className={`w-full justify-center gap-2 px-3 text-xs sm:min-w-[150px] sm:text-sm ${
                activeTab === "artifacts"
                  ? "bg-brand-primary text-white"
                  : "bg-white text-gray-500 hover:bg-brand-primary/10 hover:text-brand-primary"
              }`}
            >
              <Image src={materialIcon}  width={24}
  height={24} alt="Materials" />
              <span className="truncate">Materials ({artifacts.length})</span>
            </Button>
          </div>
        </div>

        {/* --- TABS BODY --- */}

        {/* Tab 1: Quizzes list */}
        {activeTab === "quizzes" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz) => {
              const quizCourseId = String(quiz.courseId || "general");
              const courseScoreData = bestScores[quizCourseId] || {};
              const score = courseScoreData[quiz.id];
              const hasAttempted = score !== undefined;
              const isPassed = hasAttempted && score >= quiz.passingScore;

              return (
                <div
                  key={quiz.id}
                  className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-gray-200 transition-all group min-h-[220px]"
                >
                  <div className="space-y-4">
                    {/* Header elements */}
                    <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-brand-primary flex items-center justify-center shrink-0 group-hover:bg-brand-primary group-hover:text-white transition-all">
                        <Image src={ICONS.BULB} alt="Bulb" width={24} height={24} />
                      </div>
                      <span className="text-[9px] font-bold text-gray-400 bg-gray-50 border border-gray-100 rounded-md px-2 py-0.5 uppercase tracking-wider block">
                        {quiz.courseName}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-gray-900 leading-snug text-base group-hover:text-brand-primary transition-colors line-clamp-1">
                        {quiz.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-wider mt-1.5">
                        <span>{quiz.questionsCount} Questions</span>
                        <span>•</span>
                        <span>Min {quiz.passingScore}% to pass</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-50 mt-4">
                    {hasAttempted && (
                      <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-gray-50 border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Best Score</span>
                        <span className={`text-xs font-bold flex items-center gap-1 ${
                          isPassed ? "text-brand-primary" : "text-red-600"
                        }`}>
                          <Image src={ICONS.CHAMPION} alt="Award" width={14} height={14} />
                          {score}% ({isPassed ? "Passed" : "Review"})
                        </span>
                      </div>
                    )}

                    <Button
                      onClick={() => handleStartQuiz(quiz)}
                      className={`w-full ${
                        isPassed
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100"
                          : `${TYPOGRAPHY_CLASSES.PRIMARY_BUTTON} text-white`
                      }`}
                    >
                      {hasAttempted ? "Practice Again" : "Start Practice Quiz"}
                    </Button>
                  </div>
                </div>
              );
            })}

            {quizzes.length === 0 && (
              <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center px-4 max-w-lg mx-auto">
                <div className="w-16 h-16 bg-blue-50 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-4\">
                  <HelpCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">No Practice Quizzes Available</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
                  Once your instructors upload quizzes and assign them to your enrolled courses, they will appear here automatically!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Artifacts list */}
        {activeTab === "artifacts" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {artifacts.map((art) => {
              return (
                <div
                  key={art.id}
                  className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-gray-200 transition-all group min-h-[220px]"
                >
                  <div className="space-y-4">
                    {/* Header elements */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2.5 bg-gray-50 rounded-xl shrink-0">
                        {getFileIcon(art.type)}
                      </div>
                      <span className="text-[9px] font-bold text-gray-400 bg-gray-50 border border-gray-100 rounded-md px-2 py-0.5 uppercase tracking-wider block">
                        {art.courseName}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-gray-900 leading-snug text-base group-hover:text-brand-primary transition-colors truncate" title={art.name}>
                        {art.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-gray-400 font-bold uppercase tracking-wider mt-1.5">
                        <span>{art.size}</span>
                        <span>•</span>
                        <span>{art.downloadsCount || 0} Downloads</span>
                      </div>
                    </div>

                    {art.description && (
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 bg-gray-50 p-3 rounded-2xl border border-gray-50">
                        {art.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-gray-50 mt-4">
                    <Button
                      onClick={() => handleDownloadArtifact(art)}
                      className="w-full"
                    >
                      <Image src={ICONS.MATERIALLIGHT} width={16} height={16} alt="Download" />
                      Download Resource
                    </Button>
                  </div>
                </div>
              );
            })}

            {artifacts.length === 0 && (
              <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center px-4 max-w-lg mx-auto">
                <div className="w-16 h-16 bg-blue-50 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-4\">
                  <DownloadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">No Study Materials Found</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
                  Boilerplate templates, exercises, and study cheatsheets assigned to your enrolled courses will be listed here.
                </p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* --- INTERACTIVE PRACTICE QUIZ MODAL --- */}
      {showQuizModal && activeQuiz && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col border border-gray-100">
            
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-brand-primary flex items-center justify-center">
                  <HelpCircle size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Practice Mode</span>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">
                    {activeQuiz.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowQuizModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-white">
              
              {/* STEP 1: INTRO */}
              {quizStep === "intro" && (
                <div className="text-center py-6 max-w-md mx-auto space-y-6">
                      <div className="w-20 h-20 bg-blue-50 text-brand-primary rounded-full flex items-center justify-center mx-auto border border-blue-100\">
                    <Award size={40} className="stroke-1" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">Ready to test your skills?</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      You are about to start <span className="font-bold text-brand-alt">{activeQuiz.title}</span>. Answer each question carefully. You can review your performance at the end.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Questions</span>
                      <span className="text-lg font-bold text-gray-900">{activeQuiz.questions.length} Items</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Passing Grade</span>
                      <span className="text-lg font-bold text-emerald-600">{activeQuiz.passingScore}% Score</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => setQuizStep("questions")}
                    className={`w-full py-4.5 rounded-full text-white shadow-md hover:shadow-lg transition-all ${TYPOGRAPHY_CLASSES.PRIMARY_BUTTON}`}>
                    Start Practice Quiz
                  </Button>
                </div>
              )}

              {/* STEP 2: QUESTIONS */}
              {quizStep === "questions" && activeQuiz.questions[currentQuestionIndex] && (
                <div className="space-y-6">
                  {/* Progress Header */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                      <span>Question {currentQuestionIndex + 1} of {activeQuiz.questions.length}</span>
                      <span className="text-brand-primary">{Math.round(((currentQuestionIndex + 1) / activeQuiz.questions.length) * 100)}% Complete</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-brand-primary to-brand-success transition-all duration-300"
                        style={{ width: `${((currentQuestionIndex + 1) / activeQuiz.questions.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="p-4 sm:p-6 bg-blue-50/30 rounded-2xl border border-blue-50/50">
                    <h4 className="text-base font-bold text-gray-900 leading-relaxed">
                      {activeQuiz.questions[currentQuestionIndex].text}
                    </h4>
                  </div>

                  {/* Options List */}
                  <div className="space-y-3">
                    {activeQuiz.questions[currentQuestionIndex].options.map((option: string, oIdx: number) => {
                      const isSelected = selectedAnswer === oIdx;
                      const isCorrectAnswer = oIdx === activeQuiz.questions[currentQuestionIndex].correctAnswer;
                      
                      let optionStyle = "border-gray-200 bg-white text-gray-800 hover:border-brand-primary/50 hover:bg-gray-50/30";
                      
                      if (isAnswerSubmitted) {
                        if (isCorrectAnswer) {
                          optionStyle = "border-emerald-200 bg-emerald-50 text-emerald-800 font-bold";
                        } else if (isSelected) {
                          optionStyle = "border-red-200 bg-red-50 text-red-800 font-bold";
                        } else {
                          optionStyle = "border-gray-100 bg-gray-50/30 text-gray-500 opacity-80";
                        }
                      } else if (isSelected) {
                        optionStyle = "border-brand-primary bg-blue-50/50 text-brand-primary font-bold ring-2 ring-brand-primary/10";
                      }

                      return (
                        <button
                          key={oIdx}
                          onClick={() => handleAnswerSelect(oIdx)}
                          disabled={isAnswerSubmitted}
                          className={`w-full text-left p-4 rounded-2xl border transition-all text-sm flex items-start justify-between gap-3 ${optionStyle}`}
                        >
                          <span className="flex items-start gap-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isSelected ? "bg-brand-primary text-white" : "bg-gray-100 text-gray-500"
                            }`}>
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span className="mt-0.5 leading-snug text-inherit">{option}</span>
                          </span>
                          
                          {isAnswerSubmitted && isCorrectAnswer && (
                            <Check size={16} className="text-emerald-600 shrink-0 mt-1" />
                          )}
                          {isAnswerSubmitted && isSelected && !isCorrectAnswer && (
                            <XIcon size={16} className="text-red-600 shrink-0 mt-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 flex justify-end">
                    {!isAnswerSubmitted ? (
                      <Button
                        onClick={handleVerifyAnswer}
                        disabled={selectedAnswer === null}
                        className={`w-full px-6 py-5 rounded-full text-white text-xs uppercase tracking-wider disabled:opacity-50 sm:w-auto sm:px-8 ${TYPOGRAPHY_CLASSES.PRIMARY_BUTTON}`}
                      >
                        Verify Answer
                      </Button>
                    ) : (
                      currentQuestionIndex < activeQuiz.questions.length - 1 ? (
                        <Button
                          onClick={handleNextQuestion}
                          className={`w-full px-6 py-5 rounded-full text-white text-xs uppercase tracking-wider sm:w-auto sm:px-8 ${TYPOGRAPHY_CLASSES.PRIMARY_BUTTON}`}
                        >
                          Next Question
                        </Button>
                      ) : (
                        <Button
                          onClick={handleViewResults}
                          className="px-8 py-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider"
                        >
                          View Results
                        </Button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: RESULTS */}
              {quizStep === "results" && (
                <div className="space-y-6">
                  {/* Results Header */}
                  {(() => {
                    const totalQuestions = activeQuiz.questions.length;
                    const scorePercentage = Math.round((quizScore / totalQuestions) * 100);
                    const isPassed = scorePercentage >= activeQuiz.passingScore;
                    
                    return (
                      <div className="text-center py-4 space-y-4">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto border-[4px] ${
                          isPassed 
                            ? "bg-emerald-50 border-emerald-500 text-emerald-600" 
                            : "bg-red-50 border-red-500 text-red-500"
                        }`}>
                          <Award size={40} className="stroke-1" />
                        </div>
                        
                        <div>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                            isPassed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          }`}>
                            {isPassed ? "Passed! 🎉" : "Needs Review"}
                          </span>
                          <h4 className="text-2xl font-bold text-gray-900 mt-2">
                            {scorePercentage}% Final Score
                          </h4>
                          <p className="text-gray-500 text-sm mt-1">
                            You answered {quizScore} of {totalQuestions} questions correctly.
                          </p>
                        </div>

                        {/* Try Again / Close */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2 max-w-sm mx-auto">
                          <Button
                            onClick={handleRestartQuiz}
                            variant="outline"
                            className="w-full sm:flex-1 py-5 rounded-full border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold flex items-center justify-center gap-2"
                          >
                            <RefreshCw size={14} /> Practice Again
                          </Button>
                          <Button
                            onClick={() => setShowQuizModal(false)}
                            className={`w-full sm:flex-1 py-5 rounded-full text-white text-xs ${TYPOGRAPHY_CLASSES.PRIMARY_BUTTON}`}
                          >
                            Close Quiz
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Review Detail Header */}
                  <div className="border-t border-gray-100 pt-6">
                    <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Question Review</h5>
                    <div className="space-y-4 max-h-[30vh] overflow-y-auto pr-2">
                      {activeQuiz.questions.map((q: any, qIdx: number) => {
                        const chosenAnswer = userAnswers[qIdx];
                        const isCorrect = chosenAnswer === q.correctAnswer;
                        
                        return (
                          <div 
                            key={qIdx}
                            className={`p-4 rounded-xl border text-sm space-y-2 ${
                              isCorrect ? "border-emerald-100 bg-emerald-50/10" : "border-red-100 bg-red-50/10"
                            }`}
                          >
                            <div className="flex items-start gap-2 justify-between">
                              <span className="font-bold text-gray-900">
                                {qIdx + 1}. {q.text}
                              </span>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                              }`}>
                                {isCorrect ? "Correct" : "Incorrect"}
                              </span>
                            </div>
                            
                            <div className="text-xs space-y-1">
                              <p className="text-gray-500">
                                <span className="font-bold text-gray-600">Your Answer:</span>{" "}
                                {chosenAnswer !== undefined ? q.options[chosenAnswer] : "No Answer Selected"}
                              </p>
                              {!isCorrect && (
                                <p className="text-emerald-700">
                                  <span className="font-bold">Correct Answer:</span> {q.options[q.correctAnswer]}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
