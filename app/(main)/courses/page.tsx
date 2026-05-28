"use client";

import { useEffect, useState } from "react";
import { useLoading } from "@/app/context/LoadingContext";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { getMyLearningData } from "@/app/actions/my-learning";
import { getCourseProgress } from "@/app/actions/get-course-progress";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import CourseCard from "@/app/components/course/CourseCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { BookOpen, PlayCircle, CheckCircle2, Award, ExternalLink, X } from "lucide-react";

// --- Types ---
interface Insight {
  id: number;
  content: string;
  author: string;
}

interface UserStats {
  liveSessions: number;
  pendingModules: number;
}

interface CurriculumCourse {
  id: number | string;
  title: string;
  description: string;
  module_label?: string;
  progress: number;
  thumbnail_url?: string;
  duration?: string;
  modules?: any[]; // Array of modules
  certificate_url?: string | null;
}

interface Webinar {
  id: number;
  title: string;
  subtitle: string;
  date: string;
  icon: string;
  status: string;
  linkText: string;
  attendees: number;
}

interface Enrollment {
  batchId: number | string;
  batchName: string;
  startDate: string | null;
  courseId: number | string | null;
  courseTitle: string;
  courseDescription: string;
}

interface UpcomingEventRow {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string;
  event_type: "video" | "course" | "session" | "webinar";
}

interface UpcomingWebinarCard {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  icon: string;
  status: "streaming" | "link";
  linkText?: string;
  attendees: number;
}

const normalizeId = (id: string | null | undefined) =>
  String(id || "").replace(/-/g, "").trim();

export default function MyLearningDashboard() {
  const { setLoading: setGlobalLoading } = useLoading();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setGlobalLoading(loading);
    return () => setGlobalLoading(false);
  }, [loading, setGlobalLoading]);
  const [userId, setUserId] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [upcomingWebinars, setUpcomingWebinars] = useState<
    UpcomingWebinarCard[]
  >([]);

  // Tab & Certificate states
  const [activeTab, setActiveTab] = useState<"in_progress" | "completed">("in_progress");
  const [selectedCertificateCourse, setSelectedCertificateCourse] = useState<CurriculumCourse | null>(null);
  const [userProfileName, setUserProfileName] = useState<string>("Learner");

  // Data States
  const [stats, setStats] = useState<UserStats>({
    liveSessions: 0,
    pendingModules: 0,
  });
  const [weeklyProgressPct, setWeeklyProgressPct] = useState(0);
  const [courseProgress, setCourseProgress] = useState<Record<string, { progressPercentage: number; completedModules: number; totalModules: number }>>({});

  const router = useRouter();

  // Insight States
  const [insights, setInsights] = useState<Insight[]>([]);
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);

  // Curriculum State
  const [curriculum, setCurriculum] = useState<CurriculumCourse[]>([]);

  const formatWebinarDate = (date: string, time: string) => {
    const dateObj = new Date(`${date}T${time}`);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeLabel = dateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    if (dateObj.toDateString() === now.toDateString()) {
      return `TODAY, ${timeLabel}`;
    }
    if (dateObj.toDateString() === tomorrow.toDateString()) {
      return `TOMORROW, ${timeLabel}`;
    }
    return `${dateObj
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase()}, ${timeLabel}`;
  };

