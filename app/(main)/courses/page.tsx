"use client";

import { useRouter } from "next/navigation";

export default function Courses() {
  const router = useRouter();

  const courses = [
    {
      title: "Playwright Mastery",
      description: "End-to-end testing with Playwright — from basics to advanced CI/CD integration.",
      lessons: 25,
      duration: "12h 30m",
      level: "Intermediate",
      category: "Testing",
      enrolled: 1420,
      badgeColor: "badge-violet",
    },
    {
      title: "Gen AI Fundamentals",
      description: "Explore generative AI concepts, prompt engineering, and building AI-powered tools.",
      lessons: 20,
      duration: "10h 15m",
      level: "Beginner",
      category: "AI / ML",
      enrolled: 2310,
      badgeColor: "badge-cyan",
    },
    {
      title: "Selenium Advanced",
      description: "Advanced Selenium WebDriver techniques, Page Object Model, and framework design.",
      lessons: 30,
      duration: "15h 45m",
      level: "Advanced",
      category: "Testing",
      enrolled: 980,
      badgeColor: "badge-emerald",
    },
    {
      title: "API Testing with Postman",
      description: "REST & GraphQL API testing, automation with Newman, and CI/CD pipeline integration.",
      lessons: 20,
      duration: "8h 20m",
      level: "Beginner",
      category: "API",
      enrolled: 1850,
      badgeColor: "badge-blue",
    },
    {
      title: "Performance Testing",
      description: "Load testing with JMeter and k6 — identify bottlenecks and optimize applications.",
      lessons: 18,
      duration: "9h 10m",
      level: "Intermediate",
      category: "Performance",
      enrolled: 720,
      badgeColor: "badge-amber",
    },
    {
      title: "Mobile Testing with Appium",
      description: "Cross-platform mobile automation for iOS and Android using Appium framework.",
      lessons: 22,
      duration: "11h 00m",
      level: "Advanced",
      category: "Mobile",
      enrolled: 640,
      badgeColor: "badge-rose",
    },
  ];

  return (
    <div style={{ minHeight: "calc(100vh - 64px)", padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div className="page-header animate-fade-in-up flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-[#174778] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex-1">
            <h1>
              Explore <span className="gradient-text">Courses</span>
            </h1>
            <p>Choose from our expert-crafted curriculum and start learning today.</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="animate-fade-in-up delay-100" style={{ marginBottom: 32 }}>
          <div className="glass-card-static" style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>🔍</span>
            <input
              type="text"
              placeholder="Search courses..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: "0.95rem",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              {["All", "Testing", "AI / ML", "API"].map((filter) => (
                <button
                  key={filter}
                  className={filter === "All" ? "badge badge-violet" : "badge"}
                  style={{
                    cursor: "pointer",
                    border: "none",
                    background: filter === "All" ? undefined : "var(--surface-glass)",
                    color: filter === "All" ? undefined : "var(--text-secondary)",
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Course Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 24,
          }}
        >
          {courses.map((course, i) => (
            <a
              key={course.title}
              href={`/course-${i + 1}`}
              style={{ textDecoration: "none" }}
            >
              <div
                className={`glass-card animate-fade-in-up delay-${Math.min((i + 1) * 100, 600)}`}
                style={{ padding: 0, overflow: "hidden", cursor: "pointer", height: "100%" }}
              >
                {/* Thumbnail placeholder */}
                <div
                  style={{
                    height: 160,
                    background: `linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  <span style={{ fontSize: "2.5rem", opacity: 0.3 }}>▶</span>
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                    }}
                  >
                    <span className={`badge ${course.badgeColor}`}>{course.category}</span>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                    }}
                  >
                    <span className="badge" style={{ background: "rgba(0,0,0,0.5)", color: "var(--text-primary)" }}>
                      {course.level}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: "20px 24px 24px" }}>
                  <h3
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      marginBottom: 8,
                    }}
                  >
                    {course.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.6,
                      marginBottom: 20,
                    }}
                  >
                    {course.description}
                  </p>

                  {/* Meta */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                      borderTop: "1px solid var(--border-glass)",
                      paddingTop: 16,
                    }}
                  >
                    <span>📖 {course.lessons} lessons</span>
                    <span>⏱️ {course.duration}</span>
                    <span>👥 {course.enrolled.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}