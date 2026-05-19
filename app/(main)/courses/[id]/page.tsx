"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
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

interface Course {
  id: number;
  title: string;
  description: string;
  category: string;
  thumbnail_url: string;
}

interface Module {
  id: number;
  title: string;
  description: string;
  video_cf_id: string;
  duration: string;
  order_index: number;
}

interface Progress {
  module_id: number;
  completed: boolean;
}

export default function CoursePlayerPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [userProgress, setUserProgress] = useState<Record<number, boolean>>({});
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);

  // --- QUIZZES & ARTIFACTS INTEGRATION STATE ---
  const [activeTab, setActiveTab] = useState<"modules" | "quizzes" | "artifacts">("modules");
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
    // 1. Increment download count in local state
    setCourseArtifacts(prev =>
      prev.map(a => (a.id === art.id ? { ...a, downloadsCount: (a.downloadsCount || 0) + 1 } : a))
    );

    // 2. Increment download count in global localStorage
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

    // 3. Trigger mock file download in browser
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
    
    // Save best score
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

      // 1. Fetch Course Details
      const { data: courseData, error: courseError } = await supabase
        .from("maincourses")
        .select("*")
        .eq("id", id)
        .single();

      if (courseError || !courseData) throw courseError || new Error("Course not found");
      setCourse(courseData);

      // 2. Fetch Modules
      const { data: modulesData, error: modulesError } = await supabase
        .from("coursemodules")
        .select("*")
        .eq("maincourse_id", id)
        .order("id", { ascending: true }); // Fallback to ID if order_index doesn't exist

      if (modulesError) throw modulesError;
      setModules(modulesData || []);

      if (modulesData && modulesData.length > 0) {
        setActiveModuleId(modulesData[0].id);
      }

      // 3. Fetch User Progress
      const { data: progressData, error: progressError } = await supabase
        .from("user_video_progress")
        .select("video_id, completed")
        .eq("user_id", user.id)
        .eq("course_id", id);

      if (progressError) throw progressError;

      const progressMap: Record<number, boolean> = {};
      progressData?.forEach((p: any) => {
        progressMap[parseInt(p.video_id)] = p.completed;
      });
      setUserProgress(progressMap);

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

  const handleMarkAsCompleted = async (moduleId: number) => {
    try {
      setIsUpdatingProgress(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_video_progress")
        .upsert({
          user_id: user.id,
          course_id: parseInt(id as string),
          video_id: moduleId.toString(),
          completed: true,
          completed_at: new Date().toISOString(),
          progress_percentage: 100
        }, {
          onConflict: "user_id,course_id,video_id"
        });

      if (error) throw error;

      setUserProgress(prev => ({ ...prev, [moduleId]: true }));
    } catch (error) {
      console.error("Error updating progress:", error);
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  const progressPercentage = useMemo(() => {
    if (modules.length === 0) return 0;
    const completedCount = modules.filter(m => userProgress[m.id]).length;
    return Math.round((completedCount / modules.length) * 100);
  }, [modules, userProgress]);

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
      {/* Navigation Header */}
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
            <Button variant="outline" className="text-xs font-bold border-gray-200 rounded-full">
              Get Support
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-64px)]">
        {/* Left: Video Player & Content */}
        <div className="lg:col-span-9 p-6 lg:p-8 lg:border-r border-gray-100 bg-white/30">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Video Player */}
            <div className="relative aspect-video bg-black rounded-[2rem] overflow-hidden shadow-2xl group border-[8px] border-white ring-1 ring-gray-100">
              {videoEmbedUrl ? (
                <iframe
                  src={videoEmbedUrl}
                  className="w-full h-full"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10 bg-gradient-to-br from-gray-900 to-[#0f172a]">
                  <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 backdrop-blur-md border border-white/10">
                    <PlayCircle size={40} className="text-white opacity-80" strokeWidth={1} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{activeModule?.title || "Select a module"}</h3>
                  <p className="text-gray-400 text-sm max-w-sm">Instructional media for this module is being processed or will be available soon.</p>
                  
                  {/* Decorative elements */}
                  <div className="absolute top-10 left-10 w-32 h-32 bg-[#174778] rounded-full blur-[100px] opacity-20" />
                  <div className="absolute bottom-10 right-10 w-32 h-32 bg-purple-500 rounded-full blur-[100px] opacity-10" />
                </div>
              )}
            </div>

            {/* Content Info */}
            <div className="space-y-6">
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
                  <h2 className="text-3xl font-bold text-gray-900 tracking-tight leading-tight">
                    {activeModule?.title || "Module Selection"}
                  </h2>
                </div>
                
                <div className="flex items-center gap-3">
                  {!userProgress[activeModuleId || 0] && activeModuleId && (
                    <Button 
                      onClick={() => handleMarkAsCompleted(activeModuleId)}
                      disabled={isUpdatingProgress}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 py-5 shadow-sm text-xs font-bold tracking-wide"
                    >
                      {isUpdatingProgress ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} className="mr-2" />}
                      Mark as Completed
                    </Button>
                  )}
                </div>
              </div>

              <div className="prose prose-slate max-w-none">
                <p className="text-gray-600 leading-relaxed text-[17px]">
                  {activeModule?.description || "In this module, we will explore the foundational principles and practical applications related to this subject matter. Our goal is to achieve a deep understanding through structured media and instructional assets."}
                </p>
              </div>

              <div className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100 space-y-4">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen size={16} className="text-[#174778]" /> 
                  Instructional Context
                </h4>
                <p className="text-sm text-gray-500 leading-relaxed">
                  As you progress through this curated video curriculum, ensure you take notes on key conceptual shifts. The material presented here is part of the core intellectual framework of <span className="font-bold text-[#174778]">{course.title}</span>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Module Sidebar */}
        <div className="lg:col-span-3 bg-white lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] overflow-y-auto border-l border-gray-100 flex flex-col">
          {/* Sidebar Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50/50 shrink-0">
            <button
              onClick={() => setActiveTab("modules")}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "modules"
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
            {activeTab === "modules" && (
              <>
                <div className="p-6 border-b border-gray-50 bg-gray-50/10">
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
                      onClick={() => setActiveModuleId(mod.id)}
                      className={`w-full text-left p-5 transition-all flex items-start gap-4 group ${
                        isActive 
                          ? "bg-blue-50/50 border-r-4 border-[#174778]" 
                          : "hover:bg-gray-50"
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
            )}

            {activeTab === "quizzes" && (
              <>
                <div className="p-6 border-b border-gray-50 bg-gray-50/10">
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
                      className="p-5 hover:bg-gray-50/50 transition-all flex flex-col gap-4 border-b border-gray-100 group"
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
                          <span className={`text-xs font-bold flex items-center gap-1 ${
                            isPassed ? "text-emerald-600" : "text-amber-600"
                          }`}>
                            <Award size={12} />
                            {score}% ({isPassed ? "Passed" : "Needs Review"})
                          </span>
                        </div>
                      )}

                      <Button
                        onClick={() => handleStartQuiz(quiz)}
                        className={`w-full py-2 h-9 text-xs font-bold rounded-xl transition-all ${
                          isPassed
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100"
                            : "bg-[#174778] text-white hover:bg-[#113a63]"
                        }`}
                      >
                        {hasAttempted ? "Practice Again" : "Start Quiz"}
                      </Button>
                    </div>
                  );
                })}

                {courseQuizzes.length === 0 && (
                  <div className="p-10 text-center text-gray-400">
                    <HelpCircle size={32} className="mx-auto mb-4 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest mb-1">No quizzes available</p>
                    <p className="text-[11px] max-w-[200px] mx-auto leading-relaxed">Check back later or contact your instructor.</p>
                  </div>
                )}
              </>
            )}

            {activeTab === "artifacts" && (
              <>
                <div className="p-6 border-b border-gray-50 bg-gray-50/10">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Study Materials</h3>
                  <p className="text-[11px] text-gray-400">Download worksheets, boilerplate templates, and cheatsheets.</p>
                </div>

                {courseArtifacts.map((art) => {
                  const getFileIcon = (type: string) => {
                    switch (type) {
                      case "PDF": return <FileText className="w-5 h-5 text-red-500" />;
                      case "ZIP": return <FileArchive className="w-5 h-5 text-amber-500" />;
                      case "Code": return <FileCode className="w-5 h-5 text-blue-500" />;
                      case "Sheet": return <BarChart3 className="w-5 h-5 text-emerald-500" />;
                      default: return <FileText className="w-5 h-5 text-gray-500" />;
                    }
                  };

                  return (
                    <div
                      key={art.id}
                      className="p-5 hover:bg-gray-50/50 transition-all flex flex-col gap-4 border-b border-gray-100 group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gray-50 text-[#174778] group-hover:bg-[#174778] group-hover:text-white transition-all">
                          {getFileIcon(art.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 group-hover:text-[#174778] transition-colors leading-snug mb-1 truncate" title={art.name}>
                            {art.name}
                          </h4>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            <span>{art.size}</span>
                            <span>•</span>
                            <span>{art.downloadsCount || 0} Downloads</span>
                          </div>
                        </div>
                      </div>

                      {art.description && (
                        <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                          {art.description}
                        </p>
                      )}

                      <Button
                        onClick={() => handleDownloadArtifact(art)}
                        className="w-full py-2 h-9 text-xs font-bold rounded-xl bg-[#174778] text-white hover:bg-[#113a63] flex items-center justify-center gap-1.5"
                      >
                        <DownloadCloud size={14} /> Download Resource
                      </Button>
                    </div>
                  );
                })}

                {courseArtifacts.length === 0 && (
                  <div className="p-10 text-center text-gray-400">
                    <DownloadCloud size={32} className="mx-auto mb-4 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest mb-1">No artifacts available</p>
                    <p className="text-[11px] max-w-[200px] mx-auto leading-relaxed">No downloadable materials have been assigned to this course yet.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* --- INTERACTIVE PRACTICE QUIZ MODAL --- */}
      {showQuizModal && activeQuiz && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col border border-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-[#174778] flex items-center justify-center">
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
            <div className="p-8 overflow-y-auto flex-1 bg-white">
              
              {/* STEP 1: INTRO */}
              {quizStep === "intro" && (
                <div className="text-center py-6 max-w-md mx-auto space-y-6">
                  <div className="w-20 h-20 bg-blue-50 text-[#174778] rounded-full flex items-center justify-center mx-auto border border-blue-100">
                    <Award size={40} className="stroke-1" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">Ready to test your skills?</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      You are about to start <span className="font-bold text-[#174778]">{activeQuiz.title}</span>. Answer each question carefully. You can review your performance at the end.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-left">
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
                    className="w-full py-4.5 bg-[#174778] hover:bg-[#113a63] text-white rounded-full font-bold shadow-md hover:shadow-lg transition-all"
                  >
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
                      <span className="text-[#174778]">{Math.round(((currentQuestionIndex + 1) / activeQuiz.questions.length) * 100)}% Complete</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#174778] transition-all duration-300"
                        style={{ width: `${((currentQuestionIndex + 1) / activeQuiz.questions.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="p-6 bg-blue-50/30 rounded-2xl border border-blue-50/50">
                    <h4 className="text-base font-bold text-gray-900 leading-relaxed">
                      {activeQuiz.questions[currentQuestionIndex].text}
                    </h4>
                  </div>

                  {/* Options List */}
                  <div className="space-y-3">
                    {activeQuiz.questions[currentQuestionIndex].options.map((option: string, oIdx: number) => {
                      const isSelected = selectedAnswer === oIdx;
                      const isCorrectAnswer = oIdx === activeQuiz.questions[currentQuestionIndex].correctAnswer;
                      
                      let optionStyle = "border-gray-200 bg-white hover:border-[#174778]/50 hover:bg-gray-50/30";
                      
                      if (isAnswerSubmitted) {
                        if (isCorrectAnswer) {
                          optionStyle = "border-emerald-200 bg-emerald-50 text-emerald-800 font-bold";
                        } else if (isSelected) {
                          optionStyle = "border-red-200 bg-red-50 text-red-800 font-bold";
                        } else {
                          optionStyle = "border-gray-100 bg-gray-50/30 text-gray-400 opacity-60";
                        }
                      } else if (isSelected) {
                        optionStyle = "border-[#174778] bg-blue-50/50 text-[#174778] font-bold ring-2 ring-[#174778]/10";
                      }

                      return (
                        <button
                          key={oIdx}
                          onClick={() => handleAnswerSelect(oIdx)}
                          disabled={isAnswerSubmitted}
                          className={`w-full text-left p-4 rounded-2xl border transition-all text-sm flex items-center justify-between ${optionStyle}`}
                        >
                          <span className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isSelected ? "bg-[#174778] text-white" : "bg-gray-100 text-gray-500"
                            }`}>
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            {option}
                          </span>
                          
                          {isAnswerSubmitted && isCorrectAnswer && (
                            <Check size={16} className="text-emerald-600 shrink-0" />
                          )}
                          {isAnswerSubmitted && isSelected && !isCorrectAnswer && (
                            <XIcon size={16} className="text-red-600 shrink-0" />
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
                        className="px-8 py-5 rounded-full bg-[#174778] hover:bg-[#113a63] text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                      >
                        Verify Answer
                      </Button>
                    ) : (
                      currentQuestionIndex < activeQuiz.questions.length - 1 ? (
                        <Button
                          onClick={handleNextQuestion}
                          className="px-8 py-5 rounded-full bg-[#174778] hover:bg-[#113a63] text-white text-xs font-bold uppercase tracking-wider"
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
                        <div className="flex items-center justify-center gap-3 pt-2 max-w-sm mx-auto">
                          <Button
                            onClick={handleRestartQuiz}
                            variant="outline"
                            className="flex-1 py-5 rounded-full border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold flex items-center justify-center gap-2"
                          >
                            <RefreshCw size={14} /> Practice Again
                          </Button>
                          <Button
                            onClick={() => setShowQuizModal(false)}
                            className="flex-1 py-5 rounded-full bg-[#174778] hover:bg-[#113a63] text-white text-xs font-bold"
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
