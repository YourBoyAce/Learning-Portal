export default function Profile() {
  return (
    <div style={{ minHeight: "calc(100vh - 64px)", padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div className="page-header animate-fade-in-up">
          <h1>
            Your <span className="gradient-text">Profile</span>
          </h1>
          <p>Manage your account settings and preferences.</p>
        </div>

        {/* Profile Card */}
        <div
          className="glass-card-static animate-fade-in-up delay-100"
          style={{
            padding: 32,
            display: "flex",
            alignItems: "center",
            gap: 28,
            marginBottom: 32,
            flexWrap: "wrap",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              background: "var(--gradient-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
              fontWeight: 800,
              color: "white",
              flexShrink: 0,
              boxShadow: "var(--glow-violet)",
            }}
          >
            JD
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 4 }}>
              John Doe
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: 12 }}>
              john.doe@example.com
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge badge-violet">Pro Member</span>
              <span className="badge badge-emerald">Active</span>
            </div>
          </div>

          {/* Edit Button */}
          <button className="btn-secondary" style={{ padding: "10px 24px", fontSize: "0.875rem" }}>
            Edit Profile
          </button>
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {[
            { label: "Courses", value: "4", icon: "📚", color: "icon-violet" },
            { label: "Completed", value: "2", icon: "✅", color: "icon-emerald" },
            { label: "Certificates", value: "2", icon: "🏆", color: "icon-amber" },
            { label: "Hours", value: "36", icon: "⏱️", color: "icon-blue" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`glass-card animate-fade-in-up delay-${(i + 2) * 100}`}
              style={{ padding: 20, textAlign: "center" }}
            >
              <div className={`icon-wrapper ${stat.color}`} style={{ margin: "0 auto 12px" }}>
                <span>{stat.icon}</span>
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{stat.value}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Account Details */}
        <div className="glass-card-static animate-fade-in-up delay-400" style={{ padding: 32 }}>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 24 }}>
            Account Details
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                Full Name
              </label>
              <input className="glass-input" defaultValue="John Doe" readOnly />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                Email
              </label>
              <input className="glass-input" defaultValue="john.doe@example.com" readOnly />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                Joined
              </label>
              <input className="glass-input" defaultValue="March 15, 2026" readOnly />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                Plan
              </label>
              <input className="glass-input" defaultValue="Pro — Annual" readOnly />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}