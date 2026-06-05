"use client";

import { useEffect, useMemo, useState } from "react";
import { useLoading } from "@/app/context/LoadingContext";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import { BookOpen, CheckCircle2, FolderOpen, Users } from "lucide-react";
import { getCourseProgress } from "@/app/actions/get-course-progress";
import CourseCard from "@/app/components/course/CourseCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"; // <-- Update path to match your folder structure

type Profile = {
  full_name?: string | null;
  role?: string | null;
};

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60";

type Enrollment = {
  batchId: number | string;
  batchName: string;
  startDate: string | null;
  courseId: number | string | null;
  courseTitle: string;
};

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string;
  event_type: "video" | "course" | "session" | "webinar";
};
interface Insight {
  id: number;
  content: string;
  author: string;
}


export default function Dashboard() {
  const normalizeProgressId = (value: unknown) =>
    String(value ?? "").trim().replaceAll("-", "").toLowerCase();

  const resolveModuleCompletion = (modules: any[] = [], progressRows: any[] = []) => {
    const completionByModuleId = new Map<string, { completed: boolean; progressPercentage: number }>();
    const updatedAtByModuleId = new Map<string, string>();

    for (const progress of progressRows) {
      const normalizedProgressId = normalizeProgressId(progress.video_id);
      if (!normalizedProgressId) continue;

      const matchedModule = modules.find((module: any) => {
        return (
          normalizeProgressId(module.id) === normalizedProgressId ||
          normalizeProgressId(module.video_cf_id) === normalizedProgressId
        );
      });

      if (!matchedModule) continue;

      const moduleId = String(matchedModule.id);
      const updatedAt = String(progress.updated_at || "");
      const previousUpdatedAt = updatedAtByModuleId.get(moduleId);

      if (!previousUpdatedAt || updatedAt >= previousUpdatedAt) {
        completionByModuleId.set(moduleId, {
          completed: Boolean(progress.completed),
          progressPercentage: Number(progress.progress_percentage || 0)
        });
        updatedAtByModuleId.set(moduleId, updatedAt);
      }
    }

    return completionByModuleId;
  };

  const router = useRouter();
  const { setLoading: setGlobalLoading } = useLoading();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setGlobalLoading(loading);
    return () => setGlobalLoading(false);
  }, [loading, setGlobalLoading]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [courseProgress, setCourseProgress] = useState<Record<string, { progressPercentage: number; completedModules: number; totalModules: number }>>({});
  const [nextCourse, setNextCourse] = useState<any>(null);
  const [nextModule, setNextModule] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);

  const [userId, setUserId] = useState<string | null>(null);
  const [userProfileName, setUserProfileName] = useState<string>("Learner");
  // Insight states
  const [insights, setInsights] = useState<Insight[]>([]);
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);
  const [totalTime, setTotalTime] = useState<string>("00:00:00");
  const [allCourseModules, setAllCourseModules] = useState<any[]>([]);

  //for progress
  const [completedVideoIds, setCompletedVideoIds] = useState<string[]>([]);


  const loadDashboardData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user ?? null;
    if (!user) {
      router.replace("/login");
      return;
    }

    setUserEmail(user.email ?? null);
    setUserId(user.id);

    const { data: fetchedProfile } = await supabase
      .from("profiles")
      .select("full_name,role")
      .eq("id", user.id)
      .single();

    const today = new Date().toISOString().split("T")[0];
    const { data: calendarRows } = await supabase
      .from("calendar_events")
      .select("id,title,description,event_date,event_time,event_type")
      .eq("user_id", user.id)
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true })
      .limit(5);

    setUpcomingEvents((calendarRows ?? []) as CalendarEvent[]);

    if (session?.access_token) {
      const enrollmentsResponse = await fetch("/api/enrollments", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      // fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_insight_index, full_name")
        .eq("id", session.user.id)
        .single();

      setCurrentInsightIndex(profile?.current_insight_index || 0);
      setUserProfileName(profile?.full_name || session.user.email?.split("@")[0] || "Learner");
      //Fetch Scholarly insights
      const { data: insightsData } = await supabase
        .from("scholarly_insights")
        .select("*")
        .order("id", { ascending: true });

      if (insightsData) setInsights(insightsData);

      const enrollmentsResult = await enrollmentsResponse
        .json()
        .catch(() => null);

      if (
        enrollmentsResponse.ok &&
        Array.isArray(enrollmentsResult?.enrollments)
      ) {
        setEnrollments(enrollmentsResult.enrollments as Enrollment[]);
      }
    }

    setProfile((fetchedProfile ?? null) as Profile | null);

    // Fetch enrolled courses
    const { data: enrollmentsData } = await supabase
      .from("course_enrollments")
      .select(
        `
        course_id,
        enrolled_at,
        maincourses (
          id,
          title,
          description,
          category,
          thumbnail_url
        )
      `,
      )
      .eq("user_id", user.id)
      .order("enrolled_at", { ascending: false });

    if (enrollmentsData && enrollmentsData.length > 0) {
      const validEnrollments = enrollmentsData.filter(
        (e: any) => e.maincourses,
      );
      const mappedCourses = validEnrollments.map((e: any) => e.maincourses);
      setEnrolledCourses(mappedCourses);

      // Fetch progress for each enrolled course
      if (user.id && mappedCourses.length > 0) {
        const progressMap: Record<string, { progressPercentage: number; completedModules: number; totalModules: number }> = {};

        for (const course of mappedCourses) {
          try {
            const progress = await getCourseProgress(user.id, course.id);
            progressMap[String(course.id)] = progress;
          } catch (error) {
            console.error(`Error fetching progress for course ${course.id}:`, error);
            progressMap[String(course.id)] = { progressPercentage: 0, completedModules: 0, totalModules: 0 };
          }
        }

        setCourseProgress(progressMap);
      }

      if (mappedCourses.length > 0) {
        const mostRecentCourse = mappedCourses[0];
        setNextCourse(mostRecentCourse);

        // Fetch ALL modules from ALL enrolled courses (for learning progress)
        let allModules: any[] = [];
        let allCompletedVideoIds: string[] = [];

        for (const course of mappedCourses) {
          const { data: courseModules } = await supabase
            .from("coursemodules")
            .select("*")
            .eq("maincourse_id", course.id)
            .order("order_index", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true });

          if (courseModules && courseModules.length > 0) {
            allModules = [...allModules, ...courseModules];

            // Fetch user_video_progress for this course
            const { data: progressData } = await supabase
              .from("user_video_progress")
              .select("video_id, completed, updated_at, progress_percentage")
              .eq("user_id", user.id)
              .eq("course_id", course.id);

            const moduleCompletion = resolveModuleCompletion(
              courseModules,
              progressData ?? [],
            );

            const completedIds = courseModules
              .filter((module: any) => moduleCompletion.get(String(module.id))?.completed)
              .map((module: any) => String(module.id));

            allCompletedVideoIds = [...allCompletedVideoIds, ...completedIds];
          }
        }

        setAllCourseModules(allModules);
        setCompletedVideoIds(allCompletedVideoIds);

        // Fetch modules for the most recent course separately for "next module" display
        const { data: mostRecentModules } = await supabase
          .from("coursemodules")
          .select("*")
          .eq("maincourse_id", mostRecentCourse.id)
          .order("order_index", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });

        if (mostRecentModules && mostRecentModules.length > 0) {
          // Fetch user_video_progress for most recent course to find next uncompleted module
          const { data: progressData } = await supabase
            .from("user_video_progress")
            .select("video_id, completed, updated_at, progress_percentage")
            .eq("user_id", user.id)
            .eq("course_id", mostRecentCourse.id);

          const moduleCompletion = resolveModuleCompletion(
            mostRecentModules,
            progressData ?? [],
          );

          // Find the first incomplete module as the "next" module
          const firstIncomplete = mostRecentModules.find(
            (m: any) => !moduleCompletion.get(String(m.id))?.completed
          );
          if (firstIncomplete) {
            setNextModule(firstIncomplete);
          } else {
            // Show only unfinished course modules only
            setNextModule(null);
          }

          // Calculate remaining time: sum remaining durations of all incomplete modules only
          let remainingSeconds = 0;
          for (const mod of mostRecentModules) {
            const progressInfo = moduleCompletion.get(String(mod.id));
            const isCompleted = progressInfo?.completed;
            const progressPercentage = progressInfo?.progressPercentage || 0;
            
            if (!isCompleted && mod.duration) {
              const durationStr = String(mod.duration).toLowerCase().trim();
              let durationSec = 0;
              
              if (durationStr.includes('h') || durationStr.includes('m') || durationStr.includes('s')) {
                const hMatch = durationStr.match(/(\d+)\s*h/);
                const mMatch = durationStr.match(/(\d+)\s*m/);
                const sMatch = durationStr.match(/(\d+)\s*s/);
                durationSec += hMatch ? parseInt(hMatch[1]) * 3600 : 0;
                durationSec += mMatch ? parseInt(mMatch[1]) * 60 : 0;
                durationSec += sMatch ? parseInt(sMatch[1]) : 0;
              } else {
                const parts = durationStr.replace(/[;.]/g, ":").split(":").map(Number);
                if (parts.length === 3) durationSec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
                else if (parts.length === 2) durationSec = (parts[0] || 0) * 60 + (parts[1] || 0);
                else if (parts.length === 1 && !isNaN(parts[0])) durationSec = parts[0] || 0;
              }
              
              const watchedSec = Math.floor(durationSec * (progressPercentage / 100));
              remainingSeconds += Math.max(0, durationSec - watchedSec);
            }
          }

          const hrs = String(Math.floor(remainingSeconds / 3600)).padStart(2, "0");
          const mins = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, "0");
          const secs = String(remainingSeconds % 60).padStart(2, "0");
          setTotalTime(`${hrs}:${mins}:${secs}`);
        }
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadDashboardData();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace("/login");
        }
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]);

  // Real-time listener for progress updates
  useEffect(() => {
    if (!userId) return;

    const subscription = supabase
      .channel(`user_video_progress:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_video_progress',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          // Re-load all dashboard data when any progress change occurs
          await loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const userName = useMemo(() => {
    return (
      profile?.full_name ||
      (userEmail ? userEmail.split("@")[0] : null) ||
      "Learner"
    );
  }, [profile?.full_name, userEmail]);



  const hasEnrollments = enrolledCourses.length > 0;
  const currentInsight = insights[currentInsightIndex] || {
    id: 0,
    content: "Cultivating new insights...",
    author: "",
  };

  const formatEventLabel = (eventDate: string, eventTime: string) => {
    const start = new Date(`${eventDate}T${eventTime}`);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeLabel = start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    if (start.toDateString() === now.toDateString())
      return `Today, ${timeLabel}`;
    if (start.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow, ${timeLabel}`;
    }
    return `${start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}, ${timeLabel}`;
  };

  const handlePlayModule = () => {
    if (nextCourse && nextModule) {
      router.push(`/courses/${nextCourse.id}?module=${nextModule.id}`);
    }
  };
  // async function for handling insights
  const handleMarkInsightAsRead = async () => {
    if (!userId || insights.length === 0) return;
    const nextIndex = (currentInsightIndex + 1) % insights.length;
    setCurrentInsightIndex(nextIndex);
    await supabase
      .from("profiles")
      .update({ current_insight_index: nextIndex })
      .eq("id", userId);
  };

  const handleOpenCourse = (courseId: number | string) => {
    router.push(`/courses/${courseId}`);
  };
  const totalModules = allCourseModules.length;

  const completedModules = allCourseModules.filter((module: any) => {
    return completedVideoIds.includes(String(module.id));
  }).length;

  const progressPercentage =
    totalModules > 0
      ? Math.round(
        (completedModules / totalModules) * 100
      )
      : 0;


  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Banner - Dark Blue */}
        <div className="bg-gradient-to-r from-brand-heading to-brand-primary rounded-2xl p-6 sm:p-12 text-white mb-10 shadow-sm min-h-[200px] sm:min-h-[260px]">
          <h1 className="text-4xl md:text-[44px] font-bold text-white mb-4 tracking-tight leading-tight">
            Welcome back to The Automate, {userName}.
          </h1>
          <p className="text-blue-200 text-base mb-6 max-w-2xl">
            {hasEnrollments
              ? "Your intellectual journey continues. You have modules to complete this week to stay on track for your fellowship."
              : "Welcome to your dashboard. Your curriculum allocations will appear here once assigned by your administrator."}
          </p>
          {hasEnrollments && (
            <div className="flex gap-3">
              <button
                onClick={handlePlayModule}
                className="bg-white text-brand-heading px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors"
              >
                Resume Last Lesson
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>

       
        {/* Upcoming Webinars Widget */}
    {/* --- Side-by-Side Layout: Webinars & Batch Allocations --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10 items-stretch">
          
          {/* 1. Upcoming Webinars Widget */}
          <div className="bg-surface-accent rounded-2xl p-6 md:p-7 border border-brand-primary/20 shadow-sm relative overflow-hidden transition-all hover:shadow-md flex flex-col h-full">

            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-xs font-bold text-brand-primary uppercase tracking-[0.2em]">
                Live Sessions
              </span>
              <span className="text-[10px] font-bold px-3 py-1.5 bg-white text-brand-primary rounded-md border border-brand-primary/20">
                {upcomingEvents.length} UPCOMING
              </span>
            </div>

            <h2 className={`${TYPOGRAPHY_CLASSES.SUBHEADING} mb-1 relative z-10`}>
              Upcoming Webinars
            </h2>
            <p className="text-sm text-gray-600 mb-5 relative z-10">
              Exclusive live knowledge sessions from your curators.
            </p>

            <div className="flex-1 flex flex-col">
              {upcomingEvents.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-xl p-8 text-center shadow-sm relative z-10 h-full flex flex-col items-center justify-center">
                  <div className="w-14 h-14 bg-surface-subtle rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                    <svg className="w-8 h-8 text-brand-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-700 font-medium">No live sessions scheduled yet.</p>
                  <p className="text-xs text-gray-500 mt-1">Check back later or visit your calendar.</p>
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-hide relative z-10">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="min-w-[270px] sm:min-w-[300px] bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all duration-300 relative group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-12 h-12 bg-surface-subtle rounded-xl flex items-center justify-center shrink-0 border border-brand-primary/10 group-hover:scale-105 transition-transform duration-300">
                          <svg
                            className="w-7 h-7 text-brand-primary"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary/60 bg-surface-accent px-2 py-1 rounded-md">
                          {event.event_type}
                        </span>
                      </div>

                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand-primary transition-colors mb-2">
                          {event.title}
                        </h3>
                        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                          {event.description?.trim() || "Deep dive into advanced concepts with our industry experts."}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-brand-primary/10 flex items-center justify-between mt-auto">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Commences at</p>
                          <p className="text-xs font-black text-brand-primary">
                            {formatEventLabel(event.event_date, event.event_time)}
                          </p>
                        </div>
                        <button className={`w-9 h-9 rounded-lg flex items-center text-white hover:scale-105 transition-all ${TYPOGRAPHY_CLASSES.PRIMARY_BUTTON}`}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Enrollment Summary / Batch Allocations Widget */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-7 shadow-sm flex flex-col h-full">
            
            <div className="flex items-center justify-between mb-6 pb-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center">
                  <Users size={20} className="text-brand-primary" />
                </div>
                <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
                  Batch Allocations
                </h2>
              </div>
              <span className="text-[10px] font-bold px-3 py-1.5 bg-surface-accent text-brand-primary rounded-md uppercase tracking-widest border border-brand-primary/10">
                {enrollments.length} Active
              </span>
            </div>
            
            <div className="flex-1 flex flex-col">
              {enrollments.length === 0 ? (
                <div className="h-full py-8 flex flex-col items-center justify-center text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
                    <FolderOpen className="text-gray-400 w-8 h-8" />
                  </div>
                  <p className="text-gray-800 font-semibold text-lg mb-1">No Active Cohorts</p>
                  <p className="text-gray-500 text-sm max-w-[200px]">
                    You haven't been allocated to any specific batches yet. 
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {enrollments.map((item) => (
                    <div
                      key={`${item.batchId}-${item.courseId}`}
                      className="bg-surface-subtle hover:bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-brand-primary/30 transition-all duration-300 group relative overflow-hidden flex flex-col cursor-default"
                    >
                      <div className="absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-br from-brand-primary/5 to-brand-success/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />

                      <div className="flex items-start gap-4 mb-4 relative z-10">
                        <div className="w-12 h-12 bg-gradient-to-br from-brand-primary to-brand-success rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shadow-brand-primary/20 group-hover:-translate-y-1 transition-transform duration-300 shrink-0">
                          {item.courseTitle.charAt(0)}
                        </div>
                        <div className="min-w-0 pt-1 flex-1">
                          <p className="text-sm font-bold text-gray-900 truncate group-hover:text-brand-primary transition-colors" title={item.courseTitle}>
                            {item.courseTitle}
                          </p>
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-white text-brand-primary text-[10px] font-bold uppercase tracking-widest mt-2 border border-brand-primary/20 shadow-sm truncate max-w-full" title={item.batchName}>
                            {item.batchName}
                          </span>
                        </div>
                      </div>

                      <div className="mt-auto pt-4 border-t border-gray-200/60 flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2.5">
                          <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </div>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Active Course & Progress — "Up Next" Section */}
        {hasEnrollments && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">

            {/* LEFT SIDE - UP NEXT */}
            <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 sm:p-7 shadow-sm">

              {/* Header row */}
              <div className="flex items-start justify-between mb-5">
                <span className="text-[10px] font-black text-white bg-brand-heading px-3 py-1.5 rounded-md uppercase tracking-widest">
                  Up Next
                </span>

                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Total Time
                  </p>

                  <p className="text-2xl sm:text-3xl font-black text-brand-primary tracking-tight font-mono">
                    {totalTime}
                  </p>
                </div>
              </div>

              {/* Course title */}
              <h2 className={`${TYPOGRAPHY_CLASSES.SUBHEADING} mb-6 max-w-xl`}>
                {nextCourse?.title || "Your next course"}
              </h2>

              {/* Module card */}
              {nextModule ? (
                <div
                  onClick={handlePlayModule}
                  className="bg-surface-subtle border border-gray-100 rounded-xl p-4 sm:p-5 flex items-center gap-4 sm:gap-5 hover:border-brand-primary/30 transition-all cursor-pointer group"
                >
                  {/* Instructor image */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#2a2a2a] rounded-xl flex items-center justify-center shrink-0 overflow-hidden border-2 border-gray-200 group-hover:border-brand-primary/30 transition-colors">
                    <img
                      src="/images/instructor.png"
                      alt="Instructor"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Module info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 group-hover:text-brand-primary transition-colors text-sm sm:text-base leading-snug">
                      {nextModule.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      Hosted by{" "}
                      <span className="font-semibold text-gray-700">
                        The Automate
                      </span>

                      {nextModule.duration && <> • {nextModule.duration}</>}
                    </p>

                    <div className="flex items-center gap-2 mt-2.5">
                      <div className="flex -space-x-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-white" />
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 border-2 border-white" />
                      </div>

                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">
                        +{Math.max(allCourseModules.length, 5)} Joining soon…
                      </span>
                    </div>
                  </div>

                  {/* Play button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayModule();
                    }}
                    className={`w-12 h-12 rounded-full flex items-center text-white shrink-0 hover:scale-110 transition-all shadow-lg shadow-brand-primary/20 ${TYPOGRAPHY_CLASSES.PRIMARY_BUTTON}`}
                  >
                    <svg
                      className="w-5 h-5 ml-0.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="bg-surface-subtle border border-gray-100 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                  <p className="text-sm font-semibold text-gray-500">
                    No modules available
                  </p>
                </div>
              )}
            </div>

           {/* RIGHT SIDE - LEARNING PROGRESS */}
            <div className="bg-surface-accent border border-brand-primary/20 rounded-2xl p-6 md:p-7 shadow-sm relative overflow-hidden transition-shadow hover:shadow-md flex flex-col h-full">

              <h2 className={`${TYPOGRAPHY_CLASSES.SUBHEADING} mb-7 relative z-10`}>
                Learning Progress
              </h2>

              {/* Circle */}
              <div className="flex justify-center relative z-10">
                <div className="relative w-44 h-44 rounded-full border-[4px] border-brand-primary flex items-center justify-center bg-white shadow-sm">
                  <div className="text-center">
                    <h1 className="text-5xl font-black text-brand-primary">
                      {progressPercentage}%
                    </h1>
                    <p className="text-xs tracking-[0.3em] text-brand-primary/70 mt-2 font-bold">
                      MASTERY
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats Wrapped in Glassmorphism */}
              <div className="mt-auto pt-8 relative z-10">
                <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4 shadow-sm">
                  
                  <div className="flex items-center justify-between border-b border-brand-primary/10 pb-4">
                    <span className="text-sm font-medium text-gray-600">
                      Modules Completed
                    </span>
                    <span className="text-lg font-bold text-brand-primary">
                      {completedModules}/{totalModules}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      Courses Assigned
                    </span>
                  <span className="text-lg font-bold text-brand-primary">
                      {enrolledCourses.length}
                    </span>
                  </div>
                  
                </div>
              </div>
              
            </div>
          </div>
        )}

{/* Active Studies Grid / Carousel */}
        <div className="mb-12 relative px-0 sm:px-4 md:px-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
              Active Studies
            </h2>
            <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.3em]">
              {enrolledCourses.length} Courses in Progress
            </span>
          </div>

          <Carousel
            opts={{
              align: "start",
              loop: false,
              dragFree: true, // Allows smooth swiping like native mobile apps
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-4 sm:-ml-6 pb-6">
              {enrolledCourses.map((course) => (
                <CarouselItem
  key={course.id}
  className="
    pl-4
    sm:pl-6
    basis-[85vw]
    sm:basis-1/2
    lg:basis-1/3
  "
>
  <CourseCard
    id={course.id}
    title={course.title}
    description={course.description}
    thumbnail={course.thumbnail_url}
    progressPercentage={
      courseProgress[String(course.id)]
        ?.progressPercentage || 0
    }
    showProgress
    variant="user"
    onClick={() => handleOpenCourse(course.id)}
  />
</CarouselItem>
              ))}
            </CarouselContent>

            {/* Navigation Arrows (Hidden on Mobile, Visible on Desktop) */}
            {enrolledCourses.length > 3 && (
              <>
                <CarouselPrevious className="hidden lg:flex -left-5 bg-white shadow-lg border border-gray-100 text-brand-primary hover:bg-gray-50 hover:text-brand-hover h-12 w-12 z-10" />
                <CarouselNext className="hidden lg:flex -right-5 bg-white shadow-lg border border-gray-100 text-brand-primary hover:bg-gray-50 hover:text-brand-hover h-12 w-12 z-10" />
              </>
            )}
          </Carousel>
        </div>

        <section className="bg-gradient-to-r from-surface-accent-start to-surface-accent-end border-l-[6px] border-brand-primary p-7 rounded-r-2xl shadow-sm relative">
          <div className="absolute right-6 top-6 text-brand-primary/10">
            <BookOpen size={80} />
          </div>

          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-white" />
            </div>
            <h3 className="font-bold text-brand-heading text-base">
              The Automate Insight
            </h3>
          </div>

          <div className="mb-6 relative z-10">
            {insights.length > 0 ? (
              <>
                <p className="text-[15px] text-gray-700 leading-relaxed max-w-4xl">
                  &quot;{currentInsight.content}&quot;
                </p>
                {currentInsight.author && (
                  <p className="text-[11px] text-brand-hover font-bold mt-4 tracking-wider uppercase">
                    &mdash; {currentInsight.author}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Cultivating new insights...
              </p>
            )}
          </div>

          <div className="relative z-10 flex justify-end">
            <Button
              onClick={handleMarkInsightAsRead}
              disabled={insights.length === 0}
              className={`w-1/6 ${TYPOGRAPHY_CLASSES.PRIMARY_BUTTON}`}
            > Mark as Read
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
