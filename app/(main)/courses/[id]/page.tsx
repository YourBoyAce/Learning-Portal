"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { 
  PlayCircle, 
  CheckCircle2, 
  ChevronLeft, 
  Clock, 
  BookOpen, 
  Lock,
  Loader2,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Stream } from "@cloudflare/stream-react";

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
  const searchParams = useSearchParams();
  const initialModuleId = searchParams.get("module");

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [userProgress, setUserProgress] = useState<Record<number, boolean>>({});
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);

  useEffect(() => {
    if (id) {
      loadCourseData();
    }
  }, [id]);

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
        // Set initial module from query param or first module
        if (initialModuleId) {
          const mod = modulesData.find(m => m.id === parseInt(initialModuleId));
          setActiveModuleId(mod ? mod.id : modulesData[0].id);
        } else {
          setActiveModuleId(modulesData[0].id);
        }
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

  const handleMarkAsCompleted = async (moduleId: number) => {
    try {
      setIsUpdatingProgress(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_video_progress")
        .upsert({
          user_id: user.id,
          course_id: id as string,
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

      <main className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-64px)]">
        {/* Left: Video Player & Content */}
        <div className="lg:col-span-8 p-6 lg:p-10 lg:border-r border-gray-100 bg-white/30">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Video Player */}
            <div className="relative aspect-video bg-black rounded-[2rem] overflow-hidden shadow-2xl group border-[8px] border-white ring-1 ring-gray-100">
              {activeModule?.video_cf_id ? (
                <Stream
                  key={activeModuleId}
                  src={activeModule.video_cf_id.includes('watch.cloudflarestream.com') 
                    ? activeModule.video_cf_id.split('/').pop() || "" 
                    : activeModule.video_cf_id
                  }
                  className="w-full h-full"
                  controls
                  preload="auto"
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
        <div className="lg:col-span-4 bg-white lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] overflow-y-auto">
          <div className="p-6 border-b border-gray-50 bg-gray-50/30">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-[0.2em] mb-4">Curriculum Outline</h3>
            <div className="flex items-center justify-between text-xs text-gray-400 font-bold">
              <span className="flex items-center gap-1.5">
                <BookOpen size={14} /> {modules.length} Modules
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} /> 4h 32m Total
              </span>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
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
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                        <Clock size={10} /> 12:45
                      </span>
                      {!isCompleted && !isActive && index > 3 && ( // Sample lock logic
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1">
                          <Lock size={10} /> Locked
                        </span>
                      )}
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
          </div>
        </div>
      </main>
    </div>
  );
}
