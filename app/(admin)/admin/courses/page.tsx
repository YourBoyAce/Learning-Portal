"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import {
  BookOpen,
  CheckCircle,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Loader2,
  Upload,
  ImageIcon,
} from "lucide-react";

interface Course {
  id: number | string;
  title: string;
  description: string;
  thumbnail_url?: string;
  created_at?: string;
  category?: string;
}

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Create/Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<
    number | string | null
  >(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [modules, setModules] = useState<
    Array<{ id?: string | number; title: string; description: string }>
  >([{ title: "", description: "" }]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [modalMessage, setModalMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        console.error("Auth error:", sessionError);
        return;
      }

      const response = await fetch("/api/admin/courses", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      const result = await response.json().catch(() => null);

      if (response.ok && Array.isArray(result?.courses)) {
        setCourses(result.courses);
      }
    } catch (error) {
      console.error("Failed to fetch courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setIsEditing(false);
    setEditingCourseId(null);
    setCourseTitle("");
    setCourseDescription("");
    setModules([{ title: "", description: "" }]);
    setThumbnailFile(null);
    setThumbnailPreview("");
    setModalMessage(null);
    setShowModal(true);
  };

  const handleEdit = async (course: Course) => {
    setIsEditing(true);
    setEditingCourseId(course.id);
    setCourseTitle(course.title);
    setCourseDescription(course.description || "");
    setModules([]);
    setThumbnailFile(null);
    setThumbnailPreview(course.thumbnail_url || "");
    setModalMessage(null);
    setShowModal(true);

    try {
      const { data, error } = await supabase
        .from("coursemodules")
        .select("*")
        .eq("maincourse_id", course.id)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        setModules(
          data.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description || "",
          }))
        );
      } else {
        setModules([]);
      }
    } catch (err) {
      console.error("Failed to fetch modules:", err);
      setModules([]);
    }
  };

  const handleAddModule = () => {
    setModules([...modules, { title: "", description: "" }]);
  };

  const handleModuleChange = (index: number, field: "title" | "description", value: string) => {
    const newModules = [...modules];
    newModules[index][field] = value;
    setModules(newModules);
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveModule = (index: number) => {
    setModules(modules.filter((_, i) => i !== index));
  };

  const handleSaveCourse = async () => {
    const title = courseTitle.trim();
    const description = courseDescription.trim();
    const validModules = modules
      .filter((m) => m.title.trim())
      .map((m) => ({
        ...(m.id && { id: m.id }),
        title: m.title.trim(),
        description: m.description.trim(),
      }));

    if (!title || !description) {
      setModalMessage({
        type: "error",
        text: "Please add both course title and description.",
      });
      return;
    }

    try {
      setIsSaving(true);
      setModalMessage(null);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      // Upload thumbnail if provided
      let thumbnailUrl: string | null | undefined;
      if (thumbnailFile) {
        // New file uploaded
        const fileExt = thumbnailFile.name.split(".").pop();
        const fileName = `course-thumbnails/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("course-thumbnails")
          .upload(fileName, thumbnailFile);
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("course-thumbnails")
            .getPublicUrl(fileName);
          thumbnailUrl = urlData.publicUrl;
        }
      } else if (isEditing && !thumbnailPreview) {
        // Thumbnail was removed during edit
        thumbnailUrl = null;
      } else {
        // No change to thumbnail
        thumbnailUrl = undefined;
      }

      if (isEditing && editingCourseId) {
        // Update existing course
        const response = await fetch("/api/admin/courses", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            id: editingCourseId,
            title,
            description,
            ...(thumbnailUrl !== undefined && { thumbnail_url: thumbnailUrl }),
            modules: validModules,
          }),
        });

        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            result?.error || `Request failed (${response.status}).`,
          );
        }
      } else {
        // Create new course
        const response = await fetch("/api/admin/courses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            title,
            description,
            ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }),
            modules: validModules,
          }),
        });

        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            result?.error || `Request failed (${response.status}).`,
          );
        }
      }

      await fetchCourses();
      setShowModal(false);
      setCourseTitle("");
      setCourseDescription("");
      setThumbnailFile(null);
      setThumbnailPreview("");
    } catch (error) {
      setModalMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to save course. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (course: Course) => {
    setDeletingCourse(course);
    setModalMessage(null);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCourse) return;

    try {
      setIsDeleting(true);
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      const response = await fetch(
        `/api/admin/courses?id=${deletingCourse.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Failed to delete course.");
      }

      await fetchCourses();
      setShowDeleteConfirm(false);
      setDeletingCourse(null);
    } catch (error) {
      setModalMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to delete course. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCourses = courses
    .filter((course) =>
      course.title.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });

  const stats = [
    {
      label: "Total Courses",
      value: courses.length.toString(),
      icon: BookOpen,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
    },
    {
      label: "Active Courses",
      value: courses.length.toString(),
      icon: CheckCircle,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#2283FF] tracking-tight">
              Manage Courses
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Create, edit, and publish your course catalog.
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="bg-[#2283FF] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#2283FF] transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Course
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4"
            >
              <div
                className={`w-12 h-12 ${stat.iconBg} rounded-xl flex items-center justify-center shrink-0`}
              >
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Course Catalog Header & Search */}
        <div className="flex items-center justify-between flex-wrap gap-4 mt-12 mb-6">
          <h3 className="text-xl font-bold text-gray-900">Course Catalog</h3>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 border text-gray-600 border-gray-200 rounded-xl text-sm bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2283FF] focus:border-transparent w-full sm:w-72 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Loader2 className="w-10 h-10 text-[#2283FF] animate-spin mb-4" />
            <p className="text-sm font-medium text-gray-500">
              Loading your catalog...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredCourses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm text-center px-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-lg text-gray-900 font-bold mb-2">
              {searchTerm
                ? "No courses match your search"
                : "Your catalog is empty"}
            </p>
            {!searchTerm && (
              <p className="text-sm text-gray-500 mb-6 max-w-md">
                Get started by creating your first course. You can add modules,
                descriptions, and publish it right away.
              </p>
            )}
            {!searchTerm && (
              <button
                onClick={handleCreateNew}
                className="bg-[#2283FF] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#2283FF] transition-colors inline-flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create First Course
              </button>
            )}
          </div>
        )}

        {/* Courses Grid */}
        {!loading && filteredCourses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-gray-200 transition-all duration-300 group flex flex-col overflow-hidden relative"
              >
                {/* Card Header (Image/Gradient) */}
                <div className="h-36 bg-gradient-to-br from-[#2283FF] to-[#2563eb] relative overflow-hidden">
                  {/* Course Thumbnail or Decorative Pattern */}
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]"></div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow-sm border border-white/10">
                      <CheckCircle className="w-3 h-3" /> Active
                    </span>
                  </div>

                  {/* Center Icon */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-20 transform group-hover:scale-110 transition-transform duration-500">
                    <BookOpen className="w-16 h-16 text-white" />
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col">
                  <h4 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-[#2283FF] transition-colors leading-tight">
                    {course.title}
                  </h4>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-6 flex-1">
                    {course.description || "No description available."}
                  </p>

                  {/* Card Footer */}
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between mt-auto">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      {course.created_at
                        ? new Date(course.created_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )
                        : "Recently Added"}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(course)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#2283FF] hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Course"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(course)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Course"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* â”€â”€â”€ CREATE / EDIT MODAL â”€â”€â”€ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {isEditing ? "Edit Course" : "Create New Course"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Course Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Playwright Mastery"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2283FF] focus:ring-2 focus:ring-[#2283FF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  placeholder="Describe the course content and learning objectives..."
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2283FF] focus:ring-2 focus:ring-[#2283FF]/20 resize-none"
                />
              </div>

              {/* Thumbnail Upload */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Course Thumbnail
                </label>
                {thumbnailPreview ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden border border-gray-200 group">
                    <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => { setThumbnailFile(null); setThumbnailPreview(""); }}
                        className="bg-white text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-[#2283FF] hover:bg-blue-50/30 transition-all group">
                    <Upload className="w-8 h-8 text-gray-300 group-hover:text-[#2283FF] transition-colors mb-2" />
                    <span className="text-xs text-gray-400 group-hover:text-[#2283FF] font-medium">Click to upload thumbnail</span>
                    <span className="text-[10px] text-gray-300 mt-1">PNG, JPG up to 5MB</span>
                    <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                  </label>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Modules (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddModule}
                    className="text-[#2283FF] hover:bg-[#2283FF]/10 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Module
                  </button>
                </div>

                {modules.map((module, index) => (
                  <div key={index} className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder={`Module ${index + 1} Title`}
                          value={module.title}
                          onChange={(e) =>
                            handleModuleChange(index, "title", e.target.value)
                          }
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2283FF] focus:ring-1 focus:ring-[#2283FF] bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveModule(index)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        title="Remove Module"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <textarea
                      placeholder={`Description for Module ${index + 1} (optional)`}
                      value={module.description}
                      onChange={(e) =>
                        handleModuleChange(index, "description", e.target.value)
                      }
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-[#2283FF] focus:ring-1 focus:ring-[#2283FF] resize-none bg-white"
                    />
                  </div>
                ))}
              </div>

              {modalMessage && (
                <p
                  className={`text-xs font-medium ${modalMessage.type === "success"
                      ? "text-emerald-600"
                      : "text-red-600"
                    }`}
                >
                  {modalMessage.text}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCourse}
                disabled={isSaving}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#2283FF] rounded-lg hover:bg-[#2283FF] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSaving
                  ? "Saving..."
                  : isEditing
                    ? "Save Changes"
                    : "Create Course"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€â”€ DELETE CONFIRMATION MODAL â”€â”€â”€ */}
      {showDeleteConfirm && deletingCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                Delete Course
              </h3>
              <p className="text-sm text-gray-500 text-center">
                Are you sure you want to delete{" "}
                <strong className="text-gray-900">
                  {deletingCourse.title}
                </strong>
                ? This action cannot be undone.
              </p>
              {modalMessage?.type === "error" && (
                <p className="text-xs text-red-600 text-center mt-3 font-medium">
                  {modalMessage.text}
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingCourse(null);
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
