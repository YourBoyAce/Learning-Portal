"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { upsertUserProgress } from "@/app/actions/user-progress";
import { generateCertificatePDF } from "@/app/lib/certificate";
import { 
  PlayCircle, 
  CheckCircle2, 
  ChevronLeft, 
  Clock, 
  BookOpen, 
  Lock,
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
  BarChart3,
  Layers,
  DownloadCloud
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// IMPORT OUR NEW VIDEO PLAYER
import CourseVideoPlayer from "./components/CourseVideoPlayer";

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
  duration: string;
  order_index: number;
}

export default function CoursePlayerPage() {
  const { id } = useParams();
  const router = useRouter();
  
  // Added userId to state so we can pass it down to the video player
  const [userId, setUserId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [userProgress, setUserProgress] = useState<Record<string, boolean>>({});
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [modulePlaybackFinished, setModulePlaybackFinished] = useState<Record<string, boolean>>({});
  const [completionAcknowledged, setCompletionAcknowledged] = useState<Record<string, boolean>>({});
  const [hasCertificate, setHasCertificate] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [studentName, setStudentName] = useState("Learner");
  const [isGeneratingCertificate, setIsGeneratingCertificate] = useState(false);

  // --- QUIZZES & ARTIFACTS INTEGRATION STATE ---
  const [activeTab, setActiveTab] = useState<"overview" | "modules" | "quizzes" | "artifacts">("modules");
  const [courseQuizzes, setCourseQuizzes] = useState<any[]>([]);
  const [courseArtifacts, setCourseArtifacts] = useState<any[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  
  // Interactive Quiz Player State
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizStep, setQuizStep] = useState<"intro" | "questions" | "results">("intro");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [bestScores, setBestScores] = useState<Record<string, number>>({});

  useEffect(() => {
    if (id) {
      loadCourseData();
    }
  }, [id]);

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
      
      // 2. Filter quizzes for this course
      const filteredQuizzes = allQuizzes.filter((q: any) => 
        q.status === "Active" &&
        (String(q.courseId) === String(id) || 
         q.courseName.toLowerCase() === course.title.toLowerCase())
      );
      setCourseQuizzes(filteredQuizzes);

      // 3. Fetch artifacts from localStorage
      const savedArtifacts = localStorage.getItem("automate_portal_artifacts");
      let allArtifacts = [];
      if (savedArtifacts) {
        try {
          allArtifacts = JSON.parse(savedArtifacts);
        } catch (e) {
          console.error("Failed to parse artifacts:", e);
        }
      }

      // 4. Filter artifacts for this course
      const filteredArtifacts = allArtifacts.filter((art: any) =>
        art.status === "Published" &&
        (String(art.courseId) === String(id) ||
         art.courseName.toLowerCase() === course.title.toLowerCase())
      );
      setCourseArtifacts(filteredArtifacts);

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

  const handleDownloadArtifact = (art: any) => {
    setCourseArtifacts(prev =>
      prev.map(a => (a.id === art.id ? { ...a, downloadsCount: (a.downloadsCount || 0) + 1 } : a))
    );

    const saved = localStorage.getItem("automate_portal_artifacts");
    if (saved) {
      try {
        const allArtifacts = JSON.parse(saved);
        const updated = allArtifacts.map((a: any) => 
          a.id === art.id ? { ...a, downloadsCount: (a.downloadsCount || 0) + 1 } : a
        );
        localStorage.setItem("automate_portal_artifacts", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
    }

    const element = document.createElement("a");
    const fileContent = `Course Artifact Resource: ${art.name}\nCourse: ${course?.title || "N/A"}\nDescription: ${art.description || "N/A"}\nSize: ${art.size}\n\nThis is a practice-ready exercise file prepared dynamically for your learning path!`;
    const file = new Blob([fileContent], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = art.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
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
    
    const currentBest = bestScores[activeQuiz.id] || 0;
    if (scorePercentage > currentBest) {
      const updatedBest = {
        ...bestScores,
        [activeQuiz.id]: scorePercentage
      };
      setBestScores(updatedBest);
      if (course) {
        localStorage.setItem(`best_scores_${course.id}`, JSON.stringify(updatedBest));
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
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      
      // Store user ID for the video player component
      setUserId(user.id);

      const { data: courseData, error: courseError } = await supabase
        .from("maincourses")
        .select("*")
        .eq("id", id)
        .single();

      if (courseError || !courseData) throw courseError || new Error("Course not found");
      setCourse(courseData);

      const { data: modulesData, error: modulesError } = await supabase
        .from("coursemodules")
        .select("*")
        .eq("maincourse_id", id)
        .order("id", { ascending: true }); 

      if (modulesError) throw modulesError;
      setModules(modulesData || []);

      if (modulesData && modulesData.length > 0) {
        setActiveModuleId(modulesData[0].id);
      }

      const { data: progressData, error: progressError } = await supabase
        .from("user_video_progress")
        .select("video_id, completed")
        .eq("user_id", user.id)
        .eq("course_id", id);

      if (progressError) throw progressError;

      const progressMap: Record<string, boolean> = {};
      progressData?.forEach((p: any) => {
        progressMap[p.video_id] = p.completed;
      });
      setUserProgress(progressMap);

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

  const activeModule = useMemo(() => 
    modules.find(m => m.id === activeModuleId) || null,
  [modules, activeModuleId]);

  const videoEmbedUrl = useMemo(() => {
    if (!activeModule?.video_cf_id) return null;
    const rawId = activeModule.video_cf_id.trim();
    if (!rawId) return null;
    
    if (rawId.startsWith("https://iframe.videodelivery.net/")) {
      return rawId;
    }
    
    const cleanId = rawId.split('?')[0].split('/').pop() || "";
    return `https://iframe.videodelivery.net/${cleanId}`;
  }, [activeModule]);

  // Updated to pass the required "100" progress percentage variable
  const handleMarkAsCompleted = (moduleId: string) => {
    setCompletionAcknowledged((prev) => ({ ...prev, [moduleId]: true }));
  };

  const isCurrentModuleComplete = activeModuleId ? !!userProgress[activeModuleId] : false;
  const isCurrentModulePlaybackFinished = activeModuleId ? !!modulePlaybackFinished[activeModuleId] : false;
  const isCurrentModuleAcknowledged = activeModuleId ? !!completionAcknowledged[activeModuleId] : false;

  const progressPercentage = useMemo(() => {
    if (modules.length === 0) return 0;
    const completedCount = modules.filter(m => userProgress[m.id]).length;
    return Math.round((completedCount / modules.length) * 100);
  }, [modules, userProgress]);

  useEffect(() => {
    if (progressPercentage === 100 && !hasCertificate && !loading) {
      setShowCertificateModal(true);
    }
  }, [progressPercentage, hasCertificate, loading]);

  const handleGenerateCertificate = async () => {
    try {
      setIsGeneratingCertificate(true);
      if (!userId) return;

      const { error } = await supabase
        .from("certificates")
        .insert({
          user_id: userId,
          course_id: id as string,
          certificate_url: "CLAIMED",
        });

      if (error && error.code !== "23505") {
        throw error;
      }

      setHasCertificate(true);
      await generateCertificatePDF(studentName, course?.title || "Course Completed");
      setShowCertificateModal(false);
    } catch (e) {
      console.error("Error generating certificate:", e);
    } finally {
      setIsGeneratingCertificate(false);
    }
  };

  const totalDuration = useMemo(() => {
    let totalSeconds = 0;
    modules.forEach(mod => {
      if (mod.duration) {
        const parts = mod.duration.split(":").map(Number);
        if (parts.length === 3) totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
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
              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-[#174778] text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                Module {modules.findIndex(m => m.id === activeModuleId) + 1}
              </span>
              {userProgress[activeModuleId || 0] && (
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider border border-emerald-100 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Completed
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-tight">
              {activeModule?.title || "Module Selection"}
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Kept as a fallback / visual acknowledgement badge! */}
            {activeModuleId && (
              <Button 
                onClick={() => handleMarkAsCompleted(activeModuleId)}
                disabled={!isCurrentModulePlaybackFinished || isCurrentModuleComplete}
                className={`rounded-full px-6 py-5 text-xs font-bold tracking-wide transition ${
                  isCurrentModuleComplete
                    ? "bg-emerald-600 text-white cursor-not-allowed"
                    : isCurrentModulePlaybackFinished
                    ? "bg-[#174778] hover:bg-[#113a63] text-white"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isCurrentModuleComplete
                  ? "Completed"
                  : isCurrentModuleAcknowledged
                  ? "Completed"
                  : "Mark as Completed"}
              </Button>
            )}
          </div>
        </div>

        <div className="prose prose-slate max-w-none">
          <p className="text-gray-600 leading-relaxed text-[15px] sm:text-[17px]">
            {activeModule?.description || "In this module, we will explore the foundational principles and practical applications related to this subject matter. Our goal is to achieve a deep understanding through structured media and instructional assets."}
          </p>
        </div>

        <div className="p-5 sm:p-8 bg-gray-50 rounded-xl sm:rounded-[2rem] border border-gray-100 space-y-4">
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={16} className="text-[#174778]" /> 
            Instructional Context
          </h4>
          <p className="text-sm text-gray-500 leading-relaxed">
            As you progress through this curated video curriculum, ensure you take notes on key conceptual shifts. The material presented here is part of the core intellectual framework of <span className="font-bold text-[#174778]">{course?.title}</span>.
          </p>
        </div>
      </div>
    );
  };

  const renderModulesList = () => {
    return (
      <>
        <div className="p-6 border-b border-gray-50 bg-gray-50/10 text-left">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Curriculum Outline</h3>
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold">
            <span className="flex items-center gap-1.5">
              <BookOpen size={14} /> {modules.length} Modules
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} /> {totalDuration || "—"}
            </span>
          </div>
        </div>

        {modules.map((mod, index) => {
          const isActive = mod.id === activeModuleId;
          const isCompleted = userProgress[mod.id];

          return (
            <button
              key={mod.id}
              onClick={() => {
                setActiveModuleId(mod.id);
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className={`w-full text-left p-5 transition-all flex items-start gap-4 group ${
                isActive ? "bg-blue-50/50 border-r-4 border-[#174778]" : "hover:bg-gray-50"
              }`}
            >
              <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                isCompleted
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : isActive
                  ? "bg-[#174778] border-[#174778] text-white"
                  : "bg-white border-gray-200 text-gray-400 group-hover:border-[#174778] group-hover:text-[#174778]"
              }`}>
                {isCompleted ? <CheckCircle2 size={14} /> : index + 1}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-bold mb-1 leading-snug transition-colors ${
                  isActive ? "text-[#174778]" : "text-gray-900 group-hover:text-[#174778]"
                }`}>
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
            </button>
          );
        })}

        {modules.length === 0 && (
          <div className="p-10 text-center text-gray-400">
            <Loader2 size={32} className="mx-auto mb-4 animate-spin opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">No modules available</p>
          </div>
        )}
      </>
    );
  };

  const renderQuizzesList = () => {
    return (
      <>
        <div className="p-6 border-b border-gray-50 bg-gray-50/10 text-left">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Practice Quizzes</h3>
          <p className="text-[11px] text-gray-400">Test your mastery of this course with curated interactive tests.</p>
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
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-blue-50 text-[#174778] group-hover:bg-[#174778] group-hover:text-white transition-all">
                  <HelpCircle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-gray-900 group-hover:text-[#174778] transition-colors leading-snug mb-1">
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
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Best Score</span>
                  <span className={`text-xs font-bold flex items-center gap-1 ${isPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isPassed ? <Award size={14} /> : <AlertCircle size={14} />}
                    {score}%
                  </span>
                </div>
              )}

              <Button 
                onClick={() => handleStartQuiz(quiz)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold shadow-none transition-all ${
                  hasAttempted 
                    ? "bg-white border-2 border-gray-100 text-gray-600 hover:border-[#174778] hover:text-[#174778]" 
                    : "bg-[#174778] text-white hover:bg-[#113a63]"
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
            <p className="text-xs font-bold uppercase tracking-widest">No Quizzes Available</p>
          </div>
        )}
      </>
    );
  };

  const renderArtifactsList = () => {
    return (
      <>
        <div className="p-6 border-b border-gray-50 bg-gray-50/10 text-left">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Learning Artifacts</h3>
          <p className="text-[11px] text-gray-400">Download supplementary materials, code snippets, and resources.</p>
        </div>

        {courseArtifacts.map((art) => (
          <div 
            key={art.id}
            className="p-5 hover:bg-gray-50/50 transition-all flex flex-col gap-4 border-b border-gray-100 group text-left"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-all">
                {art.type === 'Code Snippet' ? <FileCode size={16} /> : 
                 art.type === 'Presentation' ? <Layers size={16} /> : 
                 <FileArchive size={16} />}
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
            <p className="text-xs font-bold uppercase tracking-widest">No Artifacts Available</p>
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#174778] mx-auto mb-4" />
          <p className="text-gray-600 font-medium tracking-tight">Preparing your session...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="text-center bg-white p-10 rounded-3xl shadow-sm border border-gray-100 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Course Unavailable</h2>
          <p className="text-gray-500 mb-6">We couldn't find the course you're looking for. It may have been moved or removed.</p>
          <Button onClick={() => router.push("/courses")} className="bg-[#174778] hover:bg-[#113a63]">
            Return to Curriculum
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-gray-900">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push("/courses")}
              className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-400 hover:text-[#174778]"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="hidden sm:block">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Currently Studying</span>
              <h1 className="text-sm font-bold text-gray-900 truncate max-w-[300px]">{course.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Your Progress</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#174778] transition-all duration-700 ease-out" 
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-[#174778]">{progressPercentage}%</span>
              </div>
            </div>

            {progressPercentage === 100 && (
              <Button 
                onClick={handleGenerateCertificate}
                disabled={isGeneratingCertificate}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-amber-500/25 flex items-center gap-1.5 border border-amber-400/25 transition-all duration-300 hover:scale-105"
              >
                {isGeneratingCertificate ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <DownloadCloud size={13} />
                    Download Certificate
                  </>
                )}
              </Button>
            )}

            <Button variant="outline" className="text-xs font-bold border-gray-200 rounded-full">
              Get Support
            </Button>
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
                  userId={userId}
                  courseId={id as string}
                  moduleId={activeModule.id}
                  videoUrl={videoEmbedUrl}
                  onCompleted={() => {
                    setUserProgress((prev) => ({ ...prev, [activeModule.id]: true }));
                    setModulePlaybackFinished((prev) => ({ ...prev, [activeModule.id]: true }));
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10 bg-gradient-to-br from-gray-900 to-[#0f172a]">
                  <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 backdrop-blur-md border border-white/10">
                    <PlayCircle size={40} className="text-white opacity-80" strokeWidth={1} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{activeModule?.title || "Select a module"}</h3>
                  <p className="text-gray-400 text-sm max-w-sm">Instructional media for this module is being processed or will be available soon.</p>
                  
                  <div className="absolute top-10 left-10 w-32 h-32 bg-[#174778] rounded-full blur-[100px] opacity-20" />
                  <div className="absolute bottom-10 right-10 w-32 h-32 bg-purple-500 rounded-full blur-[100px] opacity-10" />
                </div>
              )}
            </div>

            {/* Mobile Tab Selector & Tab Content */}
            <div className="lg:hidden">
              <div className="flex border-b border-gray-100 bg-gray-50/50 rounded-xl overflow-hidden mb-6">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === "overview"
                      ? "border-[#174778] text-[#174778] bg-white"
                      : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                  }`}
                >
                  <BookOpen size={13} />
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("modules")}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === "modules"
                      ? "border-[#174778] text-[#174778] bg-white"
                      : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                  }`}
                >
                  <Clock size={13} />
                  Modules
                </button>
                <button
                  onClick={() => setActiveTab("quizzes")}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 relative ${
                    activeTab === "quizzes"
                      ? "border-[#174778] text-[#174778] bg-white"
                      : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                  }`}
                >
                  <HelpCircle size={13} />
                  Quizzes
                  {courseQuizzes.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2283FF]"></span>
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("artifacts")}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 relative ${
                    activeTab === "artifacts"
                      ? "border-[#174778] text-[#174778] bg-white"
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
                  <div className="p-5 sm:p-6">
                    {renderModuleOverview()}
                  </div>
                )}
                {activeTab === "modules" && renderModulesList()}
                {activeTab === "quizzes" && renderQuizzesList()}
                {activeTab === "artifacts" && renderArtifactsList()}
              </div>
            </div>

            {/* Desktop Overview Block */}
            <div className="hidden lg:block">
              {renderModuleOverview()}
            </div>
          </div>
        </div>

        {/* Right: Module Sidebar (Desktop Only) */}
        <div className="hidden lg:flex lg:col-span-3 bg-white lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] overflow-y-auto border-l border-gray-100 flex-col">
          <div className="flex border-b border-gray-100 bg-gray-50/50 shrink-0">
            <button
              onClick={() => setActiveTab("modules")}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                (activeTab === "modules" || activeTab === "overview")
                  ? "border-[#174778] text-[#174778] bg-white"
                  : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
              }`}
            >
              <BookOpen size={13} />
              Modules
            </button>
            <button
              onClick={() => setActiveTab("quizzes")}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 relative ${
                activeTab === "quizzes"
                  ? "border-[#174778] text-[#174778] bg-white"
                  : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
              }`}
            >
              <HelpCircle size={13} />
              Quizzes
              {courseQuizzes.length > 0 && (
                <span className="absolute top-2 right-2 flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2283FF]"></span>
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("artifacts")}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 relative ${
                activeTab === "artifacts"
                  ? "border-[#174778] text-[#174778] bg-white"
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
            {(activeTab === "modules" || activeTab === "overview") && renderModulesList()}
            {activeTab === "quizzes" && renderQuizzesList()}
            {activeTab === "artifacts" && renderArtifactsList()}
          </div>
        </div>
      </main>

      {/* QUIZ MODAL */}
      {showQuizModal && activeQuiz && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowQuizModal(false)} />
          
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="h-2 w-full bg-gray-100 relative">
              {quizStep === "questions" && (
                <div 
                  className="absolute top-0 left-0 h-full bg-[#174778] transition-all duration-500"
                  style={{ width: `${((currentQuestionIndex) / activeQuiz.questions.length) * 100}%` }}
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
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-[#174778]">
                    <HelpCircle size={40} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">{activeQuiz.title}</h2>
                  <p className="text-gray-500 mb-8 max-w-md mx-auto">{activeQuiz.description}</p>
                  
                  <div className="flex items-center justify-center gap-8 mb-10">
                    <div className="text-center">
                      <span className="block text-2xl font-bold text-[#174778]">{activeQuiz.questionsCount}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Questions</span>
                    </div>
                    <div className="w-px h-10 bg-gray-200"></div>
                    <div className="text-center">
                      <span className="block text-2xl font-bold text-[#174778]">{activeQuiz.passingScore}%</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">To Pass</span>
                    </div>
                  </div>

                  <Button 
                    onClick={() => setQuizStep("questions")}
                    className="w-full sm:w-auto px-10 py-6 rounded-full bg-[#174778] hover:bg-[#113a63] text-white font-bold tracking-wide shadow-lg shadow-blue-900/20"
                  >
                    Begin Assessment
                  </Button>
                </div>
              )}

              {quizStep === "questions" && activeQuiz.questions[currentQuestionIndex] && (
                <div className="py-4">
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Question {currentQuestionIndex + 1} of {activeQuiz.questions.length}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-[#174778] text-[10px] font-bold">
                      {activeQuiz.questions[currentQuestionIndex].type || "Multiple Choice"}
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mb-8">
                    {activeQuiz.questions[currentQuestionIndex].text}
                  </h3>

                  <div className="space-y-3">
                    {activeQuiz.questions[currentQuestionIndex].options.map((option: string, idx: number) => {
                      const isSelected = selectedAnswer === idx;
                      const isCorrectAnswer = activeQuiz.questions[currentQuestionIndex].correctAnswer === idx;
                      
                      let optionClass = "border-gray-200 hover:border-[#174778] hover:bg-blue-50/50";
                      
                      if (isAnswerSubmitted) {
                        if (isCorrectAnswer) {
                          optionClass = "border-emerald-500 bg-emerald-50 text-emerald-900";
                        } else if (isSelected && !isCorrectAnswer) {
                          optionClass = "border-red-500 bg-red-50 text-red-900";
                        } else {
                          optionClass = "border-gray-200 opacity-50";
                        }
                      } else if (isSelected) {
                        optionClass = "border-[#174778] bg-blue-50 ring-1 ring-[#174778]";
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => handleAnswerSelect(idx)}
                          disabled={isAnswerSubmitted}
                          className={`w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start gap-3 sm:gap-4 ${optionClass}`}
                        >
                          <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                            isAnswerSubmitted && isCorrectAnswer ? "bg-emerald-500 border-emerald-500 text-white" :
                            isAnswerSubmitted && isSelected && !isCorrectAnswer ? "bg-red-500 border-red-500 text-white" :
                            isSelected ? "border-[#174778] bg-[#174778] text-white" : "border-gray-300"
                          }`}>
                            {isAnswerSubmitted && isCorrectAnswer ? <Check size={14} /> :
                             isAnswerSubmitted && isSelected && !isCorrectAnswer ? <XIcon size={14} /> :
                             isSelected ? <div className="w-2 h-2 rounded-full bg-white" /> : null}
                          </div>
                          <span className="font-medium flex-1 text-sm sm:text-base">{option}</span>
                        </button>
                      );
                    })}
                  </div>

                  {isAnswerSubmitted && activeQuiz.questions[currentQuestionIndex].explanation && (
                    <div className="mt-6 p-5 rounded-2xl bg-gray-50 border border-gray-100 flex items-start gap-3">
                      <HelpCircle size={20} className="text-[#174778] shrink-0 mt-0.5" />
                      <div>
                        <span className="block text-xs font-bold text-gray-900 mb-1 uppercase tracking-wider">Explanation</span>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {activeQuiz.questions[currentQuestionIndex].explanation}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-10 flex justify-end">
                    {!isAnswerSubmitted ? (
                      <Button 
                        onClick={handleVerifyAnswer}
                        disabled={selectedAnswer === null}
                        className="px-8 py-6 rounded-xl bg-[#174778] hover:bg-[#113a63] text-white font-bold"
                      >
                        Submit Answer
                      </Button>
                    ) : currentQuestionIndex < activeQuiz.questions.length - 1 ? (
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
                    const scorePercentage = Math.round((quizScore / totalQuestions) * 100);
                    const isPassed = scorePercentage >= activeQuiz.passingScore;

                    return (
                      <>
                        <div className="relative inline-block mb-6">
                          <svg className="w-32 h-32 transform -rotate-90">
                            <circle className="text-gray-100" strokeWidth="8" stroke="currentColor" fill="transparent" r="58" cx="64" cy="64" />
                            <circle 
                              className={isPassed ? "text-emerald-500" : "text-amber-500"} 
                              strokeWidth="8" 
                              strokeDasharray={364.4} 
                              strokeDashoffset={364.4 - (364.4 * scorePercentage) / 100} 
                              strokeLinecap="round" 
                              stroke="currentColor" 
                              fill="transparent" 
                              r="58" cx="64" cy="64" 
                              style={{ transition: "stroke-dashoffset 1.5s ease-in-out" }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-gray-900">{scorePercentage}%</span>
                          </div>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          {isPassed ? "Assessment Passed!" : "Needs Improvement"}
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
                            className="w-full sm:w-auto px-8 py-6 rounded-xl bg-[#174778] hover:bg-[#113a63] text-white font-bold"
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

      {/* CERTIFICATE MODAL */}
      {showCertificateModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
          
          <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-8 flex flex-col items-center text-center transform animate-in zoom-in-95 duration-300">
            <div className="absolute -top-12 w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-xl shadow-amber-500/30 border-4 border-white">
              <Award size={40} className="text-white" />
            </div>

            <div className="mt-12 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Congratulations!</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                You have successfully completed 100% of the course material. Your certificate of completion is ready to be generated.
              </p>
            </div>

            <div className="w-full bg-gray-50 rounded-2xl p-4 mb-8 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Course</p>
              <p className="text-sm font-bold text-[#174778] max-w-sm mx-auto mt-2 leading-snug">
                {course?.title}
              </p>
            </div>

            <div className="w-full space-y-3 relative z-10">
              <Button
                onClick={handleGenerateCertificate}
                disabled={isGeneratingCertificate}
                className="w-full py-6 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold tracking-wide shadow-lg shadow-amber-500/25 border border-amber-400/25 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
              >
                {isGeneratingCertificate ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Generating Certificate...
                  </>
                ) : (
                  <>
                    <DownloadCloud size={20} />
                    Generate & Download Certificate
                  </>
                )}
              </Button>
              <button 
                onClick={() => setShowCertificateModal(false)}
                className="text-xs font-bold text-gray-400 hover:text-[#174778] transition-colors tracking-wider uppercase block mx-auto"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}