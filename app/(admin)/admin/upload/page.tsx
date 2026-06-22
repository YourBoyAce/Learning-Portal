"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import CourseCard from "@/app/components/course/CourseCard";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY, TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import Image from "next/image";

type Course = {
  id: string | number;
  title: string;
  description: string | undefined;
  thumbnail_url?: string | undefined;
  created_at?: string | undefined;
  batch_name?: string | null;
  batch_schedule_types?: ("weekday" | "weekend")[];
  course_type?: string;
};

type Module = {
  id: string | number;
  title: string;
  thumbnail_url?: string | null;
  created_at?: string | null;
};

export default function UploadPage() {
  const searchParams = useSearchParams();
  const preselectedCourseId = searchParams.get("courseId") || "";

  const [userId, setUserId] = useState<string>("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [moduleThumbnailFile, setModuleThumbnailFile] = useState<File | null>(
    null,
  );
  const [moduleThumbnailPreview, setModuleThumbnailPreview] = useState("");

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isModulesLoading, setIsModulesLoading] = useState(false);

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
          .select("id, title, created_at")
          .eq("maincourse_id", selectedCurriculum)
          .order("order_index", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });

        if (error) throw error;

        setModules(data || []);
      } catch (err) {
        console.error("Failed to fetch modules", err);
        setModules([]);
        setError("Failed to load modules for this curriculum.");
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
    if (file) {
      setError("");
      setSelectedFile(file);
      setVideoFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError("");
      setSelectedFile(file);
      setVideoFile(file);
    }
  };

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleUploadVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setUploadProgress(0);
    setUploadStatus("");

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

      const fileSize = selectedFile.size;
      const chunkSize = 190 * 1024 * 1024; // 190MB chunks (safe margin below 200MB limit)
      const numChunks = Math.ceil(fileSize / chunkSize);
      const uploadedUIDs: string[] = [];

      // Upload file in chunks
      for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        const chunk = selectedFile.slice(start, end);

        setUploadStatus(
          numChunks > 1
            ? `Uploading part ${chunkIndex + 1} of ${numChunks}...`
            : "",
        );

        // 1. Get Direct Upload URL from Cloudflare for this chunk
        const directUploadResponse = await fetch(
          "/api/cloudflare/stream/direct-upload",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({
              title:
                numChunks > 1
                  ? `${videoTitle.trim()} (Part ${chunkIndex + 1}/${numChunks})`
                  : videoTitle.trim(),
              courseId: selectedCurriculum,
              moduleId: selectedModuleId,
            }),
          },
        );

        const directUploadResult = await directUploadResponse.json();
        if (!directUploadResponse.ok) {
          throw new Error(
            directUploadResult.error ||
            "Failed to initialize Cloudflare upload.",
          );
        }

        const { uploadURL, uid } = directUploadResult;
        uploadedUIDs.push(uid);

        // 2. Upload chunk to Cloudflare with retry
        const uploadChunkWithRetry = async (maxRetries = 3) => {
          let lastError: Error | null = null;

          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("POST", uploadURL);

                xhr.upload.onprogress = (event) => {
                  if (event.lengthComputable) {
                    const chunkProgress = Math.round(
                      (event.loaded / (end - start)) * 100,
                    );
                    const overallProgress = Math.round(
                      ((start + event.loaded) / fileSize) * 100,
                    );
                    setUploadProgress(overallProgress);
                  }
                };

                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                  } else {
                    reject(
                      new Error(
                        `Upload failed with status ${xhr.status}: ${xhr.statusText}`,
                      ),
                    );
                  }
                };

                xhr.onerror = () =>
                  reject(new Error("Network error during upload."));
                xhr.onabort = () => reject(new Error("Upload was aborted."));

                const formData = new FormData();
                formData.append("file", chunk);
                xhr.send(formData);
              });
              return; // Success, exit retry loop
            } catch (err) {
              lastError = err instanceof Error ? err : new Error(String(err));
              console.warn(
                `Upload attempt ${attempt + 1} failed:`,
                lastError.message,
              );

              if (attempt < maxRetries - 1) {
                const delayMs = Math.pow(2, attempt) * 1000;
                await new Promise((resolve) => setTimeout(resolve, delayMs));
              }
            }
          }

          throw lastError || new Error("Upload failed after multiple attempts");
        };

        await uploadChunkWithRetry();
      }

      // 3. Update database with all Cloudflare UIDs
      const payload = new FormData();
      payload.append("maincourseId", selectedCurriculum);
      payload.append("moduleId", selectedModuleId);
      payload.append("title", videoTitle.trim());
      payload.append("cloudflareUids", JSON.stringify(uploadedUIDs));

      if (moduleThumbnailFile) {
        const fileExt = moduleThumbnailFile.name.split(".").pop();
        const fileName = `module-thumbnails/${selectedModuleId}/${Date.now()}.${fileExt}`;
        const { error: thumbnailUploadError } = await supabase.storage
          .from("course-thumbnails")
          .upload(fileName, moduleThumbnailFile);

        if (thumbnailUploadError) {
          throw new Error(
            `Failed to upload module thumbnail: ${thumbnailUploadError.message}`,
          );
        }

        const { data: thumbnailUrlData } = supabase.storage
          .from("course-thumbnails")
          .getPublicUrl(fileName);
        if (thumbnailUrlData?.publicUrl) {
          payload.append("thumbnail_url", thumbnailUrlData.publicUrl);
        }
      }

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
      setModuleThumbnailFile(null);
      setModuleThumbnailPreview("");
      setUploadProgress(100);
      setUploadStatus("");
      setSuccess(
        numChunks > 1
          ? `Video uploaded successfully in ${numChunks} parts and linked to the module.`
          : "Video uploaded successfully to Cloudflare and linked to the module.",
      );
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

  const displayedCourses = courses;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>
            Video Asset Upload
          </h1>
          <p className={TYPOGRAPHY.BODY.fontSize + " " + TYPOGRAPHY.BODY.lineHeight + " " + TYPOGRAPHY.BODY.fontWeight + " text-gray-600"}>
            Upload high-fidelity instructional media to your course modules.
          </p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
              <Image
                src={ICONS.BOOK}
                alt="Courses Icon"
                width={30}
                height={30}
              />
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
          <div className="lg:col-span-1 space-y-6 min-w-0">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className={TYPOGRAPHY_CLASSES.SUBHEADING + " mb-4"}>
                Upload New Video
              </h3>

              <form onSubmit={handleUploadVideo} className="space-y-4">
                <div>
                  <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                    Select Curriculum
                  </label>
                  <select
                    value={selectedCurriculum}
                    onChange={(e) => setSelectedCurriculum(e.target.value)}
                    className={`${TYPOGRAPHY_CLASSES.CAPTION} ${!selectedCurriculum ? "!text-gray-400" : "!text-gray-900"} w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer`}
                    style={{
                      fontSize: TYPOGRAPHY.CAPTION.fontSize,
                      lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                      fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                    }}
                  >
                    <option value="" className="text-gray-400">Select curriculum...</option>
                    {courses.map((course) => (
                      <option key={course.id} value={String(course.id)} className="text-gray-900">
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                    Select Module
                  </label>
                  <select
                    value={selectedModuleId}
                    onChange={(e) => setSelectedModuleId(e.target.value)}
                    disabled={!selectedCurriculum || isModulesLoading}
                    className={`${TYPOGRAPHY_CLASSES.CAPTION} ${!selectedModuleId ? "!text-gray-400" : "!text-gray-900"} w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer`}
                    style={{
                      fontSize: TYPOGRAPHY.CAPTION.fontSize,
                      lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                      fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                    }}
                  >
                    <option value="" className="text-gray-400">
                      {isModulesLoading
                        ? "Loading modules..."
                        : "Select module..."}
                    </option>
                    {modules.map((module) => (
                      <option key={module.id} value={String(module.id)} className="text-gray-900">
                        {module.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                    Video Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Intro to Variables"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    className={`${TYPOGRAPHY_CLASSES.CAPTION} !text-gray-900 placeholder:!text-gray-400 w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer`}
                    style={{
                      fontSize: TYPOGRAPHY.CAPTION.fontSize,
                      lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                      fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                    }}
                  />
                </div>

                <div>
                  <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                    Module Thumbnail (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setModuleThumbnailFile(file);
                      setModuleThumbnailPreview(
                        file ? URL.createObjectURL(file) : "",
                      );
                    }}
                    className={`${TYPOGRAPHY_CLASSES.CAPTION} ${!moduleThumbnailFile ? "!text-gray-400" : "!text-gray-900"} w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 cursor-pointer file:!text-gray-900`}
                    style={{
                      fontSize: TYPOGRAPHY.CAPTION.fontSize,
                      lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                      fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                    }}
                  />
                  {moduleThumbnailPreview && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={moduleThumbnailPreview}
                        alt="Module thumbnail preview"
                        className="w-full h-28 object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Upload Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 rounded-xl p-4 sm:p-8 text-center cursor-pointer transition-all ${isDragging
                    ? "border-brand-primary bg-blue-50"
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

                  <div className="w-16 h-16 mx-auto mb-4 bg-brand-primary/50 rounded-full flex items-center justify-center">
                    <Image
                      src="/icons/arrowLight.svg"
                      alt="upload"
                      width={32}
                      height={32}
                      className="w-8 h-8 text-brand-primary"
                    />

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
                      <p className={`${TYPOGRAPHY.BODY.fontSize} ${TYPOGRAPHY.BODY.fontWeight} ${TYPOGRAPHY.BODY.lineHeight} text-brand-primary`}>Drop asset or click to browse</p>
                    </>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isUploading}
                  className="w-full"
                >
                  {isUploading
                    ? `Uploading... ${uploadProgress}%`
                    : "Upload Video Asset"}
                </Button>
              </form>
            </div>
          </div>

          {/* Right Panel - Active Curriculum */}
          <div className="lg:col-span-2 min-w-0">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <h3 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
                  Active Curriculum
                </h3>
              </div>

              {/* Course Cards Grid — shows 2×2 visible, scrollable for more */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[800px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                {isCoursesLoading && (
                  <p className="text-sm text-gray-500 col-span-2">Loading courses...</p>
                )}

                {!isCoursesLoading && courses.length === 0 && (
                  <p className="text-sm text-gray-500 col-span-2">
                    No courses yet. Initialize your first course to get started.
                  </p>
                )}

                {displayedCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    description={course.description}
                    thumbnail={course.thumbnail_url}
                    batchName={course.batch_name}
                    batchScheduleTypes={course.batch_schedule_types}
                    courseStatus={
                      course.course_type === "upcoming" ? "upcoming" : "active"
                    }
                    variant="admin"
                    showProgress={false}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
