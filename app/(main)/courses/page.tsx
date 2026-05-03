"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { BookOpen, PlayCircle, CheckCircle2, Calendar } from "lucide-react";

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
  id: number;
  title: string;
  description: string;
  module_label?: string;
  progress: number;
  thumbnail_url?: string;
  duration?: string;
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

export default function MyLearningDashboard() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Data States
  const [stats, setStats] = useState<UserStats>({
    liveSessions: 0,
    pendingModules: 0,
  });
  const [weeklyProgressPct, setWeeklyProgressPct] = useState(0);

  // Insight States
  const [insights, setInsights] = useState<Insight[]>([]);
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);

  // Curriculum State
  const [curriculum, setCurriculum] = useState<CurriculumCourse[]>([]);

  // Upcoming Webinars
  const [upcomingWebinars, setUpcomingWebinars] = useState<Webinar[]>([]);

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // 1. Fetch User Profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_insight_index")
        .eq("id", user.id)
        .single();

      setCurrentInsightIndex(profile?.current_insight_index || 0);

      // 2. Fetch Scholarly Insights
      const { data: insightsData } = await supabase
        .from("scholarly_insights")
        .select("*")
        .order("id", { ascending: true });

      if (insightsData) setInsights(insightsData);

      // 3. Logic for Weekly Progress
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentProgress } = await supabase
        .from("user_video_progress")
        .select("*")
        .eq("user_id", user.id)
        .gte("completed_at", sevenDaysAgo.toISOString());

      const modulesCompletedThisWeek = recentProgress?.length || 0;
      const targetModulesPerWeek = 5;
      const progressCalculation = Math.min(
        Math.round((modulesCompletedThisWeek / targetModulesPerWeek) * 100),
        100
      );
      setWeeklyProgressPct(progressCalculation);

      // 4. Fetch Webinars
      const { data: webinarsData } = await supabase
        .from("webinars")
        .select("*")
        .order("created_at", { ascending: true });

      const mappedWebinars = webinarsData?.map((w: any) => ({
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

      // 5. Calculate Pending Modules
      const { count: completedVideosCount } = await supabase
        .from("user_video_progress")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: totalVideosCount } = await supabase
        .from("videos")
        .select("*", { count: "exact", head: true });

      const pendingMods = Math.max(
        0,
        (totalVideosCount || 0) - (completedVideosCount || 0)
      );

      setStats({
        liveSessions: mappedWebinars.length,
        pendingModules: pendingMods,
      });

      // 6. Fetch Enrolled Courses & Calculate Progress
      const { data: enrollmentsData } = await supabase
        .from("course_enrollments")
        .select(`
          course_id,
          maincourses (
            id,
            title,
            description,
            category
          )
        `)
        .eq("user_id", user.id);

      const { data: progressData } = await supabase
        .from("user_video_progress")
        .select("course_id, completed")
        .eq("user_id", user.id);

      if (enrollmentsData && enrollmentsData.length > 0) {
        const validEnrollments = enrollmentsData.filter((e: any) => e.maincourses);
        const mappedCurriculum = validEnrollments.map((e: any) => {
          const course = e.maincourses;
          const courseVideos = progressData?.filter((p: any) => p.course_id === course.id) || [];
          const totalVideos = courseVideos.length;
          const completedVideos = courseVideos.filter((p: any) => p.completed).length;
          const progress = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;
          
          return {
            id: course.id,
            title: course.title,
            description: course.description || "Course description unavailable.",
            module_label: course.category ? course.category.toUpperCase() : "GENERAL",
            progress: progress,
            duration: progress === 0 ? "Ready to begin" : progress === 100 ? "Completed" : "In Progress",
          };
        });
        setCurriculum(mappedCurriculum);
      } else {
        setCurriculum([]);
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
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
          <div className="w-12 h-12 border-4 border-[#174778] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            Loading your journey...
          </p>
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* ─── TOP SECTION: Header + Weekly Progress ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Heading & Stats */}
          <div className="lg:col-span-2 flex flex-col justify-center min-h-48">
            <h1 className="text-4xl md:text-[44px] font-bold text-[#174778] mb-4 tracking-tight leading-tight">
              Continuing Your Journey
            </h1>
            <p className="text-gray-600 text-[17px] leading-relaxed max-w-2xl">
              Welcome back to{" "}
              <span className="font-bold text-[#174778]">The Automate</span>.
              You have{" "}
              <span className="font-semibold text-[#174778] underline decoration-dotted underline-offset-4">
                {stats.liveSessions} upcoming webinars
              </span>{" "}
              and{" "}
              <span className="font-semibold text-[#174778] underline decoration-dotted underline-offset-4">
                {stats.pendingModules} pending module
                {stats.pendingModules !== 1 ? "s" : ""}
              </span>{" "}
              in your core curriculum.
            </p>
          </div>

          {/* Right: Weekly Progress Widget */}
          <div className="lg:col-span-1">
            <section className="bg-[#4A2B23] text-white p-6 rounded-2xl shadow-md relative overflow-hidden h-full flex flex-col justify-center">
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[11px] uppercase tracking-[0.2em] text-[#E8DCCA] mb-2">
                    Weekly Progress
                  </h3>
                  <p className="text-[13px] text-[#E8DCCA] leading-relaxed max-w-[140px]">
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
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r={circleRadius}
                      stroke="#E6A15C"
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
              <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-[#E6A15C] opacity-5 rounded-full blur-3xl" />
            </section>
          </div>
        </div>

        {/* ─── UPCOMING WEBINARS ─── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-[#0f172a] tracking-tight">
              Upcoming Webinars
            </h2>
            <Link
              href="/calendar"
              className="text-sm font-semibold text-[#174778] hover:underline"
            >
              View Calendar
            </Link>
          </div>

          <Carousel className="w-full">
            <CarouselContent>
              {upcomingWebinars.map((webinar) => (
                <CarouselItem
                  key={webinar.id}
                  className="md:basis-1/2 lg:basis-1/3"
                >
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 h-52 flex flex-col justify-between group hover:shadow-md transition-all">
                    <div>
                      {/* Date Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-[#174778] text-[10px] font-bold uppercase tracking-wider">
                          {webinar.date}
                        </span>
                        <span className="text-gray-400 text-lg">
                          {webinar.icon}
                        </span>
                      </div>

                      {/* Title & Subtitle */}
                      <h3 className="font-bold text-[#0f172a] text-[17px] leading-snug mb-1">
                        {webinar.title}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {webinar.subtitle}
                      </p>
                    </div>

                    {/* Bottom Row */}
                    <div className="flex items-center justify-between border-t border-gray-50 pt-3 mt-2">
                      <div className="flex items-center gap-1">
                        {/* Attendee Avatars */}
                        {Array.from({
                          length: Math.min(webinar.attendees, 3),
                        }).map((_, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white -ml-1 first:ml-0 flex items-center justify-center"
                          >
                            <span className="text-[8px] text-gray-500">
                              👤
                            </span>
                          </div>
                        ))}
                      </div>

                      {webinar.status === "streaming" ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Streaming
                        </span>
                      ) : webinar.linkText ? (
                        <span className="text-[11px] font-semibold text-[#174778] underline cursor-pointer">
                          {webinar.linkText}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="hidden sm:block">
              <CarouselPrevious className="-left-4 bg-white border-gray-200 shadow-sm" />
              <CarouselNext className="-right-4 bg-white border-gray-200 shadow-sm" />
            </div>
          </Carousel>
        </section>

        {/* ─── CURATED VIDEO CURRICULUM ─── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-[#0f172a] tracking-tight">
              Curated Video Curriculum
            </h2>
          </div>

          <div className="space-y-4">
            {curriculum.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-500 text-sm">
                no courses assigned
              </div>
            ) : (
              curriculum.map((course) => (
                <div
                  key={course.id}
                  className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-6 items-center hover:shadow-md transition-shadow"
                >
                  {/* Video Thumbnail */}
                  <div className="w-full sm:w-56 h-32 bg-[#0f172a] rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden group cursor-pointer">
                    <PlayCircle
                      className="text-white/70 group-hover:text-white transition-colors z-10"
                      size={40}
                      strokeWidth={1.5}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    {course.duration && (
                      <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-10">
                        {course.duration}
                      </span>
                    )}
                  </div>

                  {/* Content & Progress */}
                  <div className="flex-1 w-full py-1">
                    {course.module_label && (
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-1.5">
                        {course.module_label}
                      </p>
                    )}
                    <h3 className="font-bold text-[#0f172a] text-[18px]">
                      {course.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1.5 mb-5">
                      {course.description}
                    </p>

                    <div className="flex items-center gap-4">
                      <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#174778] h-full rounded-full transition-all duration-500"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-400">
                        {course.progress}%
                      </span>
                    </div>
                  </div>

                  {/* Resume Button */}
                  <div className="w-full sm:w-auto shrink-0 px-2">
                    <Button className="w-full sm:w-auto bg-[#174778] hover:bg-[#113a63] text-white rounded-full flex items-center gap-2 px-6 py-5 shadow-sm">
                      <PlayCircle size={18} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ─── THE AUTOMATE INSIGHT ─── */}
        <section className="bg-[#FDFBF7] border-l-[6px] border-[#174778] p-7 rounded-r-2xl shadow-sm relative">
          <div className="absolute right-6 top-6 text-[#174778]/5">
            <BookOpen size={80} />
          </div>

          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="w-10 h-10 bg-[#174778] rounded-full flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-white" />
            </div>
            <h3 className="font-bold text-[#174778] text-base">
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
                    — {currentInsight.author}
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
              className="bg-[#174778] hover:bg-[#113a63] text-white rounded-lg flex items-center gap-2 shadow-sm font-semibold px-5"
            >
              <CheckCircle2 size={16} /> Mark as Read
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
