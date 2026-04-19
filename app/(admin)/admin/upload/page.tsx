"use client";

import { useState } from "react";

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setFileName(file.name);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  };

  return (
    <div style={{ minHeight: "calc(100vh - 64px)", padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        {/* Header */}
        <div className="page-header animate-fade-in-up">
          <h1>
            <span className="gradient-text">Upload</span> Video
          </h1>
          <p>Upload course videos to the platform for processing and delivery.</p>
        </div>

        {/* Upload Zone */}
        <div
          className="animate-fade-in-up delay-100"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? "var(--accent-violet)" : "var(--border-glass)"}`,
            borderRadius: "var(--radius-lg)",
            padding: "64px 32px",
            textAlign: "center",
            transition: "all 0.3s ease",
            background: isDragging ? "rgba(124, 58, 237, 0.06)" : "var(--surface-glass)",
            cursor: "pointer",
            position: "relative",
            marginBottom: 32,
            boxShadow: isDragging ? "var(--glow-violet)" : "none",
          }}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: isDragging ? "var(--gradient-primary)" : "var(--surface-glass-strong)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              transition: "all 0.3s ease",
            }}
          >
            <span style={{ fontSize: "1.75rem" }}>
              {fileName ? "✅" : "📁"}
            </span>
          </div>

          {fileName ? (
            <>
              <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                {fileName}
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                File selected — click Upload to proceed
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                Drag & drop your video here
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 20 }}>
                or click to browse files • MP4, MOV, WebM up to 5GB
              </p>
            </>
          )}
        </div>

        {/* Video Details Form */}
        <div className="glass-card-static animate-fade-in-up delay-200" style={{ padding: 32 }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 24 }}>Video Details</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                Video Title
              </label>
              <input className="glass-input" placeholder="e.g., Introduction to Playwright" />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                Description
              </label>
              <textarea
                className="glass-input"
                placeholder="Brief description of this video lesson..."
                rows={4}
                style={{ resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                  Course
                </label>
                <select className="glass-input" style={{ cursor: "pointer" }}>
                  <option value="">Select course...</option>
                  <option>Playwright Mastery</option>
                  <option>Gen AI Fundamentals</option>
                  <option>Selenium Advanced</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                  Lesson Order
                </label>
                <input className="glass-input" type="number" placeholder="1" min={1} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button className="btn-primary" style={{ padding: "14px 36px" }}>
                Upload Video
              </button>
              <button className="btn-secondary" style={{ padding: "14px 28px" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}