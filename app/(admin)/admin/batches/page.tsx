"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import Select from "react-select";
import {
  BookOpen,
  Users,
  CheckCircle,
  Plus,
  Search,
  Pencil,
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

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      if (isEditing && editingBatchId) {
        const response = await fetch("/api/admin/batches", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            id: editingBatchId,
            name,
            description,
            start_date: created_at || null,
            assigned_scholars: selectedUsers.map((user) => user.value),
            assigned_courses: selectedCourses.map((course) => course.value),
          }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            result?.error || `Request failed (${response.status}).`,
          );
        }
      } else {
        const response = await fetch("/api/admin/batches", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            name,
            description,
            start_date: created_at || null,
            assigned_scholars: selectedUsers.map((user) => user.value),
            assigned_courses: selectedCourses.map((course) => course.value),
          }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            result?.error || `Request failed (${response.status}).`,
          );
        }
      }

      await fetchBatches();
      setShowModal(false);
      setBatchName("");
      setBatchDescription("");
      setCreated_At("");
      setSelectedUsers([]);
      setSelectedCourses([]);
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
  const courseTitleById = new Map(
    courses.map((course) => [String(course.id), course.title]),
  );
  const groupedBatches = filteredBatches.reduce(
    (acc, batch) => {
      const courseTitle = batch.course_id
        ? (courseTitleById.get(String(batch.course_id)) ?? "Unassigned Course")
        : "Unassigned Course";
      if (!acc[courseTitle]) acc[courseTitle] = [];
      acc[courseTitle].push(batch);
      return acc;
    },
    {} as Record<string, Batch[]>,
  );
  Object.values(groupedBatches).forEach((courseBatches) => {
    courseBatches.sort((a, b) => {
      const aDate = a.start_date || a.created_at || "";
      const bDate = b.start_date || b.created_at || "";
      return aDate.localeCompare(bDate);
    });
  });

  const stats = [
    {
      label: "Total Batches",
      value: batches.length.toString(),
      icon: BookOpen,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
    },
    {
      label: "Total Students",
      value: "—",
      icon: Users,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Published",
      value: batches.length.toString(),
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
            <h1 className="text-3xl font-bold text-[#174778] tracking-tight">
              Manage Batches
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Create, edit, and publish your batch catalog.
            </p>
          </div>
          <button
            onClick={() => {
              setShowModal(true);
            }}
            className="bg-[#174778] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#113a63] transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Batch
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* Batches Grid */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-base font-bold text-gray-900">
              Batches By Course
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search batches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174778] focus:border-transparent w-60 text-black"
              />
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 text-[#174778] animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading batches...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredBatches.length === 0 && (
            <div className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">
                {searchTerm ? "No batches match your search" : "No batches yet"}
              </p>
              {!searchTerm && (
                <p className="text-sm text-gray-400 mb-4">
                  Create your first batch to get started.
                </p>
              )}
              {!searchTerm && (
                <button
                  onClick={() => setShowModal(true)}
                  className="bg-[#174778] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#113a63] transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Batch
                </button>
              )}
            </div>
          )}

          {/* Grid */}
          {!loading && filteredBatches.length > 0 && (
            <div className="p-6 space-y-6">
              {Object.entries(groupedBatches).map(([courseTitle, courseBatches]) => (
                <div key={courseTitle} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900">
                      {courseTitle}
                    </h4>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {courseBatches.length} Batch
                      {courseBatches.length > 1 ? "es" : ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {courseBatches.map((batch) => (
                      <div
                        key={batch.id}
                        className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 bg-[#174778]/10 rounded-lg flex items-center justify-center shrink-0">
                              <BookOpen className="w-4 h-4 text-[#174778]" />
                            </div>
                            <p className="font-semibold text-gray-900 text-sm truncate">
                              {batch.name}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200 shrink-0">
                            <CheckCircle className="w-3 h-3" />
                            Active
                          </span>
                        </div>

                        <p className="text-sm text-gray-500 line-clamp-2 min-h-[40px]">
                          {batch.description || "—"}
                        </p>

                        <p className="text-xs text-gray-500 mt-3">
                          {batch.start_date
                            ? new Date(batch.start_date).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )
                            : "—"}
                        </p>

                        <div className="flex items-center justify-end gap-2 mt-4">
                          <button
                            onClick={() => handleEdit(batch)}
                            className="p-2 text-gray-400 hover:text-[#174778] hover:bg-[#174778]/5 rounded-lg transition-colors"
                            name="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(batch)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            name="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── CREATE / EDIT MODAL ─── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
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
            <div className="p-6 space-y-4">
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
                  isMulti={false}
                  options={courses.map((course) => ({
                    value: String(course.id),
                    label: course.title,
                  }))}
                  value={selectedCourses[0] ?? null}
                  onChange={(value) =>
                    setSelectedCourses(
                      value ? ([value] as readonly BatchOption[]) : [],
                    )
                  }
                  placeholder="Select courses..."
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
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all text-black"
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
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all resize-y text-black"
                />
              </div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText size={14} /> Date
              </label>
              <input
                type="date"
                value={created_at}
                onChange={(e) => setCreated_At(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all text-black"
              />

              {/* Submit Button */}
              {modalMessage && (
                <div
                  className={`text-sm px-3 py-2 rounded-lg ${
                    modalMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {modalMessage.text}
                </div>
              )}
              <button
                onClick={handleSaveBatch}
                className="w-full bg-[#174778] hover:bg-[#113a63] text-white py-3.5 rounded-lg text-sm font-semibold transition-all shadow-sm mt-2"
              >
                {isSaving
                  ? "Saving..."
                  : isEditing
                    ? "Update Batch"
                    : "Create Batch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL ─── */}
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

      {/* ─── TOAST NOTIFICATION ─── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[100] transform transition-all duration-300 translate-y-0 opacity-100">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
