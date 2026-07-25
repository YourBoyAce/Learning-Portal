"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Batch {
  id: number | string;
  name: string;
  description: string;
  created_at?: string;
  start_date?: string | null;
  course_id?: number | string | null;
  schedule_type?: "weekday" | "weekend" | string | null;
  batch_members?: { email: string | null }[];
  batch_courses?: { course_id: string | number | null }[];
  // Enriched from the parent course
  course_title?: string | null;
  course_thumbnail_url?: string | null;
}

interface BatchOption {
  value: string;
  label: string;
}

interface Profile {
  id: string;
  email: string | null;
  full_name?: string | null;
  role?: string | null;
}

interface Course {
  id: number | string;
  title: string;
  thumbnail_url?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAdminProfile(user: Profile): boolean {
  return user.role?.toLowerCase() === "admin";
}

function getProfileDisplayName(user: Pick<Profile, "full_name" | "email">): string {
  const name = user.full_name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Unknown user";
}

function findProfileByEmail(users: Profile[], email: string): Profile | undefined {
  return users.find((u) => u.email?.trim().toLowerCase() === email.toLowerCase());
}

function buildScholarSelectOptions(profileUsers: Profile[], memberEmails: string[] = []): BatchOption[] {
  const map = new Map<string, BatchOption>();
  for (const u of profileUsers) {
    const role = u.role?.toLowerCase();
    if (role === "admin" || role === "instructor") continue;
    if (!u.email) continue;
    const v = u.email.trim().toLowerCase();
    map.set(v, { value: v, label: getProfileDisplayName(u) });
  }
  for (const email of memberEmails) {
    if (map.has(email)) continue;
    const matched = findProfileByEmail(profileUsers, email);
    if (matched) {
      const role = matched.role?.toLowerCase();
      if (role === "admin" || role === "instructor") continue;
    }
    map.set(email, { value: email, label: matched ? getProfileDisplayName(matched) : email });
  }
  return Array.from(map.values());
}

function buildMentorSelectOptions(profileUsers: Profile[], mentorEmails: string[] = []): BatchOption[] {
  const map = new Map<string, BatchOption>();
  for (const u of profileUsers) {
    const role = u.role?.toLowerCase();
    if (role !== "admin" && role !== "instructor") continue;
    if (!u.email) continue;
    const v = u.email.trim().toLowerCase();
    map.set(v, { value: v, label: `${getProfileDisplayName(u)} (${role === "admin" ? "Admin" : "Instructor"})` });
  }
  for (const email of mentorEmails) {
    if (map.has(email)) continue;
    const matched = findProfileByEmail(profileUsers, email);
    map.set(email, { value: email, label: matched ? `${getProfileDisplayName(matched)} (${matched.role === "admin" ? "Admin" : "Instructor"})` : email });
  }
  return Array.from(map.values());
}

function buildSelectedScholars(memberEmails: string[], scholarOptions: BatchOption[], profileUsers: Profile[] = []): BatchOption[] {
  const optMap = new Map(scholarOptions.map((o) => [o.value, o]));
  return memberEmails.map((e) => {
    const matched = findProfileByEmail(profileUsers, e);
    return optMap.get(e) ?? { value: e, label: matched ? getProfileDisplayName(matched) : e };
  });
}

function buildSelectedMentors(mentorEmails: string[], mentorOptions: BatchOption[], profileUsers: Profile[] = []): BatchOption[] {
  const optMap = new Map(mentorOptions.map((o) => [o.value, o]));
  return mentorEmails.map((e) => {
    const matched = findProfileByEmail(profileUsers, e);
    return optMap.get(e) ?? { value: e, label: matched ? `${getProfileDisplayName(matched)} (${matched.role === "admin" ? "Admin" : "Instructor"})` : e };
  });
}

/** Derive batch name: "<CourseTitle> <MonthYear> <Schedule> Batch"
 *  Example: "Playwright June 2026 Weekday Batch"
 */
function deriveBatchName(courseTitle: string, dateStr: string, schedule: "weekday" | "weekend"): string {
  const scheduleLabel = schedule === "weekend" ? "Weekend" : "Weekday";
  if (!dateStr) return `${courseTitle} ${scheduleLabel} Batch`;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return `${courseTitle} ${scheduleLabel} Batch`;
  const month = d.toLocaleString("en-US", { month: "long" });
  const year = d.getFullYear();
  return `${courseTitle} ${month} ${year} ${scheduleLabel} Batch`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminBatches() {
  const router = useRouter();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [totalStudents, setTotalStudents] = useState(0);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<number | string | null>(null);

  // Form fields
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [scheduleType, setScheduleType] = useState<"weekday" | "weekend">("weekday");
  const [startDate, setStartDate] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<readonly BatchOption[]>([]);
  const [selectedMentors, setSelectedMentors] = useState<readonly BatchOption[]>([]);
  const [userSelectOptions, setUserSelectOptions] = useState<BatchOption[]>([]);
  const [mentorSelectOptions, setMentorSelectOptions] = useState<BatchOption[]>([]);

  // Loading flags
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [isLoadingAssignmentOptions, setIsLoadingAssignmentOptions] = useState(true);
  const [modalMessage, setModalMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Derived: auto-generated batch name shown in modal preview
  const previewBatchName = useMemo(() => {
    const course = courses.find((c) => String(c.id) === selectedCourseId);
    if (!course) return "";
    return deriveBatchName(course.title, startDate, scheduleType);
  }, [selectedCourseId, startDate, scheduleType, courses]);

  // Course options for single-select (active courses only — API already filters upcoming)
  const courseSelectOptions: BatchOption[] = useMemo(
    () => courses.map((c) => ({ value: String(c.id), label: c.title })),
    [courses],
  );

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchTotalStudents = async () => {
    try {
      const { data } = await supabase.from("batch_members").select("email");
      const unique = new Set(
        (data ?? []).map((r: any) => r.email).filter(Boolean),
      );
      setTotalStudents(unique.size);
    } catch (e) {
      console.error("Failed to fetch total students:", e);
    }
  };

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) return;

      const res = await fetch("/api/admin/batches", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || "Failed to fetch batches.");

      const rawBatches: any[] = Array.isArray(result?.batches) ? result.batches : [];

      // Enrich each batch with its parent course thumbnail + title
      const courseIds = [...new Set(rawBatches.map((b) => b.course_id).filter(Boolean))];
      let courseMap = new Map<string, { title: string; thumbnail_url: string | null }>();

      if (courseIds.length > 0) {
        const { data: courseRows } = await supabase
          .from("maincourses")
          .select("id, title, thumbnail_url")
          .in("id", courseIds);
        for (const c of courseRows ?? []) {
          courseMap.set(String(c.id), { title: c.title, thumbnail_url: c.thumbnail_url ?? null });
        }
      }

      const enriched: Batch[] = rawBatches.map((b) => {
        const courseInfo = b.course_id ? courseMap.get(String(b.course_id)) : undefined;
        return {
          ...b,
          course_title: courseInfo?.title ?? null,
          course_thumbnail_url: courseInfo?.thumbnail_url ?? null,
        };
      });

      setBatches(enriched);
    } catch (e) {
      console.error("Failed to fetch batches:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersAndCourses = async () => {
    try {
      setIsLoadingAssignmentOptions(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) return;

      const res = await fetch("/api/admin/batches?includeUsers=true&includeCourses=true", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || "Failed to fetch options.");

      const nextUsers: Profile[] = Array.isArray(result?.users) ? result.users : [];
      const nextCourses: Course[] = Array.isArray(result?.courses) ? result.courses : [];

      setUsers(nextUsers);
      setCourses(nextCourses);
      setUserSelectOptions(buildScholarSelectOptions(nextUsers));
      setMentorSelectOptions(buildMentorSelectOptions(nextUsers));
    } catch (e) {
      console.error("Failed to fetch assignment options:", e);
    } finally {
      setIsLoadingAssignmentOptions(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchTotalStudents();
  }, []);

  useEffect(() => {
    fetchUsersAndCourses();
  }, []);

  // ─── Modal open/reset helpers ───────────────────────────────────────────────

  function resetModal() {
    setIsEditing(false);
    setEditingBatchId(null);
    setSelectedCourseId("");
    setScheduleType("weekday");
    setStartDate("");
    setSelectedUsers([]);
    setSelectedMentors([]);
    setModalMessage(null);
    setIsLoadingAssignments(false);
  }

  const handleOpenCreate = () => {
    resetModal();
    void fetchUsersAndCourses();
    setShowModal(true);
  };

  const handleEdit = async (batch: Batch) => {
    resetModal();
    setIsEditing(true);
    setEditingBatchId(batch.id);
    setScheduleType(batch.schedule_type === "weekend" ? "weekend" : "weekday");
    setStartDate(batch.start_date ? String(batch.start_date).slice(0, 10) : "");

    // Course ID
    const cId = batch.course_id ? String(batch.course_id) : "";
    setSelectedCourseId(cId);

    setIsLoadingAssignments(true);
    setModalMessage(null);
    setShowModal(true);
    void fetchUsersAndCourses();

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) throw new Error("Not authenticated.");

      const res = await fetch(
        `/api/admin/batches?includeAssignments=true&includeUsers=true&includeCourses=true&batchId=${encodeURIComponent(String(batch.id))}`,
        { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } },
      );
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || "Failed to load batch details.");

      const latestUsers: Profile[] = Array.isArray(result?.users) ? result.users : users;
      const latestCourses: Course[] = Array.isArray(result?.courses) ? result.courses : courses;
      setUsers(latestUsers);
      setCourses(latestCourses);
      setUserSelectOptions(buildScholarSelectOptions(latestUsers));
      setMentorSelectOptions(buildMentorSelectOptions(latestUsers));

      const memberEmails: string[] = Array.isArray(result?.assignment?.memberEmails)
        ? result.assignment.memberEmails.map((e: unknown) =>
            typeof e === "string" ? e.trim().toLowerCase() : "",
          ).filter(Boolean)
        : (batch.batch_members ?? []).map((m) => m.email?.trim().toLowerCase() ?? "").filter(Boolean);

      const mentorEmails: string[] = Array.isArray(result?.assignment?.mentorEmails)
        ? result.assignment.mentorEmails.map((e: unknown) =>
            typeof e === "string" ? e.trim().toLowerCase() : "",
          ).filter(Boolean)
        : [];

      const scholarOpts = buildScholarSelectOptions(latestUsers, memberEmails);
      const mentorOpts = buildMentorSelectOptions(latestUsers, mentorEmails);

      setUserSelectOptions(scholarOpts);
      setMentorSelectOptions(mentorOpts);
      setSelectedUsers(buildSelectedScholars(memberEmails, scholarOpts, latestUsers));
      setSelectedMentors(buildSelectedMentors(mentorEmails, mentorOpts, latestUsers));
    } catch (e) {
      console.error("Failed to fetch batch assignments:", e);
      setModalMessage({ type: "error", text: "Failed to load assignments. Showing saved data." });
    } finally {
      setIsLoadingAssignments(false);
    }
  };

  // ─── Save ───────────────────────────────────────────────────────────────────

  const handleSaveBatch = async () => {
    if (!selectedCourseId) {
      setModalMessage({ type: "error", text: "Please select a course." });
      return;
    }
    if (!startDate) {
      setModalMessage({ type: "error", text: "Please pick a start date so the batch name can be generated." });
      return;
    }

    const course = courses.find((c) => String(c.id) === selectedCourseId);
    const generatedName = deriveBatchName(course?.title ?? "Batch", startDate, scheduleType);

    try {
      setIsSaving(true);
      setModalMessage(null);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) throw new Error("Please log in again.");

      // Use course description as the batch description
      const courseDescription = course
        ? (courses.find((c) => String(c.id) === selectedCourseId) as any)?.description ?? ""
        : "";

      const body = {
        ...(isEditing && editingBatchId ? { id: editingBatchId } : {}),
        name: generatedName,
        description: courseDescription,
        start_date: startDate || null,
        schedule_type: scheduleType,
        assigned_scholars: selectedUsers.map((u) => u.value),
        assigned_mentors: selectedMentors.map((u) => u.value),
        assigned_courses: [selectedCourseId],
      };

      const res = await fetch("/api/admin/batches", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || `Request failed (${res.status}).`);

      await fetchBatches();
      await fetchTotalStudents();
      setShowModal(false);
      resetModal();
      setToastMessage(isEditing ? "Batch updated successfully." : "Batch created successfully.");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (e) {
      setModalMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to save batch." });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Delete ─────────────────────────────────────────────────────────────────

  const handleDeleteClick = (batch: Batch) => {
    setDeletingBatch(batch);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingBatch) return;
    try {
      setIsDeleting(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) throw new Error("Please log in again.");

      const res = await fetch(`/api/admin/batches?id=${encodeURIComponent(String(deletingBatch.id))}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ id: deletingBatch.id }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || "Failed to delete batch.");

      await fetchBatches();
      await fetchTotalStudents();
      setShowDeleteConfirm(false);
      setDeletingBatch(null);
    } catch (e) {
      console.error("Failed to delete batch:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Derived lists ──────────────────────────────────────────────────────────

  const filteredBatches = batches
    .filter((b) => b.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (a.start_date || a.created_at || "").localeCompare(b.start_date || b.created_at || ""));

  const stats = [
    { label: "Total Batches", value: String(batches.length), icon: ICONS.BATCH },
    { label: "Total Students", value: String(totalStudents), icon: ICONS.USERS },
    { label: "Published", value: String(batches.length), icon: ICONS.GLOBE },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>Manage Batches</h1>
            <p className={`${TYPOGRAPHY.BODY.fontSize} ${TYPOGRAPHY.BODY.lineHeight} ${TYPOGRAPHY.BODY.fontWeight} text-gray-600`}>
              Create, edit, and manage your batch catalog.
            </p>
          </div>
          <Button onClick={handleOpenCreate} className="w-full justify-center sm:w-auto">
            <Plus className="w-4 h-4" />
            New Batch
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center gap-4">
              <div className="flex items-center justify-center shrink-0">
                <Image src={stat.icon} alt={stat.label} width={40} height={40} />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold" style={{ color: "var(--color-primary)", fontFamily: "var(--font-primary)" }}>
                  {stat.value}
                </span>
                <span className="text-sm" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-primary)" }}>
                  {stat.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Batch Catalog */}
        <div>
          <div className="flex items-center justify-between flex-wrap gap-4 mt-12 mb-6">
            <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>Batch Catalog</h2>
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

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
              <p className="text-sm font-medium text-gray-500">Loading your catalog...</p>
            </div>
          )}

          {!loading && filteredBatches.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm text-center px-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-lg text-gray-900 font-bold mb-2">
                {searchTerm ? "No batches match your search" : "Your catalog is empty"}
              </p>
              {!searchTerm && (
                <>
                  <p className="text-sm text-gray-500 mb-6 max-w-md">Create your first batch to get started.</p>
                  <button
                    onClick={handleOpenCreate}
                    className="bg-brand-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-hover transition-colors inline-flex items-center gap-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Create Batch
                  </button>
                </>
              )}
            </div>
          )}

          {!loading && filteredBatches.length > 0 && (
            <div className="relative">
              <Carousel opts={{ align: "start", loop: false, dragFree: true }} className="w-full">
                <CarouselContent className="-ml-4 sm:-ml-6 pb-6">
                  {filteredBatches.map((batch) => (
                    <CarouselItem key={batch.id} className="pl-4 sm:pl-6 basis-[85vw] sm:basis-1/2 lg:basis-1/3">
                      <div className="flex flex-col h-full justify-between">
                        <CourseCard
                          id={batch.id}
                          title={batch.name}
                          description={batch.description || batch.course_title || ""}
                          thumbnail={batch.course_thumbnail_url ?? undefined}
                          batchScheduleTypes={[batch.schedule_type === "weekend" ? "weekend" : "weekday"]}
                          variant="admin"
                          onClick={() => router.push(`/admin/batches/${batch.id}`)}
                          onEdit={() => handleEdit(batch)}
                          onDelete={() => handleDeleteClick(batch)}
                        />
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2 mt-3 text-left">
                          <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-gray-500 uppercase tracking-wider">
                            <Users size={12} className="text-purple-500" />
                            <span>Assigned Mentors</span>
                          </div>
                          {(() => {
                            const memberEmails = (batch.batch_members ?? []).map((m) => m.email?.trim().toLowerCase());
                            const assignedMentorsForBatch = users.filter(
                              (u) => u.email && memberEmails.includes(u.email.trim().toLowerCase()) &&
                                     (u.role?.toLowerCase() === "instructor" || u.role?.toLowerCase() === "admin")
                            );

                            if (assignedMentorsForBatch.length === 0) {
                              return <div className="text-gray-400 text-[10px] italic">No mentors assigned</div>;
                            }

                            return (
                              <div className="flex flex-wrap gap-1">
                                {assignedMentorsForBatch.map((mentor) => (
                                  <span key={mentor.id} className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                    {mentor.full_name || mentor.email}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="flex left-2 lg:-left-5 bg-white shadow-lg border border-gray-100 text-brand-primary hover:bg-gray-50 h-8 w-8 lg:h-10 lg:w-10 z-10" />
                <CarouselNext className="flex right-2 lg:-right-5 bg-white shadow-lg border border-gray-100 text-brand-primary hover:bg-gray-50 h-8 w-8 lg:h-10 lg:w-10 z-10" />
              </Carousel>
            </div>
          )}
        </div>
      </div>

      {/* ─── CREATE / EDIT MODAL ─── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
              <h3 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
                {isEditing ? "Edit Batch" : "Create New Batch"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto scrollbar-thin scrollbar-track-slate-100 scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400" style={{ maxHeight: "calc(90vh - 130px)" }}>

              {/* 1. Course selector (single) */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BookOpen size={14} /> Course
                </label>
                <Select
                  isLoading={isLoadingAssignmentOptions}
                  isDisabled={isLoadingAssignmentOptions}
                  options={courseSelectOptions}
                  value={courseSelectOptions.find((o) => o.value === selectedCourseId) ?? null}
                  onChange={(opt) => setSelectedCourseId(opt?.value ?? "")}
                  placeholder="Select course..."
                  isClearable
                  menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                  styles={{
                    menuPortal: (b) => ({ ...b, zIndex: 9999 }),
                    option: (b) => ({ ...b, color: "#000" }),
                    input: (b) => ({ ...b, color: "#000" }),
                    singleValue: (b) => ({ ...b, color: "#000" }),
                    control: (b) => ({ ...b, minHeight: "46px", borderColor: "#e5e7eb", boxShadow: "none" }),
                  }}
                />
              </div>

              {/* 2. Assign Members */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users size={14} /> Assign Members
                </label>
                <Select
                  isMulti
                  isLoading={isLoadingAssignments || isLoadingAssignmentOptions}
                  isDisabled={isLoadingAssignments || isLoadingAssignmentOptions}
                  options={userSelectOptions}
                  value={selectedUsers}
                  onChange={(v) => setSelectedUsers((v ?? []) as readonly BatchOption[])}
                  placeholder="Select members..."
                  menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                  styles={{
                    menuPortal: (b) => ({ ...b, zIndex: 9999 }),
                    option: (b) => ({ ...b, color: "#000" }),
                    input: (b) => ({ ...b, color: "#000" }),
                    multiValueLabel: (b) => ({ ...b, color: "#000" }),
                    control: (b) => ({ ...b, minHeight: "46px", borderColor: "#e5e7eb", boxShadow: "none" }),
                  }}
                />
              </div>

              {/* 2b. Assign Mentors */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users size={14} className="text-purple-500" /> Assign Mentors / Instructors
                </label>
                <Select
                  isMulti
                  isLoading={isLoadingAssignments || isLoadingAssignmentOptions}
                  isDisabled={isLoadingAssignments || isLoadingAssignmentOptions}
                  options={mentorSelectOptions}
                  value={selectedMentors}
                  onChange={(v) => setSelectedMentors((v ?? []) as readonly BatchOption[])}
                  placeholder="Select mentors..."
                  menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                  styles={{
                    menuPortal: (b) => ({ ...b, zIndex: 9999 }),
                    option: (b) => ({ ...b, color: "#000" }),
                    input: (b) => ({ ...b, color: "#000" }),
                    multiValueLabel: (b) => ({ ...b, color: "#000" }),
                    control: (b) => ({ ...b, minHeight: "46px", borderColor: "#e5e7eb", boxShadow: "none" }),
                  }}
                />
              </div>

              {/* 3. Schedule */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                  Batch Schedule
                </label>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <input type="radio" name="batchScheduleType" checked={scheduleType === "weekday"} onChange={() => setScheduleType("weekday")} className="accent-brand-primary" />
                    Weekday Batch
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <input type="radio" name="batchScheduleType" checked={scheduleType === "weekend"} onChange={() => setScheduleType("weekend")} className="accent-brand-primary" />
                    Weekend Batch
                  </label>
                </div>
              </div>

              {/* 4. Start date */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={14} /> Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#1682F1]/10 border border-[#1682F1]/20 rounded-xl px-4 py-3 text-sm text-[#174778] font-semibold outline-none focus:border-[#1682F1] focus:ring-2 focus:ring-[#1682F1]/20 transition-all cursor-pointer"
                />
              </div>

              {/* Generated batch name preview */}
              {previewBatchName && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Generated Batch Name</p>
                  <p className="text-sm font-bold text-gray-900">{previewBatchName}</p>
                </div>
              )}

              {modalMessage && (
                <div className={`text-sm px-3 py-2 rounded-lg ${modalMessage.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {modalMessage.text}
                </div>
              )}

              <button
                onClick={handleSaveBatch}
                disabled={isSaving || isLoadingAssignments || isLoadingAssignmentOptions}
                className="w-full bg-brand-primary hover:bg-brand-hover text-white py-3.5 rounded-lg text-sm font-semibold transition-all shadow-sm mt-2 disabled:opacity-60"
              >
                {isSaving ? "Saving..." : isEditing ? "Update Batch" : "Create Batch"}
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
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Delete Batch</h3>
              <p className="text-sm text-gray-500 text-center">
                Are you sure you want to delete <strong className="text-gray-900">{deletingBatch.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletingBatch(null); }}
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

      {/* ─── TOAST ─── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[100]">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
