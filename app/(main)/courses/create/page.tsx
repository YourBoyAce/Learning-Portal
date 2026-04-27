"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function CreateCourse() {
  const textPrimary = "#0f172a";
  const textSecondary = "#64748b";
  const fieldBackground = "#ffffff";
  const fieldBorder = "#cbd5e1";
  const cardMaxWidth = 700;
  const cardStyle = {
    padding: 28,
    maxWidth: cardMaxWidth,
    margin: "0 auto",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.08)",
  } as const;
  const secondaryButtonStyle = {
    padding: "12px 24px",
    background: "#ffffff",
    color: textPrimary,
    border: "1px solid #cbd5e1",
  } as const;

  const router = useRouter();
  const [step, setStep] = useState<"course" | "batches">("course");
  const [courseId, setCourseId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [courseData, setCourseData] = useState({
    title: "",
    description: "",
    lessons_count: 0,
    instructor_id: "",
  });

  const handleCourseChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setCourseData((prev) => ({
      ...prev,
      [name]: name === "lessons_count" ? parseInt(value) || 0 : value,
    }));
  };

  const createCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("courses")
        .insert([
          {
            title: courseData.title,
            description: courseData.description,
            lessons_count: courseData.lessons_count,
            instructor_id: user.id,
            status: "published",
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setCourseId(data.id);
      setSuccess("Course created and published! Now let's create batches for it.");
      setStep("batches");
    } catch (err: any) {
      const message =
        err?.message?.includes("row-level security policy") ||
        err?.message?.includes("violates row-level security")
          ? "Database permissions are blocking course creation. Run the RLS policy section in DATABASE_SETUP.sql, then try again."
          : err.message || "Failed to create course";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "calc(100vh - 64px)", padding: "40px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Step Indicator */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 40,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: "12px",
              background:
                step === "course" ? "rgba(11, 30, 109, 0.2)" : "transparent",
              border:
                "1px solid " + (step === "course" ? "#0B1E6D" : "transparent"),
              color: step === "course" ? "#0B1E6D" : textSecondary,
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>1️⃣</span>
            <span style={{ fontWeight: 600 }}>Create Course</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: "12px",
              background:
                step === "batches" ? "rgba(11, 30, 109, 0.2)" : "transparent",
              border:
                "1px solid " + (step === "batches" ? "#0B1E6D" : "transparent"),
              color: step === "batches" ? "#0B1E6D" : textSecondary,
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>2️⃣</span>
            <span style={{ fontWeight: 600 }}>Create Batches</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            className="glass-card"
            style={{
              padding: "16px",
              background: "rgba(239, 68, 68, 0.1)",
              borderLeft: "4px solid #ef4444",
              color: "#fca5a5",
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div
            className="glass-card"
            style={{
              padding: "16px",
              background: "rgba(34, 197, 94, 0.1)",
              borderLeft: "4px solid #22c55e",
              color: "#86efac",
              marginBottom: 24,
            }}
          >
            {success}
          </div>
        )}

        {/* Step 1: Create Course */}
        {step === "course" && (
          <div className="glass-card" style={cardStyle}>
            <h2
              style={{
                fontSize: "1.8rem",
                fontWeight: 700,
                marginBottom: 24,
                color: textPrimary,
              }}
            >
              Create a New Course
            </h2>

            <form
              onSubmit={createCourse}
              style={{ display: "flex", flexDirection: "column", gap: 18 }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: textPrimary,
                  }}
                >
                  Course Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={courseData.title}
                  onChange={handleCourseChange}
                  placeholder="e.g., Playwright Mastery"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: `1px solid ${fieldBorder}`,
                    background: fieldBackground,
                    color: "#000",
                    fontSize: "0.95rem",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: textPrimary,
                  }}
                >
                  Description *
                </label>
                <textarea
                  name="description"
                  value={courseData.description}
                  onChange={handleCourseChange}
                  placeholder="Describe your course..."
                  required
                  rows={5}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: `1px solid ${fieldBorder}`,
                    background: fieldBackground,
                    color: "#000",
                    fontSize: "0.95rem",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: textPrimary,
                  }}
                >
                  Number of Lessons
                </label>
                <input
                  type="number"
                  name="lessons_count"
                  value={courseData.lessons_count}
                  onChange={handleCourseChange}
                  placeholder="0"
                  min="0"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: `1px solid ${fieldBorder}`,
                    background: fieldBackground,
                    color: "#000",
                    fontSize: "0.95rem",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "flex-end",
                  marginTop: 16,
                }}
              >
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="btn-secondary"
                  style={secondaryButtonStyle}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ padding: "12px 24px", opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? "Creating..." : "Create Course"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Create Batches */}
        {step === "batches" && courseId && (
          <BatchCreation courseId={courseId} courseName={courseData.title} />
        )}
      </div>
    </div>
  );
}

