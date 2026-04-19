"use client";

import { useState } from "react";

export default function AdminUsers() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const users = [
    { id: 1, name: "Jane Smith", email: "jane@example.com", role: "Student", status: "Active", courses: 3, joined: "Mar 12, 2026" },
    { id: 2, name: "Alex Johnson", email: "alex@example.com", role: "Student", status: "Active", courses: 5, joined: "Feb 28, 2026" },
    { id: 3, name: "Sarah Williams", email: "sarah@example.com", role: "Admin", status: "Active", courses: 0, joined: "Jan 15, 2026" },
    { id: 4, name: "Mike Chen", email: "mike@example.com", role: "Student", status: "Inactive", courses: 1, joined: "Mar 5, 2026" },
    { id: 5, name: "Emily Davis", email: "emily@example.com", role: "Student", status: "Active", courses: 4, joined: "Mar 20, 2026" },
  ];

  return (
    <div style={{ minHeight: "calc(100vh - 64px)", padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div className="page-header animate-fade-in-up">
          <h1>
            <span className="gradient-text">Manage</span> Users
          </h1>
          <p>Create accounts and manage platform users.</p>
        </div>

        {/* Create User Form */}
        <div className="glass-card-static animate-fade-in-up delay-100" style={{ padding: 32, marginBottom: 32 }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 24 }}>
            Create New User
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                Email Address
              </label>
              <input
                className="glass-input"
                placeholder="user@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                Password
              </label>
              <input
                className="glass-input"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                Role
              </label>
              <select className="glass-input" style={{ cursor: "pointer" }}>
                <option>Student</option>
                <option>Admin</option>
              </select>
            </div>
          </div>

          <button className="btn-primary" style={{ padding: "12px 32px" }}>
            Create User
          </button>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {[
            { label: "Total Users", value: "5", icon: "👥", color: "icon-blue" },
            { label: "Active", value: "4", icon: "✅", color: "icon-emerald" },
            { label: "Admins", value: "1", icon: "🛡️", color: "icon-violet" },
            { label: "Inactive", value: "1", icon: "⏸️", color: "icon-amber" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`glass-card animate-fade-in-up delay-${(i + 2) * 100}`}
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

        {/* Users Table */}
        <div className="glass-card-static animate-fade-in-up delay-400" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--border-glass)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>All Users</h3>
            <input
              type="text"
              placeholder="Search users..."
              className="glass-input"
              style={{ maxWidth: 240, padding: "8px 14px", fontSize: "0.85rem" }}
            />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Courses</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "var(--gradient-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            color: "white",
                            flexShrink: 0,
                          }}
                        >
                          {user.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        {user.name}
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`badge ${user.role === "Admin" ? "badge-violet" : "badge-blue"}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>{user.courses}</td>
                    <td>
                      <span className={`badge ${user.status === "Active" ? "badge-emerald" : "badge-amber"}`}>
                        {user.status}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{user.joined}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn-secondary" style={{ padding: "6px 14px", fontSize: "0.78rem", borderRadius: "8px" }}>
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
                          Remove
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