"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { CourseCard } from "@/app/components/course";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY, TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Image from "next/image";
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  X,
  Loader2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import CueCard from "@/app/components/course/CueCard";
interface Course {
  id: number | string;
  title: string;
  description: string;
  thumbnail_url?: string;
  created_at?: string;
  category?: string;
  course_type?: string;
  batch_name?: string | null;
  batch_schedule_types?: ("weekday" | "weekend")[];
}

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [courseType, setCourseType] = useState<"active" | "upcoming">("active");
  const router = useRouter();
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

    setCourseType("active");

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
    const validModules =
      courseType === "active"
        ? modules
          .filter((m) => m.title.trim())
          .map((m) => ({
            ...(m.id && { id: m.id }),
            title: m.title.trim(),
            description: m.description.trim(),
          }))
        : [];


    if (!courseTitle || (courseType === "active" && !courseDescription)) {
      setModalMessage({
        type: "error",
        text:
          courseType === "active"
            ? "Please add both course title and description."
            : "Please add a course title.",
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
            description: courseType === "active" ? description : null,
            ...(thumbnailUrl !== undefined && { thumbnail_url: thumbnailUrl }),
            modules: courseType === "active" ? validModules : [],
            course_type: courseType,
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
            description: courseType === "active" ? description : null,
            ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }),
            modules: courseType === "active" ? validModules : [],
            course_type: courseType,
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
      icon: ICONS.BOOK,
    },
    {
      label: "Active Courses",
      value: courses.length.toString(),
      icon: ICONS.GLOBE,
    },

  ];

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>
              Manage Courses
            </h1>
            <p className={TYPOGRAPHY.BODY.fontSize + " " + TYPOGRAPHY.BODY.lineHeight + " " + TYPOGRAPHY.BODY.fontWeight + " text-gray-600"}>
              Create, edit, and publish your course catalog.
            </p>
          </div>
          <Button
            onClick={handleCreateNew}
            className="w-full justify-center sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            New Course
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center gap-4"
            >
              <div className="flex items-center justify-center shrink-0">
                <Image
                  src={stat.icon}
                  alt={stat.label}
                  width={30}
                  height={30}
                />
              </div>

              <div className="flex flex-col">
                <span
                  className="text-2xl font-bold"
                  style={{
                    color: "var(--color-primary)",
                    fontFamily: "var(--font-primary)",
                  }}
                >
                  {stat.value}
                </span>

                <span
                  className="text-sm"
                  style={{
                    color: "var(--color-text-secondary)",
                    fontFamily: "var(--font-primary)",
                  }}
                >
                  {stat.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Course Catalog Header & Search */}
        <div className="flex items-center justify-between flex-wrap gap-4 mt-12 mb-6">
          <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>Course Catalog</h2>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 border text-gray-600 border-gray-200 rounded-xl text-sm bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent w-full sm:w-72 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
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
                className="bg-brand-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-hover transition-colors inline-flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create First Course
              </button>
            )}
          </div>
        )}

        {/* Derive our split lists right in the JSX */}
        {(() => {
          // Split the courses based on course_type
          const activeCourses = filteredCourses.filter(
            (c) => c.course_type !== "upcoming"
          );
          const upcomingCourses = filteredCourses.filter(
            (c) => c.course_type === "upcoming"
          );

          return (
            <>
              {/* --- 1. ACTIVE COURSES SECTION --- */}
              <div className="relative">
                {!loading && activeCourses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm text-center px-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <BookOpen className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-lg text-gray-900 font-bold mb-2">
                      No active courses found
                    </p>
                    <p className="text-sm text-gray-500 mb-6 max-w-md">
                      Get started by creating your first active course to populate this section.
                    </p>
                  </div>
                ) : (
                  <Carousel
                    opts={{
                      align: "start",
                      loop: false,
                      dragFree: true,
                    }}
                    className="w-full"
                  >
                    <CarouselContent className="-ml-4 sm:-ml-6 pb-6">
                      {activeCourses.map((course) => (
                        <CarouselItem
                          key={course.id}
                          className="pl-4 sm:pl-6 basis-[85vw] sm:basis-1/2 lg:basis-1/3"
                        >
                          <CourseCard
                            id={course.id}
                            title={course.title}
                            description={course.description}
                            thumbnail={course.thumbnail_url}
                            batchName={course.batch_name}
                            batchScheduleTypes={course.batch_schedule_types}
                            courseStatus="active"
                            variant="admin"
                            onClick={() =>
                              router.push(`/admin/courses/${course.id}`)
                            }
                            onEdit={() => handleEdit(course)}
                            onDelete={() => handleDeleteClick(course)}
                          />
                        </CarouselItem>
                      ))}
                    </CarouselContent>

                    <CarouselPrevious className="flex left-2 lg:-left-5 bg-white shadow-lg border border-gray-100 text-brand-primary hover:bg-gray-50 h-8 w-8 lg:h-10 lg:w-10 z-10" />
                    <CarouselNext className="flex right-2 lg:-right-5 bg-white shadow-lg border border-gray-100 text-brand-primary hover:bg-gray-50 h-8 w-8 lg:h-10 lg:w-10 z-10" />
                  </Carousel>
                )}
              </div>

              {/* --- 2. UPCOMING COURSES SECTION --- */}
              <div className="flex items-center justify-between flex-wrap gap-4 mt-16 mb-6">
                <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
                  Upcoming Courses
                </h2>
              </div>

              <div className="relative">
                {!loading && upcomingCourses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm text-center px-4">
                    <p className="text-gray-500 font-medium">
                      No upcoming courses scheduled.
                    </p>
                  </div>
                ) : (
                  <Carousel
                    opts={{
                      align: "start",
                      loop: false,
                      dragFree: true,
                    }}
                    className="w-full"
                  >
                    <CarouselContent className="-ml-4 sm:-ml-6 pb-8 pt-2">
                      {upcomingCourses.map((course) => (
                        <CarouselItem
                          key={course.id}
                          className="pl-4 sm:pl-6 basis-[85vw] sm:basis-[45%] lg:basis-[23%]"
                        >
                          <CueCard
                            title={course.title}
                            thumbnail={course.thumbnail_url}
                            isAdmin={true}
                            onClick={() =>
                              router.push(`/admin/courses/${course.id}`)
                            }
                            onEdit={(e) => {
                              e.stopPropagation();
                              handleEdit(course);
                            }}
                            onDelete={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(course);
                            }}
                          />
                        </CarouselItem>
                      ))}
                    </CarouselContent>

                    {upcomingCourses.length > 3 && (
                      <>
                        <CarouselPrevious className="flex left-2 lg:-left-5 bg-white shadow-lg border border-gray-100 text-brand-primary hover:bg-gray-50 h-8 w-8 lg:h-10 lg:w-10 z-10" />
                        <CarouselNext className="flex right-2 lg:-right-5 bg-white shadow-lg border border-gray-100 text-brand-primary hover:bg-gray-50 h-8 w-8 lg:h-10 lg:w-10 z-10" />
                      </>
                    )}
                  </Carousel>
                )}
              </div>
            </>
          );
        })()}
      </div>


      {/* â”€â”€â”€ CREATE / EDIT MODAL â”€â”€â”€ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
              <h3 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
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
            <div className="px-4 sm:px-6 py-5 space-y-5 overflow-y-auto flex-1">
              {!isEditing && (
                <div className="flex gap-6">

                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="radio"
                      checked={courseType === "active"}
                      onChange={() => setCourseType("active")}
                      className="accent-brand-primary"
                    />

                    Active Course
                  </label>


                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="radio"
                      checked={courseType === "upcoming"}
                      onChange={() => setCourseType("upcoming")}
                      className="accent-brand-primary"
                    />

                    Upcoming Course
                  </label>

                </div>
              )}
              <div>
                <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                  Course Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Playwright Mastery"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>

              <div>
                <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                  Description
                </label>
                <textarea
                  disabled={courseType === "upcoming"}
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm text-gray-900 resize-none
${courseType === "upcoming"
                      ? "bg-gray-100 cursor-not-allowed"
                      : "bg-white focus:border-brand-primary"
                    }`} />
              </div>

              {/* Thumbnail Upload */}
              <div>
                <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
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
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-brand-primary hover:bg-blue-50/30 transition-all group">
                    <Upload className="w-8 h-8 text-gray-300 group-hover:text-brand-primary transition-colors mb-2" />
                    <span className="text-xs text-gray-400 group-hover:text-brand-primary font-medium">Click to upload thumbnail</span>
                    <span className="text-[10px] text-gray-300 mt-1">PNG, JPG up to 5MB</span>
                    <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                  </label>
                )}
              </div>
              {courseType === "active" && (
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                      Modules (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddModule}
                      className="text-brand-primary hover:bg-brand-primary/10 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
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
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary bg-white"
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
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary resize-none bg-white"
                      />
                    </div>
                  ))}
                </div>
              )}

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
            <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCourse}
                disabled={isSaving}
                className="px-5 py-2 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
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
