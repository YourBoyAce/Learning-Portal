export default function Home() {
  return (
    <main style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>

      {/* ── Hero Section ── */}
      <section
        style={{
          position: "relative",
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px",
          background: "var(--gradient-hero)",
        }}
      >
        {/* Decorative Orbs */}
        <div className="orb orb-violet animate-float" style={{ width: 400, height: 400, top: -100, right: -100 }} />
        <div className="orb orb-blue animate-float delay-300" style={{ width: 300, height: 300, bottom: -50, left: -80 }} />
        <div className="orb orb-cyan animate-pulse-glow" style={{ width: 200, height: 200, top: "40%", left: "60%" }} />

        <div style={{ maxWidth: 800, textAlign: "center", position: "relative", zIndex: 1 }}>
          {/* Badge */}
          <div className="animate-fade-in-up" style={{ marginBottom: 24 }}>
            <span className="badge badge-violet" style={{ fontSize: "0.85rem", padding: "6px 16px" }}>
              🚀 The future of learning is here
            </span>
          </div>

          {/* Headline */}
          <h1
            className="gradient-text animate-fade-in-up delay-100"
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              marginBottom: 24,
            }}
          >
            Learn. Practice.
            <br />
            Get Hired.
          </h1>

          {/* Subtitle */}
          <p
            className="animate-fade-in-up delay-200"
            style={{
              fontSize: "clamp(1rem, 2vw, 1.25rem)",
              color: "var(--text-secondary)",
              maxWidth: 560,
              margin: "0 auto 40px",
              lineHeight: 1.7,
            }}
          >
            A premium platform for structured learning, hands-on practice,
            and career advancement in test automation & software engineering.
          </p>

          {/* CTAs */}
          <div
            className="animate-fade-in-up delay-300"
            style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}
          >
            <a href="/courses" style={{ textDecoration: "none" }}>
              <button className="btn-primary" style={{ padding: "14px 36px", fontSize: "1rem" }}>
                Explore Courses
              </button>
            </a>
            <a href="/login" style={{ textDecoration: "none" }}>
              <button className="btn-secondary" style={{ padding: "14px 36px", fontSize: "1rem" }}>
                Sign In →
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section style={{ padding: "100px 24px", position: "relative" }}>
        <div className="orb orb-violet animate-pulse-glow" style={{ width: 300, height: 300, top: 0, right: "20%" }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
          {/* Section Header */}
          <div className="animate-fade-in-up" style={{ textAlign: "center", marginBottom: 64 }}>
            <span className="badge badge-blue" style={{ marginBottom: 16, display: "inline-block" }}>Features</span>
            <h2
              style={{
                fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
              }}
            >
              Everything you need to{" "}
              <span className="gradient-text">level up</span>
            </h2>
            <p style={{ color: "var(--text-secondary)", marginTop: 12, fontSize: "1.05rem", maxWidth: 500, margin: "12px auto 0" }}>
              From beginner to expert, our platform guides you every step of the way.
            </p>
          </div>

          {/* Feature Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 24,
            }}
          >
            {[
              {
                icon: "📚",
                title: "Structured Courses",
                description: "Expert-crafted curriculum covering Playwright, Selenium, Gen AI, and more.",
                color: "icon-violet",
              },
              {
                icon: "🎥",
                title: "HD Video Lessons",
                description: "Crystal-clear video content with hands-on coding exercises and real-world projects.",
                color: "icon-blue",
              },
              {
                icon: "🏆",
                title: "Certifications",
                description: "Earn industry-recognized certificates to showcase your skills to employers.",
                color: "icon-amber",
              },
              {
                icon: "⚡",
                title: "Live Practice Labs",
                description: "Interactive coding environments where you can practice in real-time alongside lessons.",
                color: "icon-cyan",
              },
              {
                icon: "🤝",
                title: "Community Support",
                description: "Join a thriving community of learners, mentors, and industry professionals.",
                color: "icon-emerald",
              },
              {
                icon: "📊",
                title: "Progress Tracking",
                description: "Detailed analytics and dashboards to monitor your learning journey.",
                color: "icon-rose",
              },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className={`glass-card animate-fade-in-up delay-${(i + 1) * 100}`}
                style={{ padding: 32 }}
              >
                <div className={`icon-wrapper ${feature.color}`} style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: "1.3rem" }}>{feature.icon}</span>
                </div>
                <h3
                  style={{
                    fontSize: "1.15rem",
                    fontWeight: 700,
                    marginBottom: 10,
                    color: "var(--text-primary)",
                  }}
                >
                  {feature.title}
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.7 }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section style={{ padding: "80px 24px 120px", position: "relative" }}>
        <div
          className="glass-card-static animate-fade-in-up"
          style={{
            maxWidth: 800,
            margin: "0 auto",
            padding: "64px 48px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            className="animate-gradient-shift"
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(59,130,246,0.08), rgba(6,182,212,0.08))",
              backgroundSize: "200% 200%",
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2
              style={{
                fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                marginBottom: 16,
              }}
            >
              Ready to start your journey?
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 32, fontSize: "1.05rem" }}>
              Join thousands of learners advancing their careers with Automate.
            </p>
            <a href="/login" style={{ textDecoration: "none" }}>
              <button className="btn-primary" style={{ padding: "16px 48px", fontSize: "1.05rem" }}>
                Get Started Free
              </button>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}