async function loadDashboardData() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return;

    setUserId(session.user.id);

    // --------------------------------------------------
    // HELPER
    // --------------------------------------------------
    const normalizeId = (id: string | null | undefined) =>
      String(id || "")
        .replace(/-/g, "")
        .toLowerCase();

    // --------------------------------------------------
    // USER PROFILE
    // --------------------------------------------------
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_insight_index, full_name")
      .eq("id", session.user.id)
      .single();

    setCurrentInsightIndex(profile?.current_insight_index || 0);

    setUserProfileName(
      profile?.full_name ||
        session.user.email?.split("@")[0] ||
        "Learner"
    );

    // --------------------------------------------------
    // INSIGHTS
    // --------------------------------------------------
    const { data: insightsData } = await supabase
      .from("scholarly_insights")
      .select("*")
      .order("id", { ascending: true });

    if (insightsData) {
      setInsights(insightsData);
    }

    // --------------------------------------------------
    // WEBINARS
    // --------------------------------------------------
    const { data: webinarsData } = await supabase
      .from("webinars")
      .select("*")
      .order("created_at", { ascending: true });

    const mappedWebinars =
      webinarsData?.map((w: any) => ({
        id: w.id,
        title: w.title,
        subtitle: w.subtitle,
        date: w.event_date,
        icon: w.icon,
        status: w.status,
        linkText: w.link_text,
        attendees: w.attendees_count,
      })) || [];

    setUpcomingWebinars(mappedWebinars);

    setStats((prev) => ({
      ...prev,
      liveSessions: mappedWebinars.length,
    }));

    // --------------------------------------------------
    // FETCH ENROLLMENTS + COURSES + MODULES
    // --------------------------------------------------
    const { data: enrollmentsData } = await supabase
      .from("course_enrollments")
      .select(`
        course_id,
        maincourses (
          id,
          title,
          description,
          category,
          thumbnail_url,
          coursemodules (*)
        )
      `)
      .eq("user_id", session.user.id);

    // --------------------------------------------------
    // FETCH VIDEO PROGRESS
    // --------------------------------------------------
    const { data: progressData } = await supabase
      .from("user_video_progress")
      .select("course_id, video_id, completed")
      .eq("user_id", session.user.id);

    // --------------------------------------------------
    // FETCH CERTIFICATES
    // --------------------------------------------------
    const { data: certsData } = await supabase
      .from("certificates")
      .select("course_id, certificate_url")
      .eq("user_id", session.user.id);

    // --------------------------------------------------
    // NO COURSES
    // --------------------------------------------------
    if (!enrollmentsData || enrollmentsData.length === 0) {
      setCurriculum([]);
      setCourseProgress({});
      setWeeklyProgressPct(0);

      setStats((prev) => ({
        ...prev,
        pendingModules: 0,
      }));

      return;
    }

    // --------------------------------------------------
    // VALID ENROLLMENTS
    // --------------------------------------------------
    const validEnrollments = enrollmentsData.filter(
      (e: any) => e.maincourses
    );

    // --------------------------------------------------
    // BUILD CURRICULUM
    // --------------------------------------------------
    const progressMap: Record<
      string,
      {
        progressPercentage: number;
        completedModules: number;
        totalModules: number;
      }
    > = {};

    const mappedCurriculum = validEnrollments.map((e: any) => {
      const course = e.maincourses;

      const modules = (course.coursemodules || []).sort(
        (a: any, b: any) =>
          (a.order_index ?? 0) - (b.order_index ?? 0)
      );

      const totalModules = modules.length;

      // ------------------------------------------
      // COURSE PROGRESS ROWS
      // ------------------------------------------
      const courseProgressRows =
        progressData?.filter(
          (p: any) =>
            String(p.course_id) === String(course.id)
        ) || [];

      // ------------------------------------------
      // COMPLETED VIDEO IDS
      // ------------------------------------------
      const completedVideoSet = new Set(
        courseProgressRows
          .filter((p: any) => p.completed)
          .map((p: any) => normalizeId(p.video_id))
      );

      // ------------------------------------------
      // COMPLETED MODULES
      // ------------------------------------------
      const completedModules = modules.filter((m: any) => {
        const moduleId = normalizeId(m.id);
        const cloudflareId = normalizeId(m.video_cf_id);
        return (
          completedVideoSet.has(moduleId) ||
          completedVideoSet.has(cloudflareId)
        );
      }).length;

      // ------------------------------------------
      // PERCENTAGE
      // ------------------------------------------
      const progressPercentage =
        totalModules > 0
          ? Math.round(
              (completedModules / totalModules) * 100
            )
          : 0;

      // ------------------------------------------
      // STORE PROGRESS MAP
      // ------------------------------------------
      progressMap[String(course.id)] = {
        progressPercentage,
        completedModules,
        totalModules,
      };

      // ------------------------------------------
      // CERTIFICATE
      // ------------------------------------------
      const cert =
        certsData?.find(
          (c: any) =>
            String(c.course_id) === String(course.id)
        ) || null;

      // ------------------------------------------
      // RETURN COURSE
      // ------------------------------------------
      return {
        id: course.id,
        title: course.title,
        description:
          course.description ||
          "Course description unavailable.",

        module_label: course.category
          ? course.category.toUpperCase()
          : "GENERAL",

        thumbnail_url: course.thumbnail_url,

        progress: progressPercentage,

        modules,

        certificate_url:
          cert?.certificate_url || null,

        duration:
          progressPercentage === 0
            ? "Ready to begin"
            : progressPercentage === 100
            ? "Completed"
            : `${completedModules}/${totalModules} Modules`,
      };
    });

    // --------------------------------------------------
    // SET STATES
    // --------------------------------------------------
    setCurriculum(mappedCurriculum);

    setCourseProgress(progressMap);

    // --------------------------------------------------
    // OVERALL PROGRESS
    // --------------------------------------------------
    const avgProgress =
      mappedCurriculum.length > 0
        ? Math.round(
            mappedCurriculum.reduce(
              (sum, c) => sum + c.progress,
              0
            ) / mappedCurriculum.length
          )
        : 0;

    setWeeklyProgressPct(avgProgress);

    // --------------------------------------------------
    // PENDING MODULES
    // --------------------------------------------------
    const totalPendingModules = Object.values(
      progressMap
    ).reduce((sum, item) => {
      return (
        sum +
        Math.max(
          0,
          item.totalModules - item.completedModules
        )
      );
    }, 0);

    setStats((prev) => ({
      ...prev,
      pendingModules: totalPendingModules,
    }));
  } catch (error) {
    console.error("Error loading dashboard:", error);
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time listener for progress updates
  useEffect(() => {
    if (!userId || curriculum.length === 0) return;

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
        async (payload: any) => {
          // When a video is marked as completed, refetch progress for that course
          if (payload.new?.completed === true) {
            const courseId = payload.new?.course_id;
            if (courseId) {
              try {
                const updatedProgress = await getCourseProgress(userId, courseId);
                setCourseProgress((prev) => ({
                  ...prev,
                  [String(courseId)]: updatedProgress,
                }));
              } catch (error) {
                console.error(`Error refetching progress for course ${courseId}:`, error);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
 }, [userId]);

  const handleGenerateCertificate = async (courseId: string | number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const mockCertUrl = "CLAIMED";
      const { error } = await supabase
        .from("certificates")
        .insert({
          user_id: session.user.id,
          course_id: courseId,
          certificate_url: mockCertUrl,
        });

      if (error) {
        console.error("Error creating certificate:", error);
      }

      await loadDashboardData();
    } catch (e) {
      console.error("Error in handleGenerateCertificate:", e);
    }
  };

  const handleMarkInsightAsRead = async () => {
    if (!userId || insights.length === 0) return;
    const nextIndex = (currentInsightIndex + 1) % insights.length;
    setCurrentInsightIndex(nextIndex);
    await supabase
      .from("profiles")
      .update({ current_insight_index: nextIndex })
      .eq("id", userId);
  };



  const currentInsight = insights[currentInsightIndex] || {
    content: "Loading insight...",
    author: "",
  };

  // Calculate SVG Circle values
  const circleRadius = 45;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleOffset =
    circleCircumference - (circleCircumference * weeklyProgressPct) / 100;

  const activeCourses = curriculum.filter((course) => course.progress < 100);
  const completedCourses = curriculum.filter((course) => course.progress === 100);

  
console.log("ACTIVE COURSES", activeCourses);
console.log("COURSE PROGRESS", courseProgress);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* â”€â”€â”€ TOP SECTION: Header + Weekly Progress â”€â”€â”€ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Heading & Stats */}
          <div className="lg:col-span-2 flex flex-col justify-center min-h-48">
            <h1 className="text-4xl md:text-[44px] font-bold text-[#2283FF] mb-4 tracking-tight leading-tight">
              Continuing Your Journey
            </h1>
            <p className="text-gray-600 text-[17px] leading-relaxed max-w-2xl">
              Welcome back to{" "}
              <span className="font-bold text-[#2283FF]">The Automate</span>.
              You have{" "}
              <span className="font-semibold text-[#2283FF] underline decoration-dotted underline-offset-4">
                {stats.liveSessions} upcoming webinars
              </span>{" "}
              and{" "}
              <span className="font-semibold text-[#2283FF] underline decoration-dotted underline-offset-4">
                {stats.pendingModules} pending module
                {stats.pendingModules !== 1 ? "s" : ""}
              </span>{" "}
              in your core curriculum.
            </p>
          </div>

          {/* Right: Weekly Progress Widget */}
          <div className="lg:col-span-1">
            <section className="bg-[#2283FF] text-white p-6 rounded-2xl shadow-md relative overflow-hidden h-full flex flex-col justify-center">
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[11px] uppercase tracking-[0.2em] text-blue-100 mb-2">
                    Weekly Progress
                  </h3>
                  <p className="text-[13px] text-blue-50 leading-relaxed max-w-[140px]">
                    {weeklyProgressPct >= 100
                      ? "Weekly goal reached!"
                      : "Complete more modules to reach your goal."}
                  </p>
                </div>

                {/* Custom SVG Circular Progress */}
                <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                  <svg className="transform -rotate-90 w-full h-full">
                    <circle
                      cx="48"
                      cy="48"
                      r={circleRadius}
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r={circleRadius}
                      stroke="#ffffff"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={circleCircumference}
                      strokeDashoffset={circleOffset}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold tracking-tighter">
                      {weeklyProgressPct}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Decorative background */}
              <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-white opacity-10 rounded-full blur-3xl" />
            </section>
          </div>
        </div>

        {/* â”€â”€â”€ MY ACTIVE COURSES â”€â”€â”€ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
  {activeCourses.map((course) => (
    <CourseCard
    key={course.id}
    id={course.id}
  title={course.title}
  description={course.description}
  thumbnail={course.thumbnail_url}
  category={course.module_label}
  duration={course.duration}
  progressPercentage={
    courseProgress[String(course.id)]
      ?.progressPercentage || 0
  }
  showProgress={true}
  variant="detailed"
  onClick={() => router.push(`/courses/${course.id}`)}
/>
  ))}
</div>

        {/* â”€â”€â”€ THE AUTOMATE INSIGHT â”€â”€â”€ */}
        <section className="bg-[#FDFBF7] border-l-[6px] border-[#2283FF] p-7 rounded-r-2xl shadow-sm relative">
          <div className="absolute right-6 top-6 text-[#2283FF]/5">
            <BookOpen size={80} />
          </div>

          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="w-10 h-10 bg-[#2283FF] rounded-full flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-white" />
            </div>
            <h3 className="font-bold text-[#2283FF] text-base">
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
                  <p className="text-[11px] text-gray-500 font-bold mt-4 tracking-wider uppercase">
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
              className="bg-[#2283FF] hover:bg-[#2283FF] text-white rounded-lg flex items-center gap-2 shadow-sm font-semibold px-5"
            >
              <CheckCircle2 size={16} /> Mark as Read
            </Button>
          </div>
        </section>
      </div>

      {/* ─── CERTIFICATE MODAL ─── */}
      {selectedCertificateCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-gray-100 relative p-1 bg-gradient-to-br from-amber-400 via-white to-amber-400 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="bg-white rounded-[22px] p-6 sm:p-8 md:p-12 flex flex-col items-center justify-center text-center relative border border-amber-500/10">
              
              {/* Close Button */}
              <button
                onClick={() => setSelectedCertificateCourse(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>

              {/* Classical Certificate Design */}
              <div className="w-full flex flex-col items-center">
                {/* Gold Seal / Badge */}
                <div className="w-20 h-20 bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 rounded-full flex items-center justify-center shadow-lg mb-6 border-4 border-white">
                  <Award size={36} className="text-white" />
                </div>

                <span className="text-[10px] md:text-xs font-black tracking-[0.35em] text-amber-600 uppercase mb-4">
                  Certificate of Achievement
                </span>
                
                <h2 className="text-3xl md:text-5xl font-extrabold text-slate-800 tracking-tight mb-6 font-serif">
                  The Automate
                </h2>

                <p className="text-sm text-gray-500 font-medium max-w-md mb-8 leading-relaxed">
                  This prestigious academic credential is proudly presented to
                </p>

                <p className="text-2xl md:text-4xl font-black text-[#2283FF] tracking-tight mb-4 border-b-2 border-[#2283FF]/10 pb-2 px-8 min-w-[280px]">
                  {userProfileName}
                </p>

                <p className="text-xs text-gray-400 uppercase tracking-widest mb-6">
                  For outstanding dedication and masterfully completing
                </p>

                <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight max-w-xl mb-12">
                  {selectedCertificateCourse.title}
                </h3>

                <div className="w-full flex flex-col sm:grid sm:grid-cols-2 gap-6 sm:gap-8 pt-8 border-t border-gray-100 max-w-lg">
                  <div className="text-center sm:text-left">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Date of Issuance</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">
                      {new Date().toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-center sm:text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Authorized Signature</p>
                    <p className="text-sm font-bold text-slate-800 mt-1 italic font-serif text-[#2283FF]">
                      The Automate Curators
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
