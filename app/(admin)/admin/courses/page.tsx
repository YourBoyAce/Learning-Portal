"use client";

import { useRouter } from "next/navigation";

export default function AdminCourses() {
  const router = useRouter();

  const courses = [
    { id: 1, title: "Playwright Mastery", students: 1420, status: "Published", lessons: 25, revenue: "$14,200" },
    { id: 2, title: "Gen AI Fundamentals", students: 2310, status: "Published", lessons: 20, revenue: "$23,100" },
    { id: 3, title: "Selenium Advanced", students: 980, status: "Published", lessons: 30, revenue: "$9,800" },
    { id: 4, title: "API Testing with Postman", students: 1850, status: "Draft", lessons: 15, revenue: "$0" },
    { id: 5, title: "Performance Testing", students: 720, status: "Published", lessons: 18, revenue: "$7,200" },
  ];

  return (
    <div style={{ minHeight: "calc(100vh - 64px)", padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-[#174778] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="page-header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}>
              <h1>
                <span className="gradient-text">Manage</span> Courses
              </h1>
              <p>Create, edit, and publish your course catalog.</p>
            </div>
          </div>
          <button className="btn-primary" style={{ padding: "12px 28px" }}>
            + New Course
          </button>
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {[
            { label: "Total Courses", value: "5", icon: "📚", color: "icon-violet" },
            { label: "Total Students", value: "7,280", icon: "👥", color: "icon-blue" },
            { label: "Published", value: "4", icon: "✅", color: "icon-emerald" },
            { label: "Revenue", value: "$54,300", icon: "💰", color: "icon-amber" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`glass-card animate-fade-in-up delay-${(i + 1) * 100}`}
              style={{ padding: 20, display: "flex", alignItems: "center", gap: 14 }}
            >
              <div className={`icon-wrapper ${stat.color}`}>
                <span>{stat.icon}</span>
              </div>
              <div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{stat.value}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 500 }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Courses Table */}
        <div className="glass-card-static animate-fade-in-up delay-300" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--border-glass)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>All Courses</h3>
            <input
              type="text"
              placeholder="Search..."
              className="glass-input"
              style={{ maxWidth: 240, padding: "8px 14px", fontSize: "0.85rem" }}
            />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Lessons</th>
                  <th>Students</th>
                  <th>Revenue</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{course.title}</td>
                    <td>{course.lessons}</td>
                    <td>{course.students.toLocaleString()}</td>
                    <td>{course.revenue}</td>
                    <td>
                      <span
                        className={`badge ${course.status === "Published" ? "badge-emerald" : "badge-amber"}`}
                      >
                        {course.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: "6px 14px", fontSize: "0.78rem", borderRadius: "8px" }}
                        >
                          Edit
                        </button>
                        <button
                          style={{
                            padding: "6px 14px",
                            fontSize: "0.78rem",
                            borderRadius: "8px",
                            background: "rgba(244, 63, 94, 0.12)",
                            color: "#fb7185",
                            border: "1px solid rgba(244, 63, 94, 0.2)",
                            cursor: "pointer",
                            fontWeight: 600,
                            transition: "all 0.2s ease",
                          }}
                        >
                          Delete
                        </button>
                      </div>
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