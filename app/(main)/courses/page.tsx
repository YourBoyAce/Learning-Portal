"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { getMyLearningData } from "@/app/actions/my-learning";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
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

export default function MyLearningDashboard() {
  const [loading, setLoading] = useState(true);
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

      const learningResult = await getMyLearningData(session.access_token);
      if (learningResult) {
        const eventRows: UpcomingEventRow[] = Array.isArray(
          learningResult?.upcomingEvents,
        )
          ? learningResult.upcomingEvents
          : [];

        const mappedWebinars: UpcomingWebinarCard[] = eventRows.map(
          (event) => ({
            id: event.id,
            title: event.title,
            subtitle:
              event.description?.trim() || "Scheduled from your calendar",
            date: formatWebinarDate(event.event_date, event.event_time),
            icon: event.event_type === "webinar" ? "ðŸ“‹" : "â–¶",
            status: event.event_type === "webinar" ? "streaming" : "link",
            linkText:
              event.event_type === "webinar" ? undefined : "Scheduled Session",
            attendees: 0,
          }),
        );
        setUpcomingWebinars(mappedWebinars);

        setStats((prev) => ({
          ...prev,
          liveSessions: mappedWebinars.length,
        }));

        if (Array.isArray(learningResult?.enrollments)) {
          const enrollmentRows = learningResult.enrollments as Enrollment[];
          setEnrollments(enrollmentRows);

          if (enrollmentRows.length > 0) {
            setCurriculum(
              enrollmentRows.map((item, index) => ({
                id: item.courseId || `fallback-${index}`,
                title: item.courseTitle,
                description:
                  item.courseDescription ||
                  `You are enrolled in ${item.batchName}.`,
                module_label: `BATCH Â· ${item.batchName}`,
                progress: 0,
                duration: item.startDate
                  ? new Date(item.startDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                  : undefined,
              })),
            );
          } else {
            setCurriculum([]);
          }
        }
      }

      // 1. Fetch User Profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_insight_index, full_name")
        .eq("id", session.user.id)
        .single();

      setCurrentInsightIndex(profile?.current_insight_index || 0);
      setUserProfileName(profile?.full_name || session.user.email?.split("@")[0] || "Learner");

      // 2. Fetch Scholarly Insights
      const { data: insightsData } = await supabase
        .from("scholarly_insights")
        .select("*")
        .order("id", { ascending: true });

      if (insightsData) setInsights(insightsData);

      // 3. Logic for Weekly Progress (calculated dynamically in step 6 from enrolled courses progress)

      // 4. Fetch Webinars
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

      // 5. Pending modules are calculated in step 6 using actual coursemodules data

      // 6. Fetch Enrolled Courses, Modules & Calculate Progress
      const { data: enrollmentsData } = await supabase
        .from("course_enrollments")
        .select(
          `
          course_id,
          maincourses (
            id,
            title,
            description,
            category,
            thumbnail_url,
            coursemodules (*)
          )
        `,
        )
        .eq("user_id", session.user.id);

      const { data: progressData } = await supabase
        .from("user_video_progress")
        .select("course_id, video_id, completed")
        .eq("user_id", session.user.id);

      const { data: certsData } = await supabase
        .from("certificates")
        .select("course_id, certificate_url")
        .eq("user_id", session.user.id);

      if (enrollmentsData && enrollmentsData.length > 0) {
        const validEnrollments = enrollmentsData.filter(
          (e: any) => e.maincourses,
        );
        const mappedCurriculum = validEnrollments.map((e: any) => {
          const course = e.maincourses;
          const modules = (course.coursemodules || []).sort((a: any, b: any) => 
            (a.order_index ?? a.id) - (b.order_index ?? b.id)
          );
          
          const courseProgress =
              progressData?.filter((p: any) => p.course_id === course.id) || [];
          
          const totalModules = modules.length;
          const completedModules = modules.filter((m: any) => 
            courseProgress.some((p: any) => String(p.video_id) === String(m.id) && p.completed)
          ).length;

          const progress =
            totalModules > 0
              ? Math.round((completedModules / totalModules) * 100)
              : 0;

          const cert = certsData?.find((c: any) => String(c.course_id) === String(course.id)) || null;

          return {
            id: course.id,
            title: course.title,
            description:
              course.description || "Course description unavailable.",
            module_label: course.category
              ? course.category.toUpperCase()
              : "GENERAL",
            progress: progress,
            thumbnail_url: course.thumbnail_url,
            modules: modules, // Add modules to state
            certificate_url: cert?.certificate_url || null,
            duration:
              progress === 0
                ? "Ready to begin"
                : progress === 100
                  ? "Completed"
                  : `${completedModules}/${totalModules} Modules`,
          };
        });
        setCurriculum(mappedCurriculum);

        // Calculate average course progress (mirrors dashboard/page.tsx logic)
        const avgProgress = mappedCurriculum.length > 0
          ? Math.round(
              mappedCurriculum.reduce((sum, c) => sum + c.progress, 0) / mappedCurriculum.length
            )
          : 0;
        setWeeklyProgressPct(avgProgress);

        // Calculate pending modules: sum of incomplete modules across all enrolled courses
        const totalPendingModules = validEnrollments.reduce((sum: number, e: any) => {
          const course = e.maincourses;
          const modules = course.coursemodules || [];
          const courseProgressData = progressData?.filter(
            (p: any) => p.course_id === course.id
          ) || [];
          const completedCount = modules.filter((m: any) =>
            courseProgressData.some(
              (p: any) => String(p.video_id) === String(m.id) && p.completed
            )
          ).length;
          return sum + Math.max(0, modules.length - completedCount);
        }, 0);

        setStats((prev) => ({ ...prev, pendingModules: totalPendingModules }));
      } else {
        setCurriculum([]);
        setWeeklyProgressPct(0);
        setStats((prev) => ({ ...prev, pendingModules: 0 }));
      }
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

  if (loading)
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2283FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your journey...</p>
        </div>
      </div>
    );

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
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200/60 pb-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a] tracking-tight">
                My Active Courses
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Access your core educational tracks and tracking metrics.
              </p>
            </div>

            {/* Premium Pill Tabs */}
            <div className="bg-gray-100/80 backdrop-blur-md p-1 rounded-2xl flex gap-1 self-start sm:self-auto border border-gray-200/40">
              <button
                onClick={() => setActiveTab("in_progress")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 ${
                  activeTab === "in_progress"
                    ? "bg-[#2283FF] text-white shadow-md shadow-[#2283FF]/15"
                    : "text-gray-600 hover:text-[#0f172a]"
                }`}
              >
                In Progress
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    activeTab === "in_progress"
                      ? "bg-white/20 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {activeCourses.length}
                </span>
              </button>
              
              <button
                onClick={() => setActiveTab("completed")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 ${
                  activeTab === "completed"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/15"
                    : "text-gray-600 hover:text-[#0f172a]"
                }`}
              >
                Completed
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    activeTab === "completed"
                      ? "bg-white/20 text-white"
                      : "bg-gray-200 text-emerald-700 font-bold"
                  }`}
                >
                  {completedCourses.length}
                </span>
              </button>
            </div>
          </div>

          <div>
            {activeTab === "in_progress" ? (
              activeCourses.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center shadow-sm max-w-xl mx-auto flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 text-[#2283FF] rounded-2xl flex items-center justify-center border border-blue-100 shadow-inner">
                    <BookOpen size={28} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg">All caught up!</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      No active courses assigned or in progress. Start a new course to begin a track.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {activeCourses.map((course) => (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="group bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-[#2283FF]/8 transition-all duration-500 overflow-hidden flex flex-col cursor-pointer"
                  >
                    {/* Large Thumbnail */}
                    <div className="relative w-full h-48 sm:h-64 overflow-hidden">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#2283FF] via-[#1a6fdb] to-[#0f172a]" />
                      )}

                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/30 shadow-2xl group-hover:scale-110 transition-transform duration-300">
                          <PlayCircle className="text-white" size={32} strokeWidth={1.5} />
                        </div>
                      </div>

                      {/* Category badge */}
                      {course.module_label && (
                        <span className="absolute top-4 left-4 bg-white/15 backdrop-blur-xl text-white text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-full border border-white/20">
                          {course.module_label}
                        </span>
                      )}

                      {/* Duration badge */}
                      {course.duration && (
                        <span className="absolute top-4 right-4 bg-black/50 backdrop-blur-xl text-white text-[10px] font-bold px-3 py-1.5 rounded-full border border-white/10">
                          {course.duration}
                        </span>
                      )}

                      {/* Bottom-left progress indicator on thumbnail */}
                      <div className="absolute bottom-4 left-4 flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-xl border border-white/20 flex items-center justify-center">
                          <span className="text-white text-[11px] font-black">{course.progress}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="flex-1 flex flex-col p-6 pt-5">
                      <h3 className="text-xl font-bold text-[#0f172a] group-hover:text-[#2283FF] transition-colors leading-snug mb-2">
                        {course.title}
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-6">
                        {course.description}
                      </p>

                      {/* Progress bar */}
                      <div className="mt-auto">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Progress</span>
                          <span className="text-xs font-black text-[#2283FF]">{course.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-50 rounded-full h-2.5 overflow-hidden border border-gray-100 p-0.5">
                          <div
                            className="bg-gradient-to-r from-[#2283FF] via-[#2c6cb0] to-[#2283FF] bg-[length:200%_auto] animate-gradient-shift h-full rounded-full transition-all duration-1000"
                            style={{ width: `${course.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                </div>
              )
            ) : (
              completedCourses.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center shadow-sm max-w-xl mx-auto flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-inner">
                    <CheckCircle2 size={28} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg">No completed courses yet</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      Your completed courses and downloadable academic credentials will be showcased here.
                    </p>
                  </div>
                </div>
              ) : (
                completedCourses.map((course) => (
                  <div
                    key={course.id}
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-6 items-center hover:shadow-md transition-shadow relative overflow-hidden group"
                  >
                    {/* Subtle Completed Banner Accent */}
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                    
                    {/* Video Thumbnail */}
                    <div
                      onClick={() => {
                        if (course.certificate_url) {
                          setSelectedCertificateCourse(course);
                        } else {
                          handleGenerateCertificate(course.id);
                        }
                      }}
                      className="w-full sm:w-56 h-32 bg-[#0f172a] rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden group cursor-pointer border border-gray-100 shadow-inner"
                    >
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-[#0f172a] opacity-80" />
                      )}
                      
                      <div className="absolute inset-0 bg-emerald-950/20 group-hover:bg-emerald-950/40 transition-colors flex items-center justify-center">
                        <CheckCircle2
                          className="text-white bg-emerald-500 rounded-full group-hover:scale-110 transition-transform z-10 p-0.5 shadow-md shadow-emerald-500/20"
                          size={48}
                          strokeWidth={2}
                        />
                      </div>

                      <span className="absolute bottom-3 right-3 bg-emerald-600/90 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-lg z-10 border border-white/10 uppercase tracking-wider">
                        Completed
                      </span>
                    </div>

                    {/* Content & Progress */}
                    <div className="flex-1 w-full py-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        {course.module_label && (
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">
                            {course.module_label}
                          </p>
                        )}
                        <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded uppercase">
                          CREDENTIAL EARNED
                        </span>
                      </div>
                      <h3 
                        onClick={() => {
                          if (course.certificate_url) {
                            setSelectedCertificateCourse(course);
                          } else {
                            handleGenerateCertificate(course.id);
                          }
                        }}
                        className="font-bold text-[#0f172a] text-[18px] hover:text-emerald-600 transition-colors cursor-pointer"
                      >
                        {course.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1.5 mb-5">
                        {course.description}
                      </p>

                      <div className="flex items-center gap-4">
                        <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: "100%" }}
                          />
                        </div>
                        <span className="text-xs font-black text-emerald-600">
                          100%
                        </span>
                      </div>

                      {/* Modules List Preview */}
                      {course.modules && course.modules.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {course.modules.slice(0, 4).map((m: any) => (
                            <Link key={m.id} href={`/courses/${course.id}?module=${m.id}`}>
                              <span className="text-[10px] font-bold bg-emerald-50/50 hover:bg-emerald-50 hover:text-emerald-600 px-2.5 py-1 rounded-lg text-gray-500 border border-emerald-100/30 transition-colors flex items-center gap-1.5 group/mod">
                                <CheckCircle2 size={12} className="text-emerald-400" />
                                {m.title}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Certificate Action Button */}
                    <div className="w-full sm:w-auto shrink-0 px-2">
                      {course.certificate_url ? (
                        <Button
                          onClick={() => setSelectedCertificateCourse(course)}
                          className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-full flex items-center justify-center gap-2 px-6 py-5 shadow-md shadow-amber-500/20 font-bold border border-amber-400/20 transition-all hover:scale-105"
                        >
                          <Award size={18} />
                          View Certificate
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleGenerateCertificate(course.id)}
                          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center gap-2 px-6 py-5 shadow-md shadow-emerald-600/20 font-bold transition-all hover:scale-105"
                        >
                          <Award size={18} />
                          Claim Certificate
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </section>

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
