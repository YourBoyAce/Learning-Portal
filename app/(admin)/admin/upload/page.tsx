"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { BookOpen } from "lucide-react";

type Course = {
  id: string | number;
  title: string;
  description: string | null;
  created_at?: string | null;
};

type Module = {
  id: string | number;
  title: string;
};

export default function UploadPage() {
  const textPrimary = "#0f172a";
  const textSecondary = "#334155";
  const inputBorder = "#cbd5e1";
  const inputBackground = "#ffffff";
  const searchParams = useSearchParams();
  const preselectedCourseId = searchParams.get("courseId") || "";

  const [userId, setUserId] = useState<string>("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isModulesLoading, setIsModulesLoading] = useState(false);
  const [showAllCourses, setShowAllCourses] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [isInitializingCourse, setIsInitializingCourse] = useState(false);
  const [courseInitMessage, setCourseInitMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isCoursesLoading, setIsCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [isQueueingVideo, setIsQueueingVideo] = useState(false);
  const [videoQueueMessage, setVideoQueueMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fileNameDisplay = useMemo(
    () => selectedFile?.name || "",
    [selectedFile],
  );

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
        throw new Error(
          result?.error || `Request failed (${response.status}).`,
        );
      }

      const loadedCourses = Array.isArray(result?.courses)
        ? result.courses
        : [];
      setCourses(loadedCourses);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch courses.");
    } finally {
      setIsCoursesLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be signed in to upload videos.");
        return;
      }

      setUserId(user.id);
      await fetchCourses();
    };

    void init();
  }, []);

  useEffect(() => {
    if (!selectedCurriculum) {
      setModules([]);
      setSelectedModuleId("");
      return;
    }

    const fetchModules = async () => {
      setIsModulesLoading(true);
      try {
        const { data, error } = await supabase
          .from("coursemodules")
          .select("id, title")
          .eq("maincourse_id", selectedCurriculum);

        if (error) throw error;
        setModules(data || []);
      } catch (err) {
        console.error("Failed to fetch modules", err);
      } finally {
        setIsModulesLoading(false);
      }
    };

    fetchModules();
  }, [selectedCurriculum]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
    if (file) {
      setVideoFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const [uploadProgress, setUploadProgress] = useState(0);

  const handleUploadVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setUploadProgress(0);

    if (
      !selectedCurriculum ||
      !selectedModuleId ||
      !videoTitle.trim() ||
      !selectedFile
    ) {
      setError(
        "Please select a curriculum, a module, add a video title, and choose a file.",
      );
      return;
    }

    if (!userId) {
      setError("You must be signed in.");
      return;
    }

    try {
      setIsUploading(true);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      // 1. Get Direct Upload URL from Cloudflare
      const directUploadResponse = await fetch("/api/cloudflare/stream/direct-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          title: videoTitle.trim(),
          courseId: selectedCurriculum,
          moduleId: selectedModuleId,
        }),
      });

      const directUploadResult = await directUploadResponse.json();
      if (!directUploadResponse.ok) {
        throw new Error(directUploadResult.error || "Failed to initialize Cloudflare upload.");
      }

      const { uploadURL, uid } = directUploadResult;

      // 2. Upload file directly to Cloudflare using XHR for progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", uploadURL);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            reject(new Error("Failed to upload file to Cloudflare."));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload."));
        
        const formData = new FormData();
        formData.append("file", selectedFile);
        xhr.send(formData);
      });

      // 3. Update database with the Cloudflare UID
      const payload = new FormData();
      payload.append("maincourseId", selectedCurriculum);
      payload.append("moduleId", selectedModuleId);
      payload.append("title", videoTitle.trim());
      payload.append("cloudflareUid", uid);

      const response = await fetch("/api/admin/coursemodules", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: payload,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error || `Request failed (${response.status}).`,
        );
      }

      setVideoTitle("");
      setSelectedFile(null);
      setUploadProgress(100);
      setSuccess("Video uploaded successfully to Cloudflare and linked to the module.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload video.");
    } finally {
      setIsUploading(false);
    }
  };

  const formatCreatedAt = (value?: string | null) => {
    if (!value) return "Recently added";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently added";
    return `Created ${date.toLocaleDateString()}`;
  };

  const displayedCourses = showAllCourses ? courses : courses.slice(0, 4);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            ADMIN PORTAL / CONTENT MANAGEMENT
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Video Asset Upload
          </h1>
          <p style={{ color: textSecondary }}>
            Upload high-fidelity instructional media to your course modules.
          </p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {courses.length}
              </div>
              <div className="text-xs text-gray-500 font-medium">
                Total Active Courses
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600 text-sm">
            {success}
          </div>
        )}

        {/* Main Content - 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Panel - Upload Form */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Upload New Video
              </h3>

              <form onSubmit={handleUploadVideo} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Select Curriculum
                  </label>
                  <select
                    value={selectedCurriculum}
                    onChange={(e) => setSelectedCurriculum(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2283FF] focus:ring-1 focus:ring-[#2283FF] cursor-pointer"
                  >
                    <option value="">Select curriculum...</option>
                    {courses.map((course) => (
                      <option key={course.id} value={String(course.id)}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Select Module
                  </label>
                  <select
                    value={selectedModuleId}
                    onChange={(e) => setSelectedModuleId(e.target.value)}
                    disabled={!selectedCurriculum || isModulesLoading}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2283FF] focus:ring-1 focus:ring-[#2283FF] cursor-pointer disabled:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {isModulesLoading
                        ? "Loading modules..."
                        : "Select module..."}
                    </option>
                    {modules.map((module) => (
                      <option key={module.id} value={String(module.id)}>
                        {module.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Video Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Intro to Variables"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2283FF] focus:ring-1 focus:ring-[#2283FF]"
                  />
                </div>

                {/* Upload Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-[#2283FF] bg-blue-50"
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

                  {fileNameDisplay ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900 mb-1">
                        {fileNameDisplay}
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
                    type="submit"
                    disabled={isUploading}
                    className="w-full bg-[#2283FF] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#2283FF] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isUploading ? `Uploading... ${uploadProgress}%` : "Upload Video Asset"}
                  </button>
              </form>
            </div>
          </div>

          {/* Right Panel - Active Curriculum */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Active Curriculum
                </h3>
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

                {displayedCourses.map((course) => (
                  <div
                    key={course.id}
                    className="border border-gray-200 rounded-xl overflow-hidden hover:border-[#2283FF] transition-colors"
                  >
                    <div className="h-32 bg-gradient-to-r from-[#2283FF] to-blue-800"></div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
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
                        <span>{formatCreatedAt(course.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* View More Card */}
                {!showAllCourses && courses.length > 4 && (
                  <div
                    onClick={() => setShowAllCourses(true)}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center hover:border-[#2283FF] hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 text-gray-400 group-hover:text-[#2283FF]">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      View All Courses
                    </p>
                    <p className="text-xs text-gray-500">
                      Show {courses.length - 4} more
                    </p>
                  </div>
                )}
                {showAllCourses && courses.length > 4 && (
                  <div
                    onClick={() => setShowAllCourses(false)}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center hover:border-[#2283FF] hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 text-gray-400 group-hover:text-[#2283FF]">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      Show Less
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
