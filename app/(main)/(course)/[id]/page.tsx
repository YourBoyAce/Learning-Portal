export default function CourseDetail() {
  const lessons = [
    { title: "Introduction to the Course", duration: "5:30", completed: true },
    { title: "Setting Up Your Environment", duration: "12:15", completed: true },
    { title: "Core Concepts & Architecture", duration: "18:40", completed: true },
    { title: "Writing Your First Test", duration: "22:10", completed: false },
    { title: "Advanced Selectors", duration: "15:30", completed: false },
    { title: "Page Object Model", duration: "20:45", completed: false },
    { title: "API Mocking & Interception", duration: "16:20", completed: false },
    { title: "CI/CD Integration", duration: "14:50", completed: false },
    { title: "Final Project & Review", duration: "25:00", completed: false },
  ];

  const completedCount = lessons.filter((l) => l.completed).length;
  const progress = Math.round((completedCount / lessons.length) * 100);

  return (
    <div style={{ minHeight: "calc(100vh - 64px)", padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Course Header */}
        <div className="animate-fade-in-up" style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <span className="badge badge-violet">Testing</span>
            <span className="badge badge-blue">Intermediate</span>
          </div>
          <h1
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            <span className="gradient-text">Playwright</span> Mastery
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: "1rem" }}>
            End-to-end testing with Playwright — from basics to advanced CI/CD integration.
          </p>
        </div>

        {/* Content Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 24,
          }}
          className="md:grid-cols-[1fr_360px]"
        >
          {/* Video Area */}
          <div className="animate-fade-in-up delay-100">
            <div
              className="glass-card-static"
              style={{
                aspectRatio: "16/9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #0f0f1a, #1a1a2e)",
                overflow: "hidden",
                marginBottom: 24,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: "var(--gradient-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                    cursor: "pointer",
                    transition: "transform 0.3s, box-shadow 0.3s",
                    boxShadow: "var(--glow-violet)",
                  }}
                >
                  <span style={{ fontSize: "1.5rem", marginLeft: 4 }}>▶</span>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Select a lesson to start watching</p>
              </div>
            </div>

            {/* Progress Overview */}
            <div className="glass-card-static" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Your Progress</span>
                <span style={{ color: "var(--accent-violet)", fontWeight: 700, fontSize: "0.95rem" }}>
                  {progress}%
                </span>
              </div>
              <div className="progress-bar" style={{ height: 8, marginBottom: 12 }}>
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                {completedCount} of {lessons.length} lessons completed
              </p>
            </div>
          </div>

          {/* Lessons Sidebar */}
          <div className="animate-fade-in-up delay-200">
            <div className="glass-card-static" style={{ padding: 0, overflow: "hidden" }}>
              <div
                style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid var(--border-glass)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>Lessons</h3>
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                  }}
                >
                  {lessons.length} chapters
                </span>
              </div>

              <div style={{ maxHeight: 520, overflowY: "auto" }}>
                {lessons.map((lesson, i) => (
                  <div
                    key={lesson.title}
                    style={{
                      padding: "16px 24px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      borderBottom: i < lessons.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      cursor: "pointer",
                      transition: "background 0.2s ease",
                      background: i === 3 ? "rgba(124, 58, 237, 0.08)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (i !== 3) (e.currentTarget as HTMLDivElement).style.background = "var(--surface-glass)";
                    }}
                    onMouseLeave={(e) => {
                      if (i !== 3) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }}
                  >
                    {/* Status icon */}
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        flexShrink: 0,
                        background: lesson.completed
                          ? "var(--gradient-primary)"
                          : i === 3
                          ? "rgba(124, 58, 237, 0.2)"
                          : "var(--surface-glass)",
                        color: lesson.completed || i === 3 ? "white" : "var(--text-muted)",
                        fontWeight: 700,
                      }}
                    >
                      {lesson.completed ? "✓" : i + 1}
                    </div>

                    {/* Lesson info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.88rem",
                          fontWeight: i === 3 ? 600 : 500,
                          color: lesson.completed ? "var(--text-secondary)" : "var(--text-primary)",
                          textDecoration: lesson.completed ? "line-through" : "none",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {lesson.title}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                        {lesson.duration}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}