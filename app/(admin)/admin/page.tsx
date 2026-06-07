"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Loader2, Clock, LogIn, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY, TYPOGRAPHY_CLASSES } from "@/app/styles/typography";

import Image from "next/image";

interface LoginLog {
  userId: string;
  userName: string;
  email: string;
  loginTimes: string[];
  loginCount: number;
  totalSeconds: number;
}

export default function AdminDashboard() {
  const router = useRouter();

  const [courses, setCourses] = useState<any[]>([]);
  const [activeCoursesCount, setActiveCoursesCount] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.access_token) {
          const res = await fetch("/api/admin/courses", {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
          });
          const result = await res.json().catch(() => null);
          if (res.ok && Array.isArray(result?.courses)) {
            const sortedCourses = result.courses.sort(
              (a: any, b: any) =>
                new Date(b.created_at || 0).getTime() -
                new Date(a.created_at || 0).getTime(),
            );
            setCourses(sortedCourses.slice(0, 3));
            setActiveCoursesCount(result.courses.length);
          }
        }

        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (profiles) {
          const students = profiles.filter(
            (p) => p.role?.toLowerCase() !== "admin",
          );
          setTotalStudents(students.length);
          setUsers(students.slice(0, 5));
        }

        // Fetch today's login logs
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: logs } = await supabase
          .from("user_login_logs")
          .select("user_id, logged_in_at, session_duration_seconds")
          .gte("logged_in_at", todayStart.toISOString())
          .order("logged_in_at", { ascending: false });

        if (logs && logs.length > 0 && profiles) {
          const profileMap = new Map<string, any>();
          (profiles as any[]).forEach((p) => profileMap.set(p.id, p));

          const grouped = new Map<string, { times: string[]; totalSec: number }>();
          for (const log of logs) {
            const uid = log.user_id;
            if (!grouped.has(uid)) {
              grouped.set(uid, { times: [], totalSec: 0 });
            }
            const g = grouped.get(uid)!;
            g.times.push(log.logged_in_at);
            g.totalSec += log.session_duration_seconds || 0;
          }

          const mapped: LoginLog[] = [];
          grouped.forEach((val, uid) => {
            const p = profileMap.get(uid);
            mapped.push({
              userId: uid,
              userName: p?.full_name || p?.email?.split("@")[0] || "Unknown",
              email: p?.email || "—",
              loginTimes: val.times,
              loginCount: val.times.length,
              totalSeconds: val.totalSec,
            });
          });
          setLoginLogs(mapped);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };
  const stats = [
    {
      label: "Total Scholars",
      value: totalStudents.toString(),
      icon: ICONS.USERS,
    },
    {
      label: "Active Courses",
      value: courses.length.toString(),
      icon: ICONS.GLOBE,
    },

  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>
              Management Console
            </h1>
            <p className={TYPOGRAPHY.BODY.fontSize + " " + TYPOGRAPHY.BODY.lineHeight + " " + TYPOGRAPHY.BODY.fontWeight + " text-gray-600"}>
              Orchestrating the intellectual flow of Academic Atelier through data
              and media precision.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1  mb-8 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center gap-4"
            >
              <div className="flex items-center justify-center shrink-0">
                <Image
                  src={stat.icon}
                  alt={stat.label}
                  width={30}
                  height={30}
                />
              </div>

              <div className="flex flex-col">
                <span
                  className="text-2xl font-bold"
                  style={{
                    color: "var(--color-primary)",
                    fontFamily: "var(--font-primary)",
                  }}
                >
                  {stat.value}
                </span>

                <span
                  className="text-sm"
                  style={{
                    color: "var(--color-text-secondary)",
                    fontFamily: "var(--font-primary)",
                  }}
                >
                  {stat.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Management Section */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 flex flex-col min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
                Recent Users
              </h2>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      Scholar
                    </th>
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      Role
                    </th>
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  )}
                  {!loading && users.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-400 text-sm">
                        No non-admin users found.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center text-white text-sm font-semibold uppercase">
                              {(user.full_name || user.email || "U")
                                .charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span
                                style={{
                                  fontSize: TYPOGRAPHY.BODY.fontSize,
                                  lineHeight: TYPOGRAPHY.BODY.lineHeight,
                                  fontWeight: TYPOGRAPHY.H2.fontWeight,
                                }}
                                className="text-brand-heading"
                              >
                                {user.full_name || "Unknown"}
                              </span>
                              <span className={TYPOGRAPHY_CLASSES.CAPTION}>
                                {user.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase rounded-md border ${user.role?.toLowerCase() === "instructor"
                              ? "bg-purple-50 text-purple-700 border-purple-100"
                              : "bg-gray-50 text-gray-700 border-gray-200"
                              }`}
                          >
                            {user.role || "User"}
                          </span>
                        </td>
                        <td style={{
                          fontSize: TYPOGRAPHY.BODY.fontSize,
                          lineHeight: TYPOGRAPHY.BODY.lineHeight,
                          fontWeight: TYPOGRAPHY.H2.fontWeight,
                        }}
                          className="text-brand-heading"
                        >
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {totalStudents > 5 && (
              <Button
                onClick={() => router.push("/admin/users")}
                className="mt-6 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-semibold hover:bg-gray-100 hover:text-brand-primary transition-colors"
              >
                View all {totalStudents} scholars
              </Button>
            )}
          </div>

          {/* Course Management Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 flex flex-col min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
                Recently Added Courses
              </h2>
              <button
                onClick={() => router.push("/admin/courses")}
                className="text-sm text-brand-primary font-medium hover:underline"
              >
                View Catalog
              </button>
            </div>

            <div className="space-y-4 flex-1">
              {loading && (
                <div className="py-8 text-center text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              )}
              {!loading && courses.length === 0 && (
                <div className="py-8 text-center text-gray-400 text-sm">
                  No courses found.
                </div>
              )}
              {!loading &&
                courses.map((course) => (
                  <div
                    key={course.id}
                    onClick={() => router.push("/admin/courses")}
                    className="border border-gray-200 rounded-lg overflow-hidden hover:border-brand-primary hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="h-20 bg-gradient-to-br from-brand-primary to-[#2563eb] relative overflow-hidden">
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:12px_12px]"></div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-20 transform group-hover:scale-110 transition-transform duration-500">
                        <Image src={ICONS.BOOKLIGHT} alt="Book" width={40} height={40} />
                      </div>
                    </div>
                    <div className="p-4">
                      <p
                        className="text-copy-navy leading-snug line-clamp-2 flex-1"
                        style={{ fontWeight: "semibold", fontSize: "14px" }}
                      >
                        {course.title}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">
                          {new Date(course.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Today's Login Analytics */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                <LogIn className="w-5 h-5 text-brand-primary" />
              </div>
              <div>
                <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>Today&apos;s Login Analytics</h2>
                <p className="text-xs text-gray-500">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:flex sm:items-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-brand-primary">{loginLogs.length}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Users Today</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{loginLogs.reduce((a, l) => a + l.loginCount, 0)}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Logins</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Scholar</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Login Times</th>
                  <th className="text-center py-3 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Times Logged In</th>
                  <th className="text-center py-3 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Time Spent</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                )}
                {!loading && loginLogs.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-400 text-sm">No login activity recorded today.</td></tr>
                )}
                {!loading && loginLogs.map((log) => (
                  <tr key={log.userId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm">
                          {log.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{log.userName}</p>
                          <p className="text-xs text-gray-500">{log.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {log.loginTimes.slice(0, 5).map((t, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-brand-primary text-[10px] font-bold rounded-md border border-blue-100">
                            <Clock className="w-3 h-3" />
                            {new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </span>
                        ))}
                        {log.loginTimes.length > 5 && (
                          <span className="text-[10px] text-gray-400 font-semibold">+{log.loginTimes.length - 5} more</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-md border border-emerald-100">
                        <LogIn className="w-3 h-3" />
                        {log.loginCount}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-md border border-amber-100">
                        <Timer className="w-3 h-3" />
                        {formatDuration(log.totalSeconds)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
