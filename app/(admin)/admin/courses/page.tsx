"use client";

import { useState } from "react";

interface Course {
  id: number;
  title: string;
  description: string;
  students: number;
  status: "Published" | "Draft";
  lessons: number;
  revenue: string;
  category: string;
  duration: string;
  level: "Beginner" | "Intermediate" | "Advanced";
}

export default function AdminCourses() {
  const textPrimary = "#000";
  const textSecondary = "#1f2937";
  const textMuted = "#334155";

  const courses = [
    {
      id: 1,
      title: "Playwright Mastery",
      students: 1420,
      status: "Published",
      lessons: 25,
      revenue: "$14,200",
    },
    {
      id: 2,
      title: "Gen AI Fundamentals",
      students: 2310,
      status: "Published",
      lessons: 20,
      revenue: "$23,100",
    },
    {
      id: 3,
      title: "Selenium Advanced",
      students: 980,
      status: "Published",
      lessons: 30,
      revenue: "$9,800",
    },
    {
      id: 4,
      title: "API Testing with Postman",
      students: 1850,
      status: "Draft",
      lessons: 15,
      revenue: "$0",
    },
    {
      id: 5,
      title: "Performance Testing",
      students: 720,
      status: "Published",
      lessons: 18,
      revenue: "$7,200",
    },
  ];

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
    setEditedCourse({ ...course });
  };

  const handleSaveCourse = () => {
    // In a real app, this would save to a database
    setSelectedCourse(editedCourse);
    // Show success message
  };

  const handleCreateNew = () => {
    const newCourse: Course = {
      id: courses.length + 1,
      title: "",
      description: "",
      students: 0,
      status: "Draft",
      lessons: 0,
      revenue: "$0",
      category: "",
      duration: "",
      level: "Beginner"
    };
    setSelectedCourse(newCourse);
    setEditedCourse({ ...newCourse });
  };

  return (
    <div
      className="courses-admin-page"
      style={{ minHeight: "calc(100vh - 64px)", padding: "40px 24px 80px" }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div
          className="animate-fade-in-up"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 32,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div
            className="page-header"
            style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}
          >
            <h1 style={{ color: textPrimary }}>
              <span className="gradient-text">Manage</span> Courses
            </h1>
            <p style={{ color: textSecondary }}>
              Create, edit, and publish your course catalog.
            </p>
          </div>
          <button 
            onClick={handleCreateNew}
            className="mt-4 md:mt-0 bg-[#2563EB] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Course
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
            {
              label: "Total Courses",
              value: "5",
              icon: "📚",
              color: "icon-violet",
            },
            {
              label: "Total Students",
              value: "7,280",
              icon: "👥",
              color: "icon-blue",
            },
            {
              label: "Published",
              value: "4",
              icon: "✅",
              color: "icon-emerald",
            },
            {
              label: "Revenue",
              value: "$54,300",
              icon: "💰",
              color: "icon-amber",
            },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`glass-card animate-fade-in-up delay-${(i + 1) * 100}`}
              style={{
                padding: 20,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div className={`icon-wrapper ${stat.color}`}>
                <span>{stat.icon}</span>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 800,
                    color: textPrimary,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: textMuted,
                    fontWeight: 500,
                  }}
                >
                  {stat.label}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Course Details/Edit */}
          <div className="lg:col-span-2">
            {editedCourse ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                
                {/* Edit Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editedCourse.id > courses.length ? "Create New Course" : "Edit Course"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      editedCourse.status === "Published" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {editedCourse.status}
                    </span>
                  </div>
                </div>

        {/* Courses Table */}
        <div
          className="glass-card-static animate-fade-in-up delay-300"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--border-glass)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3
              style={{ fontWeight: 700, fontSize: "1rem", color: textPrimary }}
            >
              All Courses
            </h3>
            <input
              type="text"
              placeholder="Search..."
              className="glass-input"
              style={{
                maxWidth: 240,
                padding: "8px 14px",
                fontSize: "0.85rem",
                color: textPrimary,
                background: "#fff",
                borderColor: "#cbd5e1",
              }}
            />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th style={{ color: textPrimary }}>Course</th>
                  <th style={{ color: textPrimary }}>Lessons</th>
                  <th style={{ color: textPrimary }}>Students</th>
                  <th style={{ color: textPrimary }}>Revenue</th>
                  <th style={{ color: textPrimary }}>Status</th>
                  <th style={{ color: textPrimary }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td style={{ fontWeight: 600, color: textPrimary }}>
                      {course.title}
                    </td>
                    <td style={{ color: textPrimary }}>{course.lessons}</td>
                    <td style={{ color: textPrimary }}>
                      {course.students.toLocaleString()}
                    </td>
                    <td style={{ color: textPrimary }}>{course.revenue}</td>
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
                          style={{
                            padding: "6px 14px",
                            fontSize: "0.78rem",
                            borderRadius: "8px",
                            color: textPrimary,
                            background: "#fff",
                            borderColor: "#cbd5e1",
                          }}
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
