"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

type Course = {
  id: string | number;
  title: string;
  description: string | null;
  created_at?: string | null;
};

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [isInitializingCourse, setIsInitializingCourse] = useState(false);
  const [courseInitMessage, setCourseInitMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isCoursesLoading, setIsCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [isQueueingVideo, setIsQueueingVideo] = useState(false);
  const [videoQueueMessage, setVideoQueueMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setVideoFile(file);
      setFileName(file.name);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setFileName(file.name);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      const response = await fetch("/api/admin/courses", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || `Request failed (${response.status}).`);
      }

      setCourses(Array.isArray(result?.courses) ? result.courses : []);
      setCoursesError(null);
    } catch (error) {
      setCoursesError(
        error instanceof Error
          ? error.message
          : "Failed to fetch courses. Please try again.",
      );
    } finally {
      setIsCoursesLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCourses();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleInitializeCourse = async () => {
    const title = courseTitle.trim();
    const description = courseDescription.trim();

    if (!title || !description) {
      setCourseInitMessage({
        type: "error",
        text: "Please add both course title and description.",
      });
      return;
    }

    try {
      setIsInitializingCourse(true);
      setCourseInitMessage(null);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      const response = await fetch("/api/admin/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          title,
          description,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || `Request failed (${response.status}).`);
      }

      setCourseTitle("");
      setCourseDescription("");
      await fetchCourses();
      setCourseInitMessage({
        type: "success",
        text: "Course initialized successfully.",
      });
    } catch (error) {
      setCourseInitMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to initialize course. Please try again.",
      });
    } finally {
      setIsInitializingCourse(false);
    }
  };

  const handleQueueVideo = async () => {
    const trimmedVideoTitle = videoTitle.trim();

    if (!selectedCurriculum || !trimmedVideoTitle || !videoFile) {
      setVideoQueueMessage({
        type: "error",
        text: "Please select a curriculum, add a video title, and choose a file.",
      });
      return;
    }

    try {
      setIsQueueingVideo(true);
      setVideoQueueMessage(null);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      const payload = new FormData();
      payload.append("maincourseId", selectedCurriculum);
      payload.append("title", trimmedVideoTitle);
      payload.append("file", videoFile);

      const response = await fetch("/api/admin/coursemodules", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: payload,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || `Request failed (${response.status}).`);
      }

      setVideoTitle("");
      setSelectedCurriculum("");
      setVideoFile(null);
      setFileName("");
      setVideoQueueMessage({
        type: "success",
        text: "Video uploaded and module created successfully.",
      });
    } catch (error) {
      setVideoQueueMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to upload video. Please try again.",
      });
    } finally {
      setIsQueueingVideo(false);
    }
  };

  const formatCreatedAt = (value?: string | null) => {
    if (!value) return "Recently added";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently added";
    return `Created ${date.toLocaleDateString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            ADMIN PORTAL / CONTENT MANAGEMENT
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Course & Video Management
          </h1>
          <p className="text-sm text-gray-500 max-w-3xl">
            Orchestrate your intellectual offerings. Create new curricula,
            upload high-fidelity instructional media, and curate the learner
            experience within a single authoritative interface.
          </p>
        </div>

        {/* Main Content - 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Panel - Forms */}
          <div className="lg:col-span-1 space-y-6">
            {/* Add New Course Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Add New Course
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Course Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Architectural Mastery"
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Description
                  </label>
                  <textarea
                    placeholder="Define the pedagogical scope..."
                    value={courseDescription}
                    onChange={(e) => setCourseDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] resize-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleInitializeCourse}
                  disabled={isInitializingCourse}
                  className="w-full bg-[#1D4ED8] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isInitializingCourse
                    ? "Initializing..."
                    : "Initialize Course"}
                </button>

                {courseInitMessage && (
                  <p
                    className={`text-xs ${
                      courseInitMessage.type === "success"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {courseInitMessage.text}
                  </p>
                )}
              </div>
            </div>

            {/* Upload New Video Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Upload New Video
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Select Curriculum
                  </label>
                  <select
                    value={selectedCurriculum}
                    onChange={(e) => setSelectedCurriculum(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] cursor-pointer"
                  >
                    <option value="">Select curriculum...</option>
                    {courses.map((course) => (
                      <option key={course.id} value={String(course.id)}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                  {coursesError && (
                    <p className="text-xs text-red-600 mt-2">{coursesError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Video Title
                  </label>
                  <input
                    type="text"
                    placeholder="Session 1: Introduction to Discourse"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                  />
                </div>

                {/* Upload Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-[#1D4ED8] bg-blue-50"
                      : "border-dashed border-gray-300 hover:border-gray-400"
                  }`}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>

                  {fileName ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900 mb-1">
                        {fileName}
                      </p>
                      <p className="text-xs text-gray-500">File selected</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-gray-900 mb-1">
                        Drop asset or click to browse
                      </p>
                      <p className="text-xs text-gray-500">
                        MP4, MOV up to 2GB
                      </p>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleQueueVideo}
                  disabled={isQueueingVideo}
                  className="w-full bg-[#1D4ED8] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isQueueingVideo ? "Uploading..." : "Queue Video Asset"}
                </button>

                {videoQueueMessage && (
                  <p
                    className={`text-xs ${
                      videoQueueMessage.type === "success"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {videoQueueMessage.text}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Active Curriculum */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Active Curriculum
                </h3>
                <a
                  href="#"
                  className="text-sm text-[#1D4ED8] font-medium hover:underline"
                >
                  View All Archives →
                </a>
              </div>

              {/* Course Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isCoursesLoading && (
                  <p className="text-sm text-gray-500">Loading courses...</p>
                )}

                {!isCoursesLoading && courses.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No courses yet. Initialize your first course to get started.
                  </p>
                )}

                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="border border-gray-200 rounded-xl overflow-hidden hover:border-[#1D4ED8] transition-colors cursor-pointer"
                  >
                    <div className="h-32 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">
                        {course.title}
                      </h4>
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                        {course.description || "No description available."}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <span>Course ID: {course.id}</span>
                        <span>{formatCreatedAt(course.created_at)}</span>
                      </div>
                      <button className="w-full px-3 py-2 bg-gray-50 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors">
                        Add Content
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add New Card */}
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center hover:border-[#1D4ED8] transition-colors cursor-pointer">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    Establish New Domain
                  </p>
                  <p className="text-xs text-gray-500">Initiate a new track</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Analytics Bar */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Management Analytics
              </h3>
              <p className="text-sm text-gray-500">
                Your curricula reached 14,892 scholars this month. Content
                engagement is up 23% compared to last period.
              </p>
            </div>
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Total Enrollments
                </p>
                <p className="text-2xl font-bold text-gray-900">842</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Completion Rate
                </p>
                <p className="text-2xl font-bold text-gray-900">68%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
