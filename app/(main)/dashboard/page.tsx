"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { getCourseProgress } from "@/app/actions/get-course-progress";

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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
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


  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;
      if (!user) {
        router.replace("/login");
        return;
      }

      if (cancelled) return;

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

      if (cancelled) return;
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

      if (cancelled) return;

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
          
          if (!cancelled) {
            setCourseProgress(progressMap);
          }
        }

        if (mappedCourses.length > 0) {
          const mostRecentCourse = mappedCourses[0];
          setNextCourse(mostRecentCourse);

          // Fetch the first module for the most recent course
          const { data: modulesData } = await supabase
            .from("coursemodules")
            .select("*")
            .eq("maincourse_id", mostRecentCourse.id)
            .order("id", { ascending: true })
            .limit(1);

          if (!cancelled && modulesData && modulesData.length > 0) {
            setNextModule(modulesData[0]);
          }
        }
      }

      setLoading(false);
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace("/login");
        }
      },
    );


    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  const userName = useMemo(() => {
    return (
      profile?.full_name ||
      (userEmail ? userEmail.split("@")[0] : null) ||
      "Learner"
    );
  }, [profile?.full_name, userEmail]);

  if (loading) return null;

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


  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Banner - Dark Blue */}
        <div className="bg-[#2283FF] rounded-2xl p-8 text-white mb-8 shadow-sm">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back to The Automate, {userName}.
          </h1>
          <p className="text-blue-200 text-sm mb-6 max-w-2xl">
            {hasEnrollments
              ? "Your intellectual journey continues. Pick up where you left off below."
              : "Welcome to your dashboard. Your curriculum allocations will appear here once assigned by your administrator."}
          </p>
          {hasEnrollments && (
            <div className="flex gap-3">
              <button
                onClick={handlePlayModule}
                className="bg-white text-[#2283FF] px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors"
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

        {/* Upcoming Webinars Section */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#2283FF] uppercase tracking-[0.2em]">
                Live Sessions
              </span>
              <span className="text-[10px] font-bold px-2 py-1 bg-orange-100 text-orange-600 rounded-lg">
                {upcomingEvents.length} UPCOMING
              </span>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              Upcoming Webinars
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Exclusive live knowledge sessions from your curators.
            </p>

            {upcomingEvents.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">No live sessions scheduled yet.</p>
                <p className="text-xs text-gray-400 mt-1">Check back later or visit your calendar.</p>
              </div>
            ) : (
              <div className="flex gap-5 overflow-x-auto pb-6 -mx-1 px-1 scrollbar-hide">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="min-w-[300px] md:min-w-[340px] bg-white border border-gray-100 rounded-[2rem] p-6 flex flex-col gap-5 shadow-sm hover:shadow-xl transition-all duration-300 relative group border-b-4 border-b-[#2283FF]/10 hover:border-b-[#2283FF]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-14 h-14 bg-[#2283FF]/5 rounded-2xl flex items-center justify-center shrink-0 border border-[#2283FF]/10 group-hover:scale-110 transition-transform duration-300">
                        <svg
                          className="w-7 h-7 text-[#2283FF]"
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
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#2283FF]/30">
                        {event.event_type}
                      </span>
                    </div>

                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#2283FF] transition-colors mb-2">
                        {event.title}
                      </h3>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                        {event.description?.trim() || "Deep dive into advanced concepts with our industry experts."}
                      </p>
                    </div>

                    <div className="pt-5 border-t border-gray-50 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Commences at</p>
                        <p className="text-xs font-black text-[#2283FF]">
                          {formatEventLabel(event.event_date, event.event_time)}
                        </p>
                      </div>
                      <button className="w-10 h-10 bg-[#2283FF] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#2283FF]/20 hover:scale-110 transition-transform">
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

        {/* Active Course & Progress */}
        {hasEnrollments && (
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
                  In Next
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">
                {nextCourse?.title || "Your next course"}
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Your next module is ready
              </p>

              {nextModule ? (
                <div
                  onClick={handlePlayModule}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 hover:border-[#2283FF] transition-colors cursor-pointer group"
                >
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors overflow-hidden border border-gray-100">
                    <img
                      src={nextCourse?.thumbnail_url || PLACEHOLDER_IMAGE}
                      alt={nextCourse?.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="font-semibold text-gray-800 group-hover:text-[#2283FF] transition-colors">
                      {nextModule.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {nextCourse?.description || "Module in progress..."}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayModule();
                    }}
                    className="w-10 h-10 bg-[#2283FF] rounded-lg flex items-center justify-center text-white shrink-0 hover:bg-[#2283FF] transition-colors shadow-sm mt-2 sm:mt-0"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                  <p className="text-sm font-semibold text-gray-800">
                    No modules available
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Progress Summary
              </h3>
              <div className="flex items-center justify-center mb-4">
                <div className="w-24 h-24 rounded-full border-4 border-[#2283FF] flex items-center justify-center">
                  <span className="text-2xl font-bold text-[#2283FF]">
                    {enrolledCourses.length > 0 
                      ? Math.round(
                          enrolledCourses.reduce((sum, course) => sum + (courseProgress[String(course.id)]?.progressPercentage || 0), 0) / enrolledCourses.length
                        )
                      : 0
                    }%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enrollment Summary */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              Batch Allocations
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrollments.length === 0 ? (
              <div className="col-span-full bg-white border border-dashed border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-sm">
                No active batch allocations found.
              </div>
            ) : (
              enrollments.slice(0, 3).map((item) => (
                <div
                  key={`${item.batchId}-${item.courseId}`}
                  className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#2283FF]/5 rounded-bl-[4rem] -mr-8 -mt-8 transition-transform group-hover:scale-110" />

                  <div className="flex items-center gap-4 mb-6 relative">
                    <div className="w-12 h-12 bg-[#2283FF] rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-[#2283FF]/20 group-hover:rotate-6 transition-transform">
                      {item.courseTitle.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {item.courseTitle}
                      </p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                        {item.batchName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[11px] font-bold text-gray-600 uppercase">Active Enrollment</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Studies Grid */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Active Studies
            </h2>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
              {enrolledCourses.length} Courses in Progress
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {enrolledCourses.map((course) => (
              <div
                key={course.id}
                onClick={() => handleOpenCourse(course.id)}
                className="group bg-white border border-gray-100 rounded-[2.5rem] p-6 flex flex-col md:flex-row gap-8 hover:shadow-2xl hover:shadow-[#2283FF]/10 transition-all duration-500 cursor-pointer relative overflow-hidden"
              >
                {/* Decorative element */}
                <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-[#2283FF]/5 rounded-full blur-3xl group-hover:bg-[#2283FF]/10 transition-colors" />

                <div className="w-full md:w-48 h-40 rounded-[2rem] overflow-hidden shrink-0 shadow-xl shadow-black/5 relative group-hover:scale-[1.02] transition-transform duration-500">
                  <img
                    src={course.thumbnail_url || PLACEHOLDER_IMAGE}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    alt={course.title}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-between py-2">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-3 py-1 bg-[#2283FF]/5 text-[#2283FF] text-[10px] font-black rounded-full uppercase tracking-widest border border-[#2283FF]/10">
                        {course.category || "General Curriculum"}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight group-hover:text-[#2283FF] transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 md:block hidden">
                      {course.description || "Master these concepts with our structured learning path."}
                    </p>
                  </div>

                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#2283FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Momentum</span>
                      </div>
                      <span className="text-xs font-black text-[#2283FF]">
                        {courseProgress[String(course.id)]?.progressPercentage || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-50 rounded-full h-2.5 overflow-hidden border border-gray-100 p-0.5">
                      <div
                        className="bg-gradient-to-r from-[#2283FF] via-[#2c6cb0] to-[#2283FF] bg-[length:200%_auto] animate-gradient-shift h-full rounded-full transition-all duration-1000"
                        style={{ width: `${courseProgress[String(course.id)]?.progressPercentage || 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

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
    </div>
  );
}
