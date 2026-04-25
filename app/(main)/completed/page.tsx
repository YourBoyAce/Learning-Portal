"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MoreVertical, TrendingUp, Users, Award, BookOpen, ChevronDown, Grid3X3, Table, Star, BarChart3 } from "lucide-react";
import { supabase } from "@/app/lib/supabase";

interface CompletedCourse {
  id: number;
  title: string;
  description: string;
  completionRate: number;
  totalStudents: number;
  duration: string;
  completionDate: string;
  performance: "High" | "Medium" | "Low";
  category: string;
}

interface MainCourse {
  id: number;
  title: string;
  description: string;
  category?: string;
  created_at: string;
}

export default function Completed() {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [completionFilter, setCompletionFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [performanceFilter, setPerformanceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [loading, setLoading] = useState(true);
  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
  const [stats, setStats] = useState({
    totalCompleted: 0,
    totalGraduated: 0,
    avgCompletionRate: 0,
    certificatesIssued: 0,
    avgRating: 0,
    topCourse: "",
    topCourseRate: 0
  });

  useEffect(() => {
    loadCompletedCourses();
  }, []);

  const loadCompletedCourses = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all courses
      const { data: courses, error: coursesError } = await supabase
        .from("maincourses")
        .select("*")
        .order("created_at", { ascending: false });

      if (coursesError) {
        console.error("Error fetching courses:", coursesError);
        setLoading(false);
        return;
      }

      // Fetch user's video progress to determine completed courses
      const { data: userProgress, error: progressError } = await supabase
        .from("user_video_progress")
        .select("*")
        .eq("user_id", user.id);

      if (progressError) {
        console.error("Error fetching user progress:", progressError);
        setLoading(false);
        return;
      }

      // Calculate completion per course
      const coursesWithProgress = (courses || []).map((course: MainCourse) => {
        const courseVideos = userProgress?.filter(p => p.course_id === course.id) || [];
        const totalVideosInCourse = courseVideos.length;
        const completedVideos = courseVideos.filter(p => p.completed).length;
        const completionRate = totalVideosInCourse > 0 
          ? Math.round((completedVideos / totalVideosInCourse) * 100) 
          : 0;

        // Determine if course is completed (>= 80% completion)
        const isCompleted = completionRate >= 80;

        return {
          ...course,
          completionRate,
          isCompleted,
          totalStudents: Math.floor(Math.random() * 300) + 50, // Placeholder - would come from enrollment table
          duration: `${Math.floor(Math.random() * 8) + 4} Weeks`, // Placeholder - would come from course metadata
          completionDate: new Date(course.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          performance: completionRate >= 90 ? "High" : completionRate >= 75 ? "Medium" : "Low" as "High" | "Medium" | "Low",
          category: course.category || "General"
        };
      });

      // Filter only completed courses
      const completed = coursesWithProgress
        .filter((c: MainCourse & { isCompleted: boolean; completionRate: number; totalStudents: number; duration: string; completionDate: string; performance: "High" | "Medium" | "Low"; category: string }) => c.isCompleted)
        .map((c: MainCourse & { isCompleted: boolean; completionRate: number; totalStudents: number; duration: string; completionDate: string; performance: "High" | "Medium" | "Low"; category: string }) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          completionRate: c.completionRate,
          totalStudents: c.totalStudents,
          duration: c.duration,
          completionDate: c.completionDate,
          performance: c.performance,
          category: c.category
        }));

      setCompletedCourses(completed);

      // Calculate stats
      const totalCompleted = completed.length;
      const avgCompletionRate = completed.length > 0
        ? Math.round(completed.reduce((sum, c) => sum + c.completionRate, 0) / completed.length)
        : 0;

      // Find top performing course
      const topCourse = completed.length > 0
        ? completed.reduce((prev, current) => (prev.completionRate > current.completionRate) ? prev : current)
        : null;

      setStats({
        totalCompleted,
        totalGraduated: Math.floor(Math.random() * 1500) + 500, // Placeholder
        avgCompletionRate,
        certificatesIssued: totalCompleted * Math.floor(Math.random() * 20) + 10, // Placeholder
        avgRating: parseFloat((Math.random() * 1 + 3.5).toFixed(1)), // Placeholder
        topCourse: topCourse?.title || "",
        topCourseRate: topCourse?.completionRate || 0
      });

    } catch (error) {
      console.error("Error loading completed courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case "High": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Medium": return "bg-amber-50 text-amber-700 border-amber-200";
      case "Low": return "bg-rose-50 text-rose-700 border-rose-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#174778] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading completed courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-3">
              <span className="hover:text-[#174778] cursor-pointer">ADMIN PORTAL</span>
              <span className="text-gray-300">/</span>
              <span className="hover:text-[#174778] cursor-pointer">COURSE MANAGEMENT</span>
              <span className="text-gray-300">/</span>
              <span className="text-[#174778]">COMPLETED COURSES</span>
            </div>

            {/* Title & Subtitle */}
            <h1 className="text-3xl font-bold text-[#174778] mb-2 tracking-tight">
              Completed Courses
            </h1>
            <p className="text-sm text-gray-600 max-w-2xl leading-relaxed">
              Review finalized learning tracks, monitor completion metrics, and analyze scholar performance across concluded curricula.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Completed Courses */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                New
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{stats.totalCompleted}</h3>
            <p className="text-sm text-gray-500 font-medium">Total Completed Courses</p>
          </div>

          {/* Total Graduated Scholars */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                Active
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{stats.totalGraduated}</h3>
            <p className="text-sm text-gray-500 font-medium">Total Graduated Scholars</p>
          </div>

          {/* Average Completion Rate */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-violet-600" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{stats.avgCompletionRate}%</h3>
            <p className="text-sm text-gray-500 font-medium mb-3">Average Completion Rate</p>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-violet-500 to-blue-500 h-full rounded-full" style={{ width: `${stats.avgCompletionRate}%` }} />
            </div>
          </div>

          {/* Top Performing Course */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-amber-600" />
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                {stats.topCourseRate}% completion
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1 leading-tight">
              {stats.topCourse || "No courses yet"}
            </h3>
            <p className="text-sm text-gray-500 font-medium">Top Performing Course</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search completed courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 border-gray-200 bg-gray-50 focus:bg-white"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              {/* Completion Date Filter */}
              <div className="relative">
                <select
                  value={completionFilter}
                  onChange={(e) => setCompletionFilter(e.target.value)}
                  className="appearance-none h-10 px-4 pr-10 border border-gray-200 rounded-lg bg-gray-50 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#174778] focus:border-transparent cursor-pointer hover:bg-white"
                >
                  <option value="all">All Dates</option>
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="last3Months">Last 3 Months</option>
                  <option value="thisYear">This Year</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Category Filter */}
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="appearance-none h-10 px-4 pr-10 border border-gray-200 rounded-lg bg-gray-50 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#174778] focus:border-transparent cursor-pointer hover:bg-white"
                >
                  <option value="all">All Categories</option>
                  <option value="AI / ML">AI / ML</option>
                  <option value="Humanities">Humanities</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Design">Design</option>
                  <option value="Ethics">Ethics</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Performance Filter */}
              <div className="relative">
                <select
                  value={performanceFilter}
                  onChange={(e) => setPerformanceFilter(e.target.value)}
                  className="appearance-none h-10 px-4 pr-10 border border-gray-200 rounded-lg bg-gray-50 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#174778] focus:border-transparent cursor-pointer hover:bg-white"
                >
                  <option value="all">All Performance</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none h-10 px-4 pr-10 border border-gray-200 rounded-lg bg-gray-50 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#174778] focus:border-transparent cursor-pointer hover:bg-white"
                >
                  <option value="recent">Most Recent</option>
                  <option value="completion">Highest Completion</option>
                  <option value="enrolled">Most Enrolled</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* View Toggle */}
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 ${viewMode === "grid" ? "bg-[#174778] text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-2 ${viewMode === "table" ? "bg-[#174778] text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                >
                  <Table className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Completed Courses Grid */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedCourses.map((course) => (
              <div key={course.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Thumbnail */}
                <div className="h-40 bg-gradient-to-br from-[#174778] to-[#2563EB] relative">
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-700 text-xs font-bold uppercase tracking-wider border border-emerald-500/30">
                      Completed
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
                      {course.category}
                    </span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BookOpen className="w-16 h-16 text-white/30" />
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 text-lg mb-2 leading-tight">
                    {course.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                    {course.description}
                  </p>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-gray-100">
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Completion</p>
                      <p className="text-sm font-bold text-gray-900">{course.completionRate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Students</p>
                      <p className="text-sm font-bold text-gray-900">{course.totalStudents}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Duration</p>
                      <p className="text-sm font-bold text-gray-900">{course.duration}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500">Progress</span>
                      <span className="text-xs font-bold text-[#174778]">{course.completionRate}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#174778] to-[#2563EB] h-full rounded-full transition-all duration-500"
                        style={{ width: `${course.completionRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-[#174778] hover:bg-[#113a63] text-white text-xs font-medium h-8">
                        View Report
                      </Button>
                      <Button variant="outline" size="sm" className="border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium h-8">
                        View Students
                      </Button>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Course Name</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Completion Rate</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Students Enrolled</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Completion Date</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Performance</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {completedCourses.map((course) => (
                  <tr key={course.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 text-sm">{course.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{course.category}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-20 bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-[#174778] to-[#2563EB] h-full rounded-full"
                            style={{ width: `${course.completionRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-900">{course.completionRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">{course.totalStudents} Scholars</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{course.completionDate}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getPerformanceColor(course.performance)}`}>
                        {course.performance}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-8 text-xs font-medium border-gray-200">
                          Report
                        </Button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Insights Section */}
        <div className="bg-gradient-to-r from-[#174778] to-[#2563EB] rounded-2xl p-6 shadow-sm text-white">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-5 h-5" />
                <h3 className="font-bold text-lg">Completion Insights</h3>
              </div>
              <p className="text-white/90 text-sm leading-relaxed mb-4">
                AI analysis indicates a 23% increase in course completion when interactive modules are included. Courses with hands-on projects show significantly higher engagement rates.
              </p>
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-white/70 font-semibold uppercase tracking-wider mb-1">Best Month</p>
                  <p className="text-sm font-bold">December 2024</p>
                </div>
                <div>
                  <p className="text-xs text-white/70 font-semibold uppercase tracking-wider mb-1">Drop-off Point</p>
                  <p className="text-sm font-bold">Week 3</p>
                </div>
              </div>
            </div>
            <div className="lg:w-64 flex items-center justify-center">
              {/* Mini Chart Visualization */}
              <div className="flex items-end gap-2 h-24">
                {[40, 55, 45, 70, 65, 80, 75, 90, 85, 95, 88, 92].map((height, i) => (
                  <div
                    key={i}
                    className="w-4 bg-white/30 rounded-t hover:bg-white/50 transition-colors"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Summary Bar */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                <Award className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-sm text-gray-700">
                You have successfully completed <span className="font-bold text-gray-900">{stats.totalCompleted} courses</span> with an average satisfaction score of <span className="font-bold text-gray-900">{stats.avgRating}/5</span>.
              </p>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#174778]">{stats.certificatesIssued}</p>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Certificates Issued</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#174778] flex items-center gap-1">
                  {stats.avgRating} <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </p>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Avg Rating</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}