"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import Select from "react-select";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/app/components/course";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY, TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  BookOpen,
  Users,
  CheckCircle,
  Plus,
  Search,
  Trash2,
  X,
  Loader2,
  LayoutTemplate,
  FileText,
} from "lucide-react";

interface Batch {
  id: number | string;
  name: string;
  description: string;
  thumbnail_url?: string | null;
  created_at?: string;
  start_date?: string | null;
  category?: string;
  course_id?: number | string | null;
}

interface BatchOption {
  value: string;
  label: string;
}

interface Profile {
  id: string;
  email: string | null;
  full_name?: string | null;
}

interface Course {
  id: number | string;
  title: string;
}

type SaveBatchBody = {
  id?: number | string;
  name: string;
  description: string;
  start_date: string | null;
  assigned_scholars: string[];
  assigned_courses: string[];
  thumbnail_url?: string | null;
};

export default function AdminBatches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<readonly BatchOption[]>(
    [],
  );
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<
    readonly BatchOption[]
  >([]);
  const [created_at, setCreated_At] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Create/Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<number | string | null>(
    null,
  );
  const [batchName, setBatchName] = useState("");
  const [batchDescription, setBatchDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [modalMessage, setModalMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [batchThumbnail, setBatchThumbnail] = useState<File | null>(null);
  const [batchThumbnailPreview, setBatchThumbnailPreview] = useState<string>("");
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);

  const fetchTotalStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("batch_members")
        .select("email");

      if (error) {
        console.error("Failed to fetch total students:", error.message);
        return;
      }

      const uniqueEmails = new Set(
        (data ?? [])
          .map((row: { email: string | null }) => row.email)
          .filter((email): email is string => Boolean(email))
      );
      setTotalStudents(uniqueEmails.size);
    } catch (error) {
      console.error("Failed to fetch total students:", error);
    }
  };

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch batches:", error.message);
        return;
      }
      setBatches(data ?? []);
    } catch (error) {
      console.error("Failed to fetch batches:", error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBatches();
    fetchTotalStudents();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        console.error("Auth error:", sessionError);
        return;
      }

      const response = await fetch(
        "/api/admin/batches?includeUsers=true&includeCourses=true",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          result?.error || `Request failed (${response.status}).`,
        );
      }

      setUsers(Array.isArray(result?.users) ? result.users : []);
      setCourses(Array.isArray(result?.courses) ? result.courses : []);
    } catch (error) {
      console.error(
        "Failed to fetch users/courses for batch assignment:",
        error,
      );
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, []);

  const handleEdit = async (batch: Batch) => {
    setIsEditing(true);
    setEditingBatchId(batch.id);
    setBatchName(batch.name);
    setBatchDescription(batch.description || "");
    setCreated_At(batch.start_date ? String(batch.start_date).slice(0, 10) : "");
    setBatchThumbnail(null);
    setBatchThumbnailPreview(batch.thumbnail_url || "");
    setModalMessage(null);
    setShowModal(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) return;

      const response = await fetch(
        `/api/admin/batches?includeAssignments=true&includeUsers=true&includeCourses=true&batchId=${batch.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.assignment) return;

      const memberEmails: string[] = Array.isArray(result.assignment.memberEmails)
        ? result.assignment.memberEmails
          .map((email: unknown) =>
            typeof email === "string" ? email.trim().toLowerCase() : "",
          )
          .filter(Boolean)
        : [];
      const courseIds: string[] = Array.isArray(result.assignment.courseIds)
        ? result.assignment.courseIds
        : [];
      const latestUsers: Profile[] = Array.isArray(result?.users)
        ? result.users
        : users;
      const latestCourses: Course[] = Array.isArray(result?.courses)
        ? result.courses
        : courses;

      setUsers(latestUsers);
      setCourses(latestCourses);

      const userOptions = latestUsers
        .filter((user) => Boolean(user.email))
        .map((user) => ({
          value: (user.email as string).trim().toLowerCase(),
          label: user.email as string,
        }));

      const courseOptions = latestCourses.map((course) => ({
        value: String(course.id),
        label: course.title,
      }));

      setSelectedUsers(
        userOptions.filter((option) => memberEmails.includes(option.value)),
      );
      setSelectedCourses(
        courseOptions.filter((option) =>
          courseIds.includes(String(option.value)),
        ),
      );
    } catch (error) {
      console.error("Failed to fetch existing batch assignments:", error);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setModalMessage({
        type: "error",
        text: "Please select a valid image file (JPG, PNG, WebP, etc.)",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setModalMessage({
        type: "error",
        text: "File size must be less than 5MB",
      });
      return;
    }

    setBatchThumbnail(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setBatchThumbnailPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setModalMessage(null);
  };

  const uploadThumbnailToStorage = async (file: File): Promise<string | null> => {
    try {
      setIsUploadingThumbnail(true);
      const timestamp = Date.now();
      const fileName = `batch-thumbnail-${timestamp}.${file.name.split(".").pop()}`;

      const { error } = await supabase.storage
        .from("course-thumbnails")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Upload error:", error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from("course-thumbnails")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Failed to upload thumbnail:", error);
      return null;
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleSaveBatch = async () => {
    const name = batchName.trim();
    const description = batchDescription.trim();

    if (!name || !description) {
      setModalMessage({
        type: "error",
        text: "Please add both batch name and description.",
      });
      return;
    }

    try {
      setIsSaving(true);
      setModalMessage(null);

      // Upload thumbnail if provided
      let thumbnailUrl: string | null | undefined;
      if (batchThumbnail) {
        thumbnailUrl = await uploadThumbnailToStorage(batchThumbnail);
        if (!thumbnailUrl) {
          throw new Error("Failed to upload thumbnail. Please try again.");
        }
      } else if (isEditing && !batchThumbnailPreview) {
        thumbnailUrl = null;
      } else {
        thumbnailUrl = undefined;
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      if (isEditing && editingBatchId) {
        const body: SaveBatchBody = {
          id: editingBatchId,
          name,
          description,
          start_date: created_at || null,
          assigned_scholars: selectedUsers.map((user) => user.value),
          assigned_courses: selectedCourses.map((course) => course.value),
        };
        if (thumbnailUrl !== undefined) {
          body.thumbnail_url = thumbnailUrl;
        }

        const response = await fetch("/api/admin/batches", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify(body),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            result?.error || `Request failed (${response.status}).`,
          );
        }
      } else {
        const body: SaveBatchBody = {
          name,
          description,
          start_date: created_at || null,
          assigned_scholars: selectedUsers.map((user) => user.value),
          assigned_courses: selectedCourses.map((course) => course.value),
        };
        if (thumbnailUrl) {
          body.thumbnail_url = thumbnailUrl;
        }

        const response = await fetch("/api/admin/batches", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify(body),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            result?.error || `Request failed (${response.status}).`,
          );
        }
      }

      await fetchBatches();
      await fetchTotalStudents();
      setShowModal(false);
      setBatchName("");
      setBatchDescription("");
      setCreated_At("");
      setSelectedUsers([]);
      setSelectedCourses([]);
      setBatchThumbnail(null);
      setBatchThumbnailPreview("");
      setToastMessage(
        isEditing
          ? "Batch updated successfully."
          : "Batch created successfully.",
      );
      setTimeout(() => setToastMessage(null), 3000);
    } catch (error) {
      setModalMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to save batch. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (batch: Batch) => {
    setDeletingBatch(batch);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingBatch) return;

    try {
      setIsDeleting(true);
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      const response = await fetch(
        `/api/admin/batches?id=${encodeURIComponent(String(deletingBatch.id))}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({ id: deletingBatch.id }),
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          result?.error || `Request failed (${response.status}).`,
        );
      }

      await fetchBatches();
      await fetchTotalStudents();
      setShowDeleteConfirm(false);
      setDeletingBatch(null);
    } catch (error) {
      console.error("Failed to delete batch:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredBatches = batches.filter((batch) =>
    batch.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const sortedBatches = [...filteredBatches].sort((a, b) => {
    const aDate = a.start_date || a.created_at || "";
    const bDate = b.start_date || b.created_at || "";
    return aDate.localeCompare(bDate);
  });

  const stats = [
    {
      label: "Total Batches",
      value: batches.length.toString(),
      icon: ICONS.BATCH,
    },
    {
      label: "Total Students",
      value: totalStudents.toString(),
      icon: ICONS.USERS,
    },
    {
      label: "Published",
      value: batches.length.toString(),
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
              Manage Batches
            </h1>
            <p className={TYPOGRAPHY.BODY.fontSize + " " + TYPOGRAPHY.BODY.lineHeight + " " + TYPOGRAPHY.BODY.fontWeight + " text-gray-600"}>
              Create, edit, and publish your batch catalog.
            </p>
          </div>
          <Button
            onClick={() => {
              setIsEditing(false);
              setEditingBatchId(null);
              setBatchName("");
              setBatchDescription("");
              setCreated_At("");
              setSelectedUsers([]);
              setSelectedCourses([]);
              setBatchThumbnail(null);
              setBatchThumbnailPreview("");
              setModalMessage(null);
              setShowModal(true);
            }}
            className="w-full justify-center sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            New Batch
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center gap-4"
            >
              <div className="flex items-center justify-center shrink-0">
                <Image
                  src={stat.icon}
                  alt={stat.label}
                  width={40}
                  height={40}
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

        {/* Batches Grid */}
        <div>
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4 mt-12 mb-6">
            <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
              Batch Catalog
            </h2>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search batches..."
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
          {!loading && filteredBatches.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm text-center px-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-lg text-gray-900 font-bold mb-2">
                {searchTerm
                  ? "No batches match your search"
                  : "Your catalog is empty"}
              </p>
              {!searchTerm && (
                <p className="text-sm text-gray-500 mb-6 max-w-md">
                  Create your first batch to get started.
                </p>
              )}
              {!searchTerm && (
                <button
                  onClick={() => setShowModal(true)}
                  className="bg-brand-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-hover transition-colors inline-flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create Batch
                </button>
              )}
            </div>
          )}

          {/* Batches Carousel */}
          {!loading && filteredBatches.length > 0 && (
            <div className="relative">
              <Carousel
                opts={{
                  align: "start",
                  loop: false,
                  dragFree: true,
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-4 sm:-ml-6 pb-6">
                  {sortedBatches.map((batch) => (
                    <CarouselItem
                      key={batch.id}
                      className="
  pl-4
  sm:pl-6
  basis-[85vw]
sm:basis-1/2
lg:basis-1/3
"
                    >
                      <CourseCard
                        id={batch.id}
                        title={batch.name}
                        description={batch.description}
                        thumbnail={batch.thumbnail_url || undefined}
                        createdAt={batch.start_date || batch.created_at}
                        variant="admin"
                        onEdit={() => handleEdit(batch)}
                        onDelete={() => handleDeleteClick(batch)}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>

                <CarouselPrevious
                  className="
          hidden
          lg:flex
          -left-5
          bg-white
          shadow-lg
          border
          border-gray-100
          text-brand-primary
          hover:bg-gray-50
        "
                />

                <CarouselNext
                  className="
          hidden
          lg:flex
          -right-5
          bg-white
          shadow-lg
          border
          border-gray-100
          text-brand-primary
          hover:bg-gray-50
        "
                />
              </Carousel>
            </div>
          )}
        </div>
      </div>

      {/* â”€â”€â”€ CREATE / EDIT MODAL â”€â”€â”€ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {isEditing ? "Edit Batch" : "Create New Batch"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div
              className="p-6 space-y-4 overflow-y-auto scrollbar-thin scrollbar-track-slate-100 scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400"
              style={{
                maxHeight: "calc(90vh - 180px)",
                scrollBehavior: "smooth",
              }}
            >
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users size={14} /> Assign Members (Email)
                </label>
                <Select
                  isMulti
                  options={users
                    .filter((user) => Boolean(user.email))
                    .map((user) => ({
                      value: user.email as string,
                      label: user.email as string,
                    }))}
                  value={selectedUsers}
                  onChange={(value) =>
                    setSelectedUsers((value ?? []) as readonly BatchOption[])
                  }
                  placeholder="Select user emails..."
                  menuPortalTarget={
                    typeof window !== "undefined" ? document.body : null
                  }
                  styles={{
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                    option: (base) => ({ ...base, color: "#000000" }),
                    input: (base) => ({ ...base, color: "#000000" }),
                    singleValue: (base) => ({ ...base, color: "#000000" }),
                    multiValueLabel: (base) => ({ ...base, color: "#000000" }),
                    control: (base) => ({
                      ...base,
                      minHeight: "46px",
                      borderColor: "#e5e7eb",
                      boxShadow: "none",
                    }),
                  }}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BookOpen size={14} /> Courses
                </label>
                <Select
                  isMulti={true}
                  options={courses.map((course) => ({
                    value: String(course.id),
                    label: course.title,
                  }))}
                  value={selectedCourses}
                  onChange={(value) =>
                    setSelectedCourses((value ?? []) as readonly BatchOption[])
                  }
                  placeholder="Select one or more courses..."
                  menuPortalTarget={
                    typeof window !== "undefined" ? document.body : null
                  }
                  styles={{
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                    option: (base) => ({ ...base, color: "#000000" }),
                    input: (base) => ({ ...base, color: "#000000" }),
                    singleValue: (base) => ({ ...base, color: "#000000" }),
                    multiValueLabel: (base) => ({ ...base, color: "#000000" }),
                    control: (base) => ({
                      ...base,
                      minHeight: "46px",
                      borderColor: "#e5e7eb",
                      boxShadow: "none",
                    }),
                  }}
                />
              </div>

              {/* Title */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <LayoutTemplate size={14} /> Batch Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Advanced Epistemology"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all text-black"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={14} /> Description
                </label>
                <textarea
                  placeholder="Brief details about the event..."
                  value={batchDescription}
                  onChange={(e) => setBatchDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all resize-y text-black"
                />
              </div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText size={14} /> Date
              </label>
              <input
                type="date"
                value={created_at}
                onChange={(e) => setCreated_At(e.target.value)}
                className="
                  w-full
                  bg-[#1682F1]/10
                  border
                  border-[#1682F1]/20
                  rounded-xl
                  px-4
                  py-3
                  text-sm
                  text-[#174778]
                  font-semibold
                  outline-none
                  focus:border-[#1682F1]
                  focus:ring-2
                  focus:ring-[#1682F1]/20
                  transition-all
                  cursor-pointer
                "
              />

              {/* Thumbnail Upload */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={14} /> Batch Thumbnail (Optional)
                </label>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    disabled={isUploadingThumbnail}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all text-black file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-brand-hover disabled:opacity-60"
                  />
                  {batchThumbnailPreview && (
                    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                      <div
                        role="img"
                        aria-label="Batch thumbnail preview"
                        className="w-full h-32 bg-cover bg-center"
                        style={{
                          backgroundImage: `url("${batchThumbnailPreview}")`,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setBatchThumbnail(null);
                          setBatchThumbnailPreview("");
                        }}
                        className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500">
                    Max file size: 5MB. Recommended: 1200×675px. JPG, PNG, WebP
                    supported.
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              {modalMessage && (
                <div
                  className={`text-sm px-3 py-2 rounded-lg ${modalMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                >
                  {modalMessage.text}
                </div>
              )}
              <button
                onClick={handleSaveBatch}
                disabled={isSaving || isUploadingThumbnail}
                className="w-full bg-brand-primary hover:bg-brand-hover text-white py-3.5 rounded-lg text-sm font-semibold transition-all shadow-sm mt-2 disabled:opacity-60"
              >
                {isSaving || isUploadingThumbnail
                  ? "Saving..."
                  : isEditing
                    ? "Update Batch"
                    : "Create Batch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€â”€ DELETE CONFIRMATION MODAL â”€â”€â”€ */}
      {showDeleteConfirm && deletingBatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                Delete Batch
              </h3>
              <p className="text-sm text-gray-500 text-center">
                Are you sure you want to delete{" "}
                <strong className="text-gray-900">{deletingBatch.name}</strong>?
                This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingBatch(null);
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

      {/* â”€â”€â”€ TOAST NOTIFICATION â”€â”€â”€ */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[100] transform transition-all duration-300 translate-y-0 opacity-100">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
