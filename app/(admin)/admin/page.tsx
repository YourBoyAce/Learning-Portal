"use client";

import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Management Console</h1>
            <p className="text-sm text-gray-500 mt-1">
              Orchestrating the intellectual flow of Academic Atelier through data and media precision.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Export Reports
            </button>
            <button
              onClick={() => router.push("/admin/upload")}
              className="px-4 py-2 bg-[#174778] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
            >
              Upload Video
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Students */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-[#174778]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                +2.5% from last month
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900">12,482</div>
            <div className="text-sm text-gray-500 mt-1">Total Students</div>
          </div>

          {/* Active Courses */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-[#174778]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                +3 added this week
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900">156</div>
            <div className="text-sm text-gray-500 mt-1">Active Courses</div>
          </div>

          {/* System Health */}
          <div className="bg-[#174778] rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-white bg-white/20 px-2 py-1 rounded-full">
                Operational
              </span>
            </div>
            <div className="text-3xl font-bold text-white">99.9%</div>
            <div className="text-sm text-white/80 mt-1">System Health</div>
            <div className="mt-3 bg-white/20 rounded-full h-2">
              <div className="bg-white rounded-full h-2 w-[99.9%]"></div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Management Section */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
            </div>
            
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search scholars..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#174778]"
                />
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Scholar</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Enrollment</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "Dr. Julian Thorne", role: "Instructor", courses: "12 Courses", initial: "JT" },
                    { name: "Elena Rodriguez", role: "Student", courses: "4 Courses", initial: "ER" },
                    { name: "Marcus Chen", role: "Admin", courses: "Global Access", initial: "MC" },
                  ].map((user, index) => (
                    <tr key={index} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#174778] rounded-full flex items-center justify-center text-white text-sm font-semibold">
                            {user.initial}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.role === "Instructor" ? "bg-purple-100 text-purple-700" :
                          user.role === "Admin" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">{user.courses}</td>
                      <td className="py-4 px-4 text-right">
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={() => router.push("/admin/users")}
              className="mt-4 text-sm text-[#174778] font-medium hover:underline"
            >
              View all 12,482 users
            </button>
          </div>

          {/* Course Management Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Course Management</h2>
              <button
                onClick={() => router.push("/admin/courses")}
                className="text-sm text-[#174778] font-medium hover:underline"
              >
                View Catalog
              </button>
            </div>

            <div className="space-y-4">
              {[
                { title: "Advanced Architectural Systems", lessons: 24, color: "from-blue-400 to-blue-600" },
                { title: "Neural Networks & Deep Learning", lessons: 18, color: "from-purple-400 to-purple-600" },
                { title: "Quantum Computing Fundamentals", lessons: 32, color: "from-green-400 to-green-600" },
              ].map((course, index) => (
                <div key={index} className="border border-gray-200 rounded-lg overflow-hidden hover:border-[#174778] transition-colors cursor-pointer">
                  <div className={`h-24 bg-gradient-to-r ${course.color}`}></div>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">{course.title}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{course.lessons} Lessons</span>
                      <div className="flex gap-2">
                        <button className="text-xs text-[#174778] font-medium hover:underline">Content</button>
                        <span className="text-gray-300">•</span>
                        <button className="text-xs text-[#174778] font-medium hover:underline">Grades</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push("/admin/courses")}
              className="mt-6 w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:border-[#174778] hover:text-[#174778] transition-colors"
            >
              Create New Curriculum
            </button>
          </div>
        </div>

        {/* Bottom CTA Section */}
        <div className="mt-8 bg-gradient-to-r from-[#174778] to-[#1e5aa8] rounded-xl p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Automated Insights are ready</h3>
              <p className="text-white/80 text-sm">
                The Atelier AI engine has analyzed engagement metrics for the last 24 hours. Would you like to generate the scholarly performance report?
              </p>
            </div>
            <button className="px-6 py-3 bg-white text-[#174778] text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap">
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
