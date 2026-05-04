"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Users, BookOpen, Search, Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();

  const [courses, setCourses] = useState<any[]>([]);
  const [activeCoursesCount, setActiveCoursesCount] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);

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
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Management Console
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Orchestrating the intellectual flow of Academic Atelier through data
              and media precision.
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Total Students */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-7 h-7 text-[#174778]" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" /> : totalStudents}
              </div>
              <div className="text-sm font-medium text-gray-500 mt-1">
                Total Scholars
              </div>
            </div>
          </div>

          {/* Active Courses */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
              <BookOpen className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" /> : activeCoursesCount}
              </div>
              <div className="text-sm font-medium text-gray-500 mt-1">
                Active Courses
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Management Section */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Users
              </h2>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Scholar
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                            <div className="w-10 h-10 bg-[#174778] rounded-full flex items-center justify-center text-white text-sm font-semibold uppercase">
                              {(user.full_name || user.email || "U")
                                .charAt(0)}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-900 block">
                                {user.full_name || "Unknown"}
                              </span>
                              <span className="text-xs text-gray-500 block">
                                {user.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase rounded-md border ${
                              user.role?.toLowerCase() === "instructor"
                                ? "bg-purple-50 text-purple-700 border-purple-100"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                            }`}
                          >
                            {user.role || "User"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {totalStudents > 5 && (
              <button
                onClick={() => router.push("/admin/users")}
                className="mt-6 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-semibold hover:bg-gray-100 hover:text-[#174778] transition-colors"
              >
                View all {totalStudents} scholars
              </button>
            )}
          </div>

          {/* Course Management Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Recently Added Courses
              </h2>
              <button
                onClick={() => router.push("/admin/courses")}
                className="text-sm text-[#174778] font-medium hover:underline"
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
                    className="border border-gray-200 rounded-lg overflow-hidden hover:border-[#174778] hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="h-20 bg-gradient-to-br from-[#174778] to-[#2563eb] relative overflow-hidden">
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:12px_12px]"></div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-20 transform group-hover:scale-110 transition-transform duration-500">
                        <BookOpen className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-[#174778] transition-colors">
                        {course.title}
                      </h3>
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
      </div>
    </div>
  );
}
