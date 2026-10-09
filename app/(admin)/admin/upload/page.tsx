"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import CourseCard from "@/app/components/course/CourseCard";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY, TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import Image from "next/image";
import { Modal } from "@/components/ui/modal";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { createCourseModule, createCourseSection } from "@/app/actions/admin-courses";

type Course = {
  id: string | number;
  title: string;
  description: string | undefined;
  thumbnail_url?: string | undefined;
  created_at?: string | undefined;
  batch_name?: string | null;
  course_type?: string;
  product_id?: string | number | null;
};

type Product = {
  id: string | number;
  title: string;
};

type Module = {
  id: string | number;
  title: string;
  thumbnail_url?: string | null;
  created_at?: string | null;
  section_id?: string | number | null;
  module_type?: string | null;
};

type Section = {
  id: string | number;
  title: string;
  description?: string;
  order_index?: number;
  created_at?: string | null;
};

export default function UploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCourseId = searchParams.get("courseId") || "";

  const [userId, setUserId] = useState<string>("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modules, setModules] = useState<Module[]>([]);

  const [selectedCurriculum, setSelectedCurriculum] =
    useState(preselectedCourseId);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [isAddModuleModalOpen, setIsAddModuleModalOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleDescription, setNewModuleDescription] = useState("");
  const [isCreatingModule, setIsCreatingModule] = useState(false);

  // Section state
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [isSectionsLoading, setIsSectionsLoading] = useState(false);
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionDescription, setNewSectionDescription] = useState("");
  const [isCreatingSection, setIsCreatingSection] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [moduleThumbnailFile, setModuleThumbnailFile] = useState<File | null>(
    null,
  );
  const [moduleThumbnailPreview, setModuleThumbnailPreview] = useState("");
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [isCustomThumbnail, setIsCustomThumbnail] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [isModulesLoading, setIsModulesLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isCoursesLoading, setIsCoursesLoading] = useState(true);

  const [isQueueingVideo, setIsQueueingVideo] = useState(false);
  const [videoQueueMessage, setVideoQueueMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fileNameDisplay = useMemo(
    () => selectedFile?.name || "",
    [selectedFile],
  );

  // Only show active courses (not upcoming) in curriculum selector
  const activeCourses = useMemo(
    () => courses.filter((c) => c.course_type !== "upcoming"),
    [courses],
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

      const productsRes = await fetch("/api/admin/products", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      const productsResult = await productsRes.json().catch(() => null);
      if (productsRes.ok && Array.isArray(productsResult?.products)) {
        setProducts(productsResult.products);
      }

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

  // Filter courses by selected product
  const filteredCourses = useMemo(() => {
    if (!selectedProductId) return [];
    return activeCourses.filter(
      (c) => String(c.product_id) === String(selectedProductId),
    );
  }, [activeCourses, selectedProductId]);

  // Reset course, section, and module when product changes
  useEffect(() => {
    setSelectedCurriculum("");
    setSelectedModuleId("");
    setSelectedSectionId("");
    setModules([]);
    setSections([]);
  }, [selectedProductId]);

  // When course changes, load its sections and modules
  useEffect(() => {
    if (!selectedCurriculum) {
      setModules([]);
      setSections([]);
      setSelectedModuleId("");
      setSelectedSectionId("");
      return;
    }

    const fetchSections = async () => {
      setIsSectionsLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.access_token) return;

        const res = await fetch(
          `/api/admin/sections?courseId=${encodeURIComponent(selectedCurriculum)}`,
          {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
          },
        );
        const result = await res.json().catch(() => null);
        if (res.ok && Array.isArray(result?.sections)) {
          setSections(result.sections);
        }
      } catch (err) {
        console.error("Failed to fetch sections", err);
        setSections([]);
      } finally {
        setIsSectionsLoading(false);
      }
    };

    void fetchSections();

    const fetchModules = async () => {
      setIsModulesLoading(true);
      try {
        const { data, error } = await supabase
          .from("coursemodules")
          .select("id, title, created_at, section_id, module_type")
          .eq("maincourse_id", selectedCurriculum)
          .order("order_index", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });

        if (error) {
          throw error;
        }

        setModules(data || []);
      } catch (err) {
        console.error("Failed to fetch modules", err);
        setModules([]);
        setError("Failed to load modules for this course.");
      } finally {
        setIsModulesLoading(false);
      }
    };

    void fetchModules();
  }, [selectedCurriculum]);

  // Filter modules by selected section and exclude quiz modules (video upload only applies to video modules)
  const filteredModules = useMemo(() => {
    let list = modules.filter((m) => m.module_type !== "quiz");
    if (selectedSectionId) {
      list = list.filter(
        (m) => String(m.section_id) === String(selectedSectionId),
      );
    }
    return list;
  }, [modules, selectedSectionId]);

  const generateVideoThumbnail = (
    videoFile: File,
  ): Promise<{ file: File; url: string }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const videoUrl = URL.createObjectURL(videoFile);
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Thumbnail generation timed out"));
      }, 10000);

      const cleanup = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(videoUrl);
        video.remove();
      };

      video.onloadedmetadata = () => {
        const targetTime = video.duration && video.duration > 0.5 ? 0.5 : 0.1;
        video.currentTime = targetTime;
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
              (blob) => {
                cleanup();
                if (blob) {
                  const baseName =
                    videoFile.name.substring(
                      0,
                      videoFile.name.lastIndexOf("."),
                    ) || "thumbnail";
                  const thumbFile = new File([blob], `${baseName}_thumb.jpg`, {
                    type: "image/jpeg",
                  });
                  const previewUrl = URL.createObjectURL(thumbFile);
                  resolve({ file: thumbFile, url: previewUrl });
                } else {
                  reject(new Error("Failed to create blob from canvas"));
                }
              },
              "image/jpeg",
              0.85,
            );
          } else {
            cleanup();
            reject(new Error("Could not get 2d context"));
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      video.onerror = (err) => {
        cleanup();
        reject(err);
      };
    });
  };

  const processSelectedVideo = async (file: File) => {
    setError("");
    setSelectedFile(file);
    setVideoFile(file);

    setIsGeneratingThumbnail(true);
    try {
      const { file: thumbFile, url: thumbUrl } =
        await generateVideoThumbnail(file);
      setModuleThumbnailFile(thumbFile);
      setModuleThumbnailPreview(thumbUrl);
      setIsCustomThumbnail(false);
    } catch (err) {
      console.warn(
        "Could not automatically generate thumbnail from video:",
        err,
      );
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

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
      void processSelectedVideo(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processSelectedVideo(file);
    }
  };

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) {
      setError("Please provide a module title.");
      return;
    }

    try {
      setIsCreatingModule(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const newModule = await createCourseModule(
        sessionData.session.access_token,
        selectedCurriculum,
        newModuleTitle,
        newModuleDescription,
        selectedSectionId || null,
      );

      setModules((prev) => [...prev, { ...newModule, module_type: "video" }]);
      setSelectedModuleId(String(newModule.id));
      setIsAddModuleModalOpen(false);
      setSuccess("Module created successfully!");

      // Clear form
      setNewModuleTitle("");
      setNewModuleDescription("");
    } catch (err: any) {
      setError(err.message || "Failed to create module");
    } finally {
      setIsCreatingModule(false);
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) {
      setError("Please provide a section title.");
      return;
    }

    try {
      setIsCreatingSection(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const newSection = await createCourseSection(
        sessionData.session.access_token,
        selectedCurriculum,
        newSectionTitle,
        newSectionDescription,
      );

      setSections((prev) => [...prev, newSection]);
      setSelectedSectionId(String(newSection.id));
      setIsAddSectionModalOpen(false);
      setSuccess("Section created successfully!");

      // Clear form
      setNewSectionTitle("");
      setNewSectionDescription("");
    } catch (err: any) {
      setError(err.message || "Failed to create section");
    } finally {
      setIsCreatingSection(false);
    }
  };

  const handleUploadVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setUploadProgress(0);
    setUploadStatus("");

    const selectedModule = modules.find(
      (m) => String(m.id) === String(selectedModuleId),
    );

    if (selectedModule?.module_type === "quiz") {
      setError("Cannot upload a video to a Quiz module. Only Video modules are supported.");
      return;
    }

    const effectiveVideoTitle = selectedModule?.title || "";

    if (
      !selectedCurriculum ||
      !selectedProductId ||
      !selectedModuleId ||
      !effectiveVideoTitle ||
      !selectedFile
    ) {
      setError(
        "Please select a course, a batch, a module, and choose a video file.",
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
      const chunkSize = 190 * 1024 * 1024; // 190MB chunks
      const numChunks = Math.ceil(fileSize / chunkSize);
      const uploadedUIDs: string[] = [];

      for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        const chunk = selectedFile.slice(start, end);

        setUploadStatus(
          numChunks > 1
            ? `Uploading part ${chunkIndex + 1} of ${numChunks}...`
            : "",
        );

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
                  ? `${effectiveVideoTitle} (Part ${chunkIndex + 1}/${numChunks})`
                  : effectiveVideoTitle,
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

        const uploadChunkWithRetry = async (maxRetries = 3) => {
          let lastError: Error | null = null;

          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("POST", uploadURL);

                xhr.upload.onprogress = (event) => {
                  if (event.lengthComputable) {
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
              return;
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

      // Save the uploaded video against the selected course module.
      const payload = new FormData();
      payload.append("maincourseId", selectedCurriculum);
      payload.append("moduleId", selectedModuleId);
      payload.append("title", effectiveVideoTitle);
      payload.append("cloudflareUids", JSON.stringify(uploadedUIDs));
      if (selectedSectionId) {
        payload.append("sectionId", selectedSectionId);
      }

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

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>
            Video Asset Upload
          </h1>
          <p
            className={
              TYPOGRAPHY.BODY.fontSize +
              " " +
              TYPOGRAPHY.BODY.lineHeight +
              " " +
              TYPOGRAPHY.BODY.fontWeight +
              " text-gray-600"
            }
          >
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
                {activeCourses.length}
              </div>
              <div className="text-xs text-gray-500 font-medium whitespace-nowrap">
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

        {/* Main Content - 1 Column Layout */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* Top Panel - Upload Form */}
          <div className="space-y-6 min-w-0">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className={TYPOGRAPHY_CLASSES.SUBHEADING + " mb-4"}>
                Upload New Video
              </h3>

              <form onSubmit={handleUploadVideo} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Select Product */}
                  <div>
                    <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                      Select Product
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className={`${TYPOGRAPHY_CLASSES.CAPTION} ${
                        !selectedProductId ? "!text-gray-400" : "!text-gray-900"
                      } w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer`}
                      style={{
                        fontSize: TYPOGRAPHY.CAPTION.fontSize,
                        lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                        fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                      }}
                    >
                      <option value="" className="text-gray-400">
                        Select product...
                      </option>
                      {products.map((product) => (
                        <option
                          key={product.id}
                          value={String(product.id)}
                          className="text-gray-900"
                        >
                          {product.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Course */}
                  <div>
                    <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                      Select Course
                    </label>
                  <select
                    value={selectedCurriculum}
                    onChange={(e) => setSelectedCurriculum(e.target.value)}
                    disabled={!selectedProductId}
                    className={`${TYPOGRAPHY_CLASSES.CAPTION} ${
                      !selectedCurriculum ? "!text-gray-400" : "!text-gray-900"
                    } w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer disabled:opacity-50`}
                    style={{
                      fontSize: TYPOGRAPHY.CAPTION.fontSize,
                      lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                      fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                    }}
                  >
                    <option value="" className="text-gray-400">
                      {!selectedProductId
                        ? "Select a product first..."
                        : filteredCourses.length === 0
                          ? "No courses found for this product"
                          : "Select course..."}
                    </option>
                    {filteredCourses.map((course) => (
                      <option
                        key={course.id}
                        value={String(course.id)}
                        className="text-gray-900"
                      >
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Select Section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                    <label
                      className={TYPOGRAPHY_CLASSES.INNERHEADING + " !mb-0"}
                    >
                      Select Section
                    </label>
                    <button
                      type="button"
                      disabled={!selectedCurriculum}
                      onClick={() => {
                        setNewSectionTitle("");
                        setNewSectionDescription("");
                        setIsAddSectionModalOpen(true);
                      }}
                      className="text-xs font-semibold text-brand-primary hover:text-brand-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add Section
                    </button>
                  </div>

                  <select
                    value={selectedSectionId}
                    onChange={(e) => {
                      setSelectedSectionId(e.target.value);
                      setSelectedModuleId("");
                    }}
                    disabled={!selectedCurriculum || isSectionsLoading}
                    className={`${TYPOGRAPHY_CLASSES.CAPTION} ${
                      !selectedSectionId ? "!text-gray-400" : "!text-gray-900"
                    } w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer disabled:opacity-50`}
                    style={{
                      fontSize: TYPOGRAPHY.CAPTION.fontSize,
                      lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                      fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                    }}
                  >
                    <option value="" className="text-gray-400">
                      {isSectionsLoading
                        ? "Loading sections..."
                        : !selectedCurriculum
                          ? "Select a course first..."
                          : sections.length === 0
                            ? "No sections — modules will be ungrouped"
                            : "All sections (optional filter)"}
                    </option>
                    {sections.map((section, sIdx) => (
                      <option
                        key={section.id}
                        value={String(section.id)}
                        className="text-gray-900"
                      >
                        Section {sIdx + 1}: {section.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select Module */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      className={TYPOGRAPHY_CLASSES.INNERHEADING + " !mb-0"}
                    >
                      Select Module
                    </label>
                    <button
                      type="button"
                      disabled={!selectedCurriculum}
                      onClick={() => {
                        setNewModuleTitle(`Module ${modules.length + 1}`);
                        setNewModuleDescription("");
                        setIsAddModuleModalOpen(true);
                      }}
                      className="text-xs font-semibold text-brand-primary hover:text-brand-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add Module
                    </button>
                  </div>

                  <select
                    value={selectedModuleId}
                    onChange={(e) => setSelectedModuleId(e.target.value)}
                    disabled={!selectedCurriculum || isModulesLoading}
                    className={`${TYPOGRAPHY_CLASSES.CAPTION} ${
                      !selectedModuleId ? "!text-gray-400" : "!text-gray-900"
                    } w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer disabled:opacity-50`}
                    style={{
                      fontSize: TYPOGRAPHY.CAPTION.fontSize,
                      lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                      fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                    }}
                  >
                    <option value="" className="text-gray-400">
                      {isModulesLoading
                        ? "Loading modules..."
                        : !selectedCurriculum
                          ? "Select a course first..."
                          : filteredModules.length === 0
                            ? "No video modules found for this course"
                            : "Select module..."}
                    </option>
                    {filteredModules.map((module, mIdx) => (
                      <option
                        key={module.id}
                        value={String(module.id)}
                        className="text-gray-900"
                      >
                        Module {mIdx + 1}: {module.title}
                      </option>
                    ))}
                  </select>
                </div>
                </div>

                {/* Module Thumbnail Section (Before Video) */}
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
                      setIsCustomThumbnail(!!file);
                    }}
                    className={`${TYPOGRAPHY_CLASSES.CAPTION} ${
                      !moduleThumbnailFile ? "!text-gray-400" : "!text-gray-900"
                    } w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 cursor-pointer file:!text-gray-900`}
                    style={{
                      fontSize: TYPOGRAPHY.CAPTION.fontSize,
                      lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                      fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                    }}
                  />
                  {isGeneratingThumbnail && (
                    <p className="mt-2 text-xs text-blue-600 animate-pulse font-medium">
                      Auto-capturing thumbnail frame from video...
                    </p>
                  )}
                  {moduleThumbnailPreview && !isGeneratingThumbnail && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 relative group">
                      <img
                        src={moduleThumbnailPreview}
                        alt="Module thumbnail preview"
                        className="w-full h-36 object-cover"
                      />
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2.5 py-1 rounded backdrop-blur-sm flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-green-400"></span>
                        {isCustomThumbnail
                          ? "Custom thumbnail selected"
                          : "Auto-captured from video"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 rounded-xl p-4 sm:p-8 text-center cursor-pointer transition-all ${
                    isDragging
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
                    <p
                      className={`${TYPOGRAPHY.BODY.fontSize} ${TYPOGRAPHY.BODY.fontWeight} ${TYPOGRAPHY.BODY.lineHeight} text-brand-primary`}
                    >
                      Drop asset or click to browse
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={isUploading} className="w-full">
                  {isUploading
                    ? `Uploading... ${uploadProgress}%`
                    : "Upload Video Asset"}
                </Button>
              </form>
            </div>
          </div>

          {/* Right Panel - Active Courses */}
          <div className="min-w-0">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <h3 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
                  Active Courses
                </h3>
              </div>

              {isCoursesLoading ? (
                <p className="text-sm text-gray-500">Loading courses...</p>
              ) : activeCourses.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No active courses yet. Create an active course to get started.
                </p>
              ) : (
                <div className="relative px-2 sm:px-0">
                  <Carousel
                    opts={{ align: "start", dragFree: true }}
                    className="w-full relative"
                  >
                    <CarouselContent className="-ml-4 pb-2">
                      {activeCourses.map((course) => (
                        <CarouselItem
                          key={course.id}
                          className="pl-4 basis-full sm:basis-1/2 md:basis-1/2 lg:basis-1/2 xl:basis-1/2"
                        >
                          <CourseCard
                            id={course.id}
                            title={course.title}
                            description={course.description}
                            thumbnail={course.thumbnail_url}
                            batchName={course.batch_name}
                            courseStatus="active"
                            variant="admin"
                            showProgress={false}
                            onEdit={() =>
                              router.push(
                                `/admin/courses?action=edit&courseId=${encodeURIComponent(String(course.id))}`,
                              )
                            }
                            onDelete={() =>
                              router.push(
                                `/admin/courses?action=delete&courseId=${encodeURIComponent(String(course.id))}`,
                              )
                            }
                          />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="flex -left-3 sm:-left-4 w-8 h-8 bg-white border border-gray-200 shadow hover:bg-gray-50 z-10" />
                    <CarouselNext className="flex -right-3 sm:-right-4 w-8 h-8 bg-white border border-gray-200 shadow hover:bg-gray-50 z-10" />
                  </Carousel>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Create Module Modal */}
      <Modal
        open={isAddModuleModalOpen}
        onClose={() => setIsAddModuleModalOpen(false)}
        panelClassName="max-w-md w-full"
      >
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6 text-gray-900">
            Add New Module
          </h2>
          <form onSubmit={handleCreateModule} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Module Name
              </label>
              <input
                type="text"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder={`Module ${modules.length + 1}`}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={newModuleDescription}
                onChange={(e) => setNewModuleDescription(e.target.value)}
                placeholder="What will students learn in this module?"
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div className="pt-2 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModuleModalOpen(false)}
                disabled={isCreatingModule}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreatingModule || !newModuleTitle.trim()}
              >
                {isCreatingModule ? "Creating..." : "Create Module"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
      {/* Create Section Modal */}
      <Modal
        open={isAddSectionModalOpen}
        onClose={() => setIsAddSectionModalOpen(false)}
        panelClassName="max-w-md w-full"
      >
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6 text-gray-900">
            Add New Section
          </h2>
          <form onSubmit={handleCreateSection} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section Name
              </label>
              <input
                type="text"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="e.g. Introduction"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={newSectionDescription}
                onChange={(e) => setNewSectionDescription(e.target.value)}
                placeholder="What topics are covered in this section?"
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div className="pt-2 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddSectionModalOpen(false)}
                disabled={isCreatingSection}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreatingSection || !newSectionTitle.trim()}
              >
                {isCreatingSection ? "Creating..." : "Create Section"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