function BatchCreation({
  courseId,
  courseName,
}: {
  courseId: string;
  courseName: string;
}) {
  const textPrimary = "#0f172a";
  const textSecondary = "#64748b";
  const textMuted = "#94a3b8";
  const fieldBackground = "#ffffff";
  const fieldBorder = "#cbd5e1";
  const cardStyle = {
    padding: 28,
    maxWidth: 700,
    margin: "0 auto",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.08)",
  } as const;
  const secondaryButtonStyle = {
    padding: "12px 24px",
    background: "#ffffff",
    color: textPrimary,
    border: "1px solid #cbd5e1",
  } as const;

  const router = useRouter();
  const [batches, setBatches] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [batchData, setBatchData] = useState({
    name: "",
    scheduleType: "weekday" as "weekday" | "weekend",
  });
  const [emailInput, setEmailInput] = useState("");
  const [memberEmails, setMemberEmails] = useState<string[]>([]);

  const handleBatchChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setBatchData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addMemberEmail = () => {
    const email = emailInput.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      setError("Please enter an email address.");
      return;
    }

    if (!emailPattern.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (memberEmails.includes(email)) {
      setError("This email is already added.");
      return;
    }

    setMemberEmails((prev) => [...prev, email]);
    setEmailInput("");
    setError("");
  };

  const removeMemberEmail = (email: string) => {
    setMemberEmails((prev) => prev.filter((item) => item !== email));
  };

  const createBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("User not authenticated");
      if (memberEmails.length === 0) {
        throw new Error("Add at least one member email before creating batch.");
      }

      const emailsToInsert = [...memberEmails];

      const { data, error } = await supabase
        .from("batches")
        .insert([
          {
            name: batchData.name,
            course_id: courseId,
            schedule_type: batchData.scheduleType,
            status: "active",
            created_by: user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      const { error: membersError } = await supabase.from("batch_members").insert(
        emailsToInsert.map((email) => ({
          batch_id: data.id,
          email,
        })),
      );

      if (membersError) throw membersError;

      setBatches([...batches, { ...data, memberCount: emailsToInsert.length }]);
      setSuccess(
        `Batch created successfully with ${emailsToInsert.length} member${emailsToInsert.length > 1 ? "s" : ""}.`,
      );
      setBatchData({ name: "", scheduleType: "weekday" });
      setMemberEmails([]);
      setEmailInput("");
      setShowModal(false);

      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to create batch");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    router.push("/courses");
  };

  return (
    <div className="glass-card" style={cardStyle}>
      <h2
        style={{
          fontSize: "1.8rem",
          fontWeight: 700,
          marginBottom: 8,
          color: textPrimary,
        }}
      >
        Create Batches for <span className="gradient-text">{courseName}</span>
      </h2>
      <p style={{ color: textSecondary, marginBottom: 24 }}>
        Batches group students and define their learning schedules
      </p>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(239, 68, 68, 0.1)",
            borderLeft: "4px solid #ef4444",
            color: "#fca5a5",
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(34, 197, 94, 0.1)",
            borderLeft: "4px solid #22c55e",
            color: "#86efac",
            marginBottom: 16,
          }}
        >
          {success}
        </div>
      )}

      {/* Batches List */}
      {batches.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              marginBottom: 12,
              color: textPrimary,
            }}
          >
            Created Batches ({batches.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {batches.map((batch) => (
              <div
                key={batch.id}
                style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: fieldBackground,
                  border: `1px solid ${fieldBorder}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <p style={{ fontWeight: 600, color: textPrimary }}>
                    {batch.name}
                  </p>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: textSecondary,
                    }}
                  >
                    {batch.schedule_type === "weekday"
                      ? "📅 Weekday"
                      : "🏖️ Weekend"}
                  </p>
                  <p style={{ fontSize: "0.8rem", color: textMuted }}>
                    👥 {batch.memberCount ?? 0}{" "}
                    {batch.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                <span
                  style={{ fontSize: "0.8rem", color: textMuted }}
                >
                  ✅ Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => {
            setShowModal(false);
            setEmailInput("");
            setMemberEmails([]);
          }}
        >
          <div
            className="glass-card"
            style={{ ...cardStyle, maxWidth: 500, width: "90%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "1.3rem",
                fontWeight: 700,
                marginBottom: 20,
                color: textPrimary,
              }}
            >
              Create New Batch
            </h3>

            <form
              onSubmit={createBatch}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: textPrimary,
                  }}
                >
                  Batch Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={batchData.name}
                  onChange={handleBatchChange}
                  placeholder="e.g., Batch 1 - Morning"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${fieldBorder}`,
                    background: fieldBackground,
                    color: "#000",
                    fontSize: "0.95rem",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: textPrimary,
                  }}
                >
                  Schedule Type
                </label>
                <select
                  name="scheduleType"
                  value={batchData.scheduleType}
                  onChange={handleBatchChange}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${fieldBorder}`,
                    background: fieldBackground,
                    color: "#000",
                    fontSize: "0.95rem",
                  }}
                >
                  <option value="weekday">📅 Weekday</option>
                  <option value="weekend">🏖️ Weekend</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: textPrimary,
                  }}
                >
                  Member Emails *
                </label>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Enter member email"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addMemberEmail();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: "6px",
                      border: `1px solid ${fieldBorder}`,
                      background: fieldBackground,
                      color: "#000",
                      fontSize: "0.95rem",
                    }}
                  />
                  <button
                    type="button"
                    onClick={addMemberEmail}
                    className="btn-secondary"
                    style={{ ...secondaryButtonStyle, padding: "10px 14px" }}
                  >
                    Add
                  </button>
                </div>

                {memberEmails.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      maxHeight: 160,
                      overflowY: "auto",
                      border: `1px solid ${fieldBorder}`,
                      borderRadius: 8,
                      padding: 10,
                      background: "#f8fafc",
                    }}
                  >
                    {memberEmails.map((email) => (
                      <div
                        key={email}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          background: "#ffffff",
                          border: `1px solid ${fieldBorder}`,
                          borderRadius: 6,
                          padding: "8px 10px",
                          fontSize: "0.88rem",
                          color: textPrimary,
                        }}
                      >
                        <span>{email}</span>
                        <button
                          type="button"
                          onClick={() => removeMemberEmail(email)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: "0.9rem",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEmailInput("");
                    setMemberEmails([]);
                  }}
                  className="btn-secondary"
                  style={{
                    ...secondaryButtonStyle,
                    padding: "10px 20px",
                    fontSize: "0.9rem",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    padding: "10px 20px",
                    fontSize: "0.9rem",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? "Creating..." : "Create Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "flex-end",
          marginTop: 24,
        }}
      >
        <button
          onClick={() => {
            setShowModal(true);
            setEmailInput("");
            setMemberEmails([]);
            setError("");
          }}
          className="btn-secondary"
          style={secondaryButtonStyle}
        >
          + Add Another Batch
        </button>
        <button
          onClick={handleFinish}
          className="btn-primary"
          style={{ padding: "12px 24px" }}
        >
          {batches.length > 0 ? "Finish" : "Skip & Finish"}
        </button>
      </div>
    </div>
  );
}
