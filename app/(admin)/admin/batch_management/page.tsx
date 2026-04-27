"use client";

import { useEffect, useState, useCallback } from "react";
import {
  createBatch,
  getAllBatches,
  addBatchMember,
  getBatchMembers,
  getAllCourses,
} from "@/lib/db/batch";

interface Course {
  id: string;
  title: string;
}

interface BatchMember {
  id: string;
  email: string;
  joined_at: string;
}

interface Batch {
  id: string;
  name: string;
  course_id: string;
  schedule_type: "weekday" | "weekend";
  created_at: string;
  courses: { id: string; title: string };
  batch_members: BatchMember[];
}

export default function BatchManagement() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatchMembers, setSelectedBatchMembers] = useState<
    BatchMember[]
  >([]);
  const [formData, setFormData] = useState({
    name: "",
    courseId: "",
    scheduleType: "weekday",
  });
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const batchesRes = await getAllBatches();
      const coursesRes = await getAllCourses();

      if (batchesRes.success && batchesRes.data) setBatches(batchesRes.data);
      if (coursesRes.success && coursesRes.data) setCourses(coursesRes.data);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load batches and courses
  useEffect(() => {
    // eslint-disable-next-line
    loadData();
  }, [loadData]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.name || !formData.courseId) {
      setError("Please fill in all fields");
      return;
    }

    try {
      const result = await createBatch(
        formData.name,
        formData.courseId,
        formData.scheduleType as "weekday" | "weekend",
        "current-user-id", // TODO: Replace with actual user ID from auth
      );

      if (result.success) {
        setSuccess("Batch created successfully!");
        setFormData({ name: "", courseId: "", scheduleType: "weekday" });
        setShowCreateModal(false);
        await loadData();

        // Automatically open add members modal for new batch
        setTimeout(() => {
          setSelectedBatchId(result.data.id);
          setShowMembersModal(true);
        }, 500);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to create batch");
    }
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!emailInput.trim()) {
      setError("Email cannot be empty");
      return;
    }

    if (!emails.includes(emailInput)) {
      setEmails([...emails, emailInput]);
      setEmailInput("");
    } else {
      setError("Email already added");
    }
  };

  const handleSubmitMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (emails.length === 0) {
      setError("Please add at least one email");
      return;
    }

    try {
      const result = await addBatchMember(selectedBatchId!, emails[0]);

      if (result.success) {
        setSuccess(`Added ${emails.length} member(s) successfully!`);
        setEmails([]);
        setEmailInput("");
        setShowMembersModal(false);
        await loadData();
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to add members");
    }
  };

  const openMembersView = async (batchId: string) => {
    try {
      const result = await getBatchMembers(batchId);
      if (result.success && result.data) {
        setSelectedBatchMembers(result.data);
        setSelectedBatchId(batchId);
        setShowMembersModal(true);
      }
    } catch {
      setError("Failed to load members");
    }
  };

  return (
    <div style={{ minHeight: "calc(100vh - 64px)", padding: "40px 24px 80px" }}>
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
            <h1>
              <span className="text">Manage</span> Batches
            </h1>
            <p>Create and manage batches with members.</p>
          </div>
          <button
            className="btn-primary"
            style={{ padding: "12px 28px" }}
            onClick={() => {
              setShowCreateModal(true);
              setFormData({ name: "", courseId: "", scheduleType: "weekday" });
            }}
          >
            + Create Batch
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: 16,
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "8px",
              color: "#10b981",
              fontSize: "0.85rem",
            }}
          >
            ✓ {success}
          </div>
        )}
        {error && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: 16,
              background: "rgba(244, 63, 94, 0.1)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              borderRadius: "8px",
              color: "#f43f5e",
              fontSize: "0.85rem",
            }}
          >
            ✗ {error}
          </div>
        )}

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
              label: "Total Batches",
              value: batches.length.toString(),
              icon: "📦",
              color: "icon-violet",
            },
            {
              label: "Total Members",
              value: batches
                .reduce((sum, b) => sum + (b.batch_members?.length || 0), 0)
                .toString(),
              icon: "👥",
              color: "icon-blue",
            },
            {
              label: "Weekday Batches",
              value: batches
                .filter((b) => b.schedule_type === "weekday")
                .length.toString(),
              icon: "📅",
              color: "icon-cyan",
            },
            {
              label: "Weekend Batches",
              value: batches
                .filter((b) => b.schedule_type === "weekend")
                .length.toString(),
              icon: "🎯",
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
                <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    fontWeight: 500,
                  }}
                >
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Batches Table */}
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
            <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>All Batches</h3>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {batches.length} total
            </span>
          </div>

          {loading ? (
            <div
              style={{
                padding: "40px 24px",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              Loading batches...
            </div>
          ) : batches.length === 0 ? (
            <div
              style={{
                padding: "40px 24px",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              No batches yet. Create one to get started!
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Batch Name</th>
                    <th>Course</th>
                    <th>Schedule</th>
                    <th>Members</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td
                        style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {batch.name}
                      </td>
                      <td>{batch.courses?.title || "N/A"}</td>
                      <td>
                        <span
                          className={`badge ${batch.schedule_type === "weekday" ? "badge-cyan" : "badge-amber"}`}
                        >
                          {batch.schedule_type === "weekday"
                            ? "📅 Weekday"
                            : "🎯 Weekend"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>
                        {batch.batch_members?.length || 0}
                      </td>
                      <td
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {new Date(batch.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="btn-small-primary"
                            onClick={() => openMembersView(batch.id)}
                            style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                          >
                            👥 Members
                          </button>
                          <button
                            className="btn-small-secondary"
                            onClick={() => {
                              setSelectedBatchId(batch.id);
                              setEmails([]);
                              setEmailInput("");
                              setShowMembersModal(true);
                            }}
                            style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                          >
                            + Add
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CREATE BATCH MODAL */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 24 }}>
              <h2
                style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 8 }}
              >
                Create New Batch
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Set up a batch for your course
              </p>
            </div>

            <form onSubmit={handleCreateBatch}>
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontWeight: 600,
                    fontSize: "0.9rem",
                  }}
                >
                  Batch Name
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g., Playwright Mastery - Batch 01"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  style={{ width: "100%", padding: "10px 14px" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontWeight: 600,
                    fontSize: "0.9rem",
                  }}
                >
                  Select Course
                </label>
                <select
                  className="glass-input"
                  value={formData.courseId}
                  onChange={(e) =>
                    setFormData({ ...formData, courseId: e.target.value })
                  }
                  style={{ width: "100%", padding: "10px 14px" }}
                >
                  <option value="">Choose a course...</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontWeight: 600,
                    fontSize: "0.9rem",
                  }}
                >
                  Schedule Type
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      flex: 1,
                    }}
                  >
                    <input
                      type="radio"
                      name="scheduleType"
                      value="weekday"
                      checked={formData.scheduleType === "weekday"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          scheduleType: e.target.value,
                        })
                      }
                    />
                    <span>📅 Weekday</span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      flex: 1,
                    }}
                  >
                    <input
                      type="radio"
                      name="scheduleType"
                      value="weekend"
                      checked={formData.scheduleType === "weekend"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          scheduleType: e.target.value,
                        })
                      }
                    />
                    <span>🎯 Weekend</span>
                  </label>
                </div>
              </div>

              <div
                style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: "10px 24px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "10px 24px" }}
                >
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD/VIEW MEMBERS MODAL */}
      {showMembersModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowMembersModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 24 }}>
              <h2
                style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 8 }}
              >
                Add Members to Batch
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Add members by entering their email addresses
              </p>
            </div>

            {/* Success/Error in modal */}
            {success && (
              <div
                style={{
                  padding: "10px 12px",
                  marginBottom: 16,
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "8px",
                  color: "#10b981",
                  fontSize: "0.85rem",
                }}
              >
                ✓ {success}
              </div>
            )}
            {error && (
              <div
                style={{
                  padding: "10px 12px",
                  marginBottom: 16,
                  background: "rgba(244, 63, 94, 0.1)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  borderRadius: "8px",
                  color: "#f43f5e",
                  fontSize: "0.85rem",
                }}
              >
                ✗ {error}
              </div>
            )}

            <form onSubmit={handleAddMember}>
              <div style={{ marginBottom: 16, display: "flex", gap: 12 }}>
                <input
                  type="email"
                  className="glass-input"
                  placeholder="Enter email address"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  style={{ flex: 1, padding: "10px 14px" }}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "10px 24px", whiteSpace: "nowrap" }}
                >
                  Add Email
                </button>
              </div>
            </form>

            {/* Added Emails List */}
            {emails.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4
                  style={{
                    fontWeight: 600,
                    marginBottom: 12,
                    fontSize: "0.9rem",
                  }}
                >
                  Added Emails ({emails.length})
                </h4>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {emails.map((email, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        background: "rgba(124, 58, 237, 0.1)",
                        border: "1px solid rgba(124, 58, 237, 0.2)",
                        borderRadius: "6px",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEmails(emails.filter((_, i) => i !== idx))
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: "#f43f5e",
                          cursor: "pointer",
                          fontSize: "1.2rem",
                          padding: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Existing Members */}
            {selectedBatchMembers.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4
                  style={{
                    fontWeight: 600,
                    marginBottom: 12,
                    fontSize: "0.9rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Current Members ({selectedBatchMembers.length})
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {selectedBatchMembers.map((member) => (
                    <div
                      key={member.id}
                      style={{
                        padding: "8px 12px",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div>{member.email}</div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowMembersModal(false);
                  setEmails([]);
                  setEmailInput("");
                  setError("");
                  setSuccess("");
                }}
                style={{ padding: "10px 24px" }}
              >
                Close
              </button>
              {emails.length > 0 && (
                <button
                  onClick={handleSubmitMembers}
                  className="btn-primary"
                  style={{ padding: "10px 24px" }}
                >
                  Add {emails.length} Member{emails.length !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .modal-content {
          background: var(--bg-secondary);
          border: 1px solid var(--border-glass);
          border-radius: 16px;
          padding: 32px;
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        }

        .glass-input {
          background: var(--surface-glass);
          border: 1px solid var(--border-glass);
          color: #000;
          border-radius: 8px;
          font-family: inherit;
          font-size: 0.9rem;
          transition: all 0.3s ease;
        }

        .glass-input::placeholder {
          color: #000;
          opacity: 0.7;
        }

        .glass-input option {
          color: #000;
        }

        .glass-input:focus {
          outline: none;
          border-color: var(--accent-violet);
          background: var(--surface-glass-hover);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }

        .btn-primary {
          background: var(--gradient-primary);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 0.9rem;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(124, 58, 237, 0.3);
        }

        .btn-secondary {
          background: var(--surface-glass);
          color: var(--text-primary);
          border: 1px solid var(--border-glass);
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 0.9rem;
        }

        .btn-secondary:hover {
          background: var(--surface-glass-hover);
          border-color: var(--border-glass-hover);
        }

        .btn-small-primary {
          background: var(--accent-violet);
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-small-primary:hover {
          background: #6d28d9;
          transform: translateY(-1px);
        }

        .btn-small-secondary {
          background: var(--surface-glass);
          color: var(--text-primary);
          border: 1px solid var(--border-glass);
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-small-secondary:hover {
          background: var(--surface-glass-hover);
          border-color: var(--border-glass-hover);
        }

        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          text-align: center;
        }

        .badge-cyan {
          background: rgba(6, 182, 212, 0.15);
          color: #06b6d4;
          border: 1px solid rgba(6, 182, 212, 0.3);
        }

        .badge-amber {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .glass-table {
          width: 100%;
          border-collapse: collapse;
        }

        .glass-table thead th {
          padding: 14px;
          text-align: left;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--border-glass);
        }

        .glass-table tbody tr {
          border-bottom: 1px solid var(--border-glass);
          transition: background 0.2s ease;
        }

        .glass-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .glass-table tbody td {
          padding: 14px;
          font-size: 0.9rem;
        }

        .glass-card {
          background: var(--surface-glass);
          border: 1px solid var(--border-glass);
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }

        .glass-card-static {
          background: var(--surface-glass);
          border: 1px solid var(--border-glass);
          border-radius: 12px;
        }

        .icon-wrapper {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          font-size: 1.5rem;
        }

        .icon-violet {
          background: rgba(124, 58, 237, 0.15);
        }

        .icon-blue {
          background: rgba(59, 130, 246, 0.15);
        }

        .icon-cyan {
          background: rgba(6, 182, 212, 0.15);
        }

        .icon-amber {
          background: rgba(245, 158, 11, 0.15);
        }

        .page-header {
          padding-bottom: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .page-header h1 {
          font-size: 2rem;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .page-header p {
          color: var(--text-secondary);
          font-size: 0.95rem;
        }

        .gradient-text {
          background: var(--gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        .delay-100 {
          animation-delay: 0.1s;
        }
        .delay-200 {
          animation-delay: 0.2s;
        }
        .delay-300 {
          animation-delay: 0.3s;
        }
      `}</style>
    </div>
  );
}
