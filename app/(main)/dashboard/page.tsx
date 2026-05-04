"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

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

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [nextCourse, setNextCourse] = useState<any>(null);
  const [nextModule, setNextModule] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);

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

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Banner - Dark Blue */}
        <div className="bg-[#174778] rounded-2xl p-8 text-white mb-8 shadow-sm">
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
              <button className="bg-white text-[#174778] px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors">
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
              <button
                onClick={() => router.push("/calendar")}
                className="bg-transparent border border-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
              >
                View Calendar
              </button>
            </div>
          )}
        </div>

        {/* Upcoming Webinars Section */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
                Upcoming Webinars
              </span>
              <span className="text-xs text-gray-500">
                {upcomingEvents.length} scheduled
              </span>
            </div>

            <h2 className="text-xl font-semibold text-gray-800 mb-1">
              Sessions from your calendar
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              These are pulled live from events created in Calendar.
            </p>

            {upcomingEvents.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
                No upcoming events found. Add one in Calendar to see it here.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-[#174778]/10 rounded-lg flex items-center justify-center shrink-0">
                      <svg
                        className="w-6 h-6 text-[#174778]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">
                        {event.title}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {event.description?.trim() || "Scheduled session"}
                      </p>
                      <p className="text-xs text-[#174778] mt-1 font-medium">
                        {formatEventLabel(event.event_date, event.event_time)}
                      </p>
                    </div>
                    <span className="text-[11px] uppercase tracking-wide text-gray-500">
                      {event.event_type}
                    </span>
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
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 hover:border-[#174778] transition-colors cursor-pointer group">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors overflow-hidden border border-gray-100">
                    <img
                      src={nextCourse?.thumbnail_url || PLACEHOLDER_IMAGE}
                      alt={nextCourse?.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="font-semibold text-gray-800 group-hover:text-[#174778] transition-colors">
                      {nextModule.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {nextCourse?.description || "Module in progress..."}
                    </p>
                  </div>
                  <button className="w-10 h-10 bg-[#174778] rounded-lg flex items-center justify-center text-white shrink-0 hover:bg-[#113a63] transition-colors shadow-sm mt-2 sm:mt-0">
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
                <div className="w-24 h-24 rounded-full border-4 border-[#174778] flex items-center justify-center">
                  <span className="text-2xl font-bold text-[#174778]">0%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enrollment Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">
            Batch Enrollment Summary
          </h2>
          <div className="space-y-2">
            {enrollments.slice(0, 3).map((item) => (
              <div
                key={`${item.batchId}-${item.courseId}`}
                className="flex justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <p className="text-sm text-gray-800 font-medium">
                  {item.courseTitle}
                </p>
                <p className="text-xs text-gray-500">{item.batchName}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Active Studies Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Active Studies
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrolledCourses.map((course) => (
              <div
                key={course.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
              >
                <div className="h-32 bg-gray-100 relative">
                  <img
                    src={course.thumbnail_url || PLACEHOLDER_IMAGE}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 mb-3">
                    {course.title}
                  </h3>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                    <div
                      className="bg-[#174778] h-1.5 rounded-full"
                      style={{ width: "0%" }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Insight */}
        <div className="bg-[#8B4513] rounded-xl p-6 text-white shadow-sm">
          <p className="text-sm leading-relaxed italic">
            &ldquo;Knowledge is not static...&rdquo; — Theodore Geisel
          </p>
        </div>
      </div>
    </div>
  );
}
