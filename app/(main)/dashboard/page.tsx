"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Profile = {
  full_name?: string | null;
  role?: string | null;
};

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
      setLoading(false);
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace("/login");
        }
      }
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

  const formatEventLabel = (eventDate: string, eventTime: string) => {
    const start = new Date(`${eventDate}T${eventTime}`);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeLabel = start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    if (start.toDateString() === now.toDateString()) return `Today, ${timeLabel}`;
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
        <div className="bg-[#174778] rounded-2xl p-8 text-white mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back to The Automate, {userName}.
          </h1>
          <p className="text-blue-200 text-sm mb-6 max-w-2xl">
            Your intellectual journey continues. You have five modules to complete this week to stay on track for your fellowship.
          </p>
          <div className="flex gap-3">
            <button className="bg-white text-[#174778] px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-100">
              Resume Last Lesson
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => router.push("/calendar")}
              className="bg-transparent border border-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10"
            >
              View Calendar
            </button>
          </div>
        </div>

        {/* Upcoming Webinars & Progress */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Upcoming Webinars */}
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
                      <h3 className="font-semibold text-gray-800">{event.title}</h3>
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

          {/* Weekly Progress */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Weekly Progress</h3>
            <div className="flex items-center justify-center mb-4">
              <div className="w-24 h-24 rounded-full border-4 border-[#174778] flex items-center justify-center">
                <span className="text-2xl font-bold text-[#174778]">75%</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Hours Studied</span>
                <span className="text-gray-700 font-medium">12.5 hrs</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Tasks Completed</span>
                <span className="text-gray-700 font-medium">8/10</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enrollment Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Batch Enrollment Summary
            </h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {enrollments.length} Enrollment{enrollments.length === 1 ? "" : "s"}
            </span>
          </div>

          {enrollments.length === 0 ? (
            <p className="text-xs text-gray-500">
              You are not enrolled in any batch yet.
            </p>
          ) : (
            <div className="space-y-2">
              {enrollments.slice(0, 3).map((item) => (
                <div
                  key={`${item.batchId}-${item.courseId ?? "none"}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <p className="text-sm text-gray-800">
                    <span className="font-medium">{item.courseTitle}</span>
                    <span className="text-gray-500"> • {item.batchName}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.startDate
                      ? `Starts ${new Date(item.startDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}`
                      : "Start date not set"}
                  </p>
                </div>
              ))}
              {enrollments.length > 3 ? (
                <p className="text-xs text-gray-500">
                  +{enrollments.length - 3} more. Open My Learning to view all.
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Active Studies */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Active Studies</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Pick up exactly where you left off in your curated coursework.</span>
              <button className="text-[#174778] text-sm font-medium flex items-center gap-1">
                Browse All
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            {/* Course 1 */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 text-white">
              <div className="w-12 h-12 bg-white/10 rounded-lg mb-3 flex items-center justify-center">
                <span className="text-xl">🎓</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Philosophy</span>
              <h3 className="font-semibold mt-1 mb-2">Metaphysics & Modernity</h3>
              <div className="w-full bg-gray-700 rounded-full h-1 mb-2">
                <div className="bg-blue-400 h-1 rounded-full" style={{ width: "45%" }}></div>
              </div>
              <p className="text-xs text-gray-400">45% • Last Accessed: 3 days ago</p>
            </div>

            {/* Course 2 */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 text-white">
              <div className="w-12 h-12 bg-white/10 rounded-lg mb-3 flex items-center justify-center">
                <span className="text-xl">🔬</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-gray-400">History</span>
              <h3 className="font-semibold mt-1 mb-2">Technological Determinism</h3>
              <div className="w-full bg-gray-700 rounded-full h-1 mb-2">
                <div className="bg-blue-400 h-1 rounded-full" style={{ width: "12%" }}></div>
              </div>
              <p className="text-xs text-gray-400">12% • Nearing Completion</p>
            </div>

            {/* Course 3 */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 text-white">
              <div className="w-12 h-12 bg-white/10 rounded-lg mb-3 flex items-center justify-center">
                <span className="text-xl">🏛️</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Architecture</span>
              <h3 className="font-semibold mt-1 mb-2">Neo-Classical Transitions</h3>
              <div className="w-full bg-gray-700 rounded-full h-1 mb-2">
                <div className="bg-blue-400 h-1 rounded-full" style={{ width: "0%" }}></div>
              </div>
              <p className="text-xs text-gray-400">Ready to start</p>
            </div>
          </div>
        </div>

        {/* Bottom Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Scholar's Insight */}
          <div className="bg-[#8B4513] rounded-xl p-6 text-white">
            <h3 className="font-semibold mb-2">Scholar&apos;s Insight</h3>
            <p className="text-sm text-white/80 leading-relaxed">
              &ldquo;Knowledge is not static. The more things you will know. The more that you learn, the more places you&apos;ll go.&rdquo; — Theodore Geisel
            </p>
          </div>

          {/* Expand Your Horizons */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Expand Your Horizons</h3>
              <p className="text-xs text-gray-500 max-w-xs">
                Our spring research grants are now open for application. Learn how your current coursework can qualify you for funding.
              </p>
            </div>
            <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
              Explore Grants
            </button>
          </div>
        </div>

        {/* User Info Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Logged in as: <span className="text-gray-700 font-medium">{userEmail}</span>
            {profile?.role && (
              <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-gray-600">{profile.role}</span>
            )}
          </p>
        </div>

      </div>
    </div>
  );
}
