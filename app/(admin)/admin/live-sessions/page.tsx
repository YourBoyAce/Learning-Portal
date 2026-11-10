"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY, TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import {
  formatLiveSessionSlot,
  isLiveSessionPast,
} from "@/app/lib/live-session-helpers";
import Image from "next/image";
import {
  Plus,
  Search,
  Trash2,
  Edit,
  Loader2,
  Calendar,
  CheckCircle,
  Users,
  Video,
  ExternalLink,
  CheckSquare,
  Square,
  AlertCircle,
} from "lucide-react";

interface ProUser {
  id: string;
  name: string;
  email: string;
}

interface LiveSession {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  event_date: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  icon: string;
  status: string;
  link_text: string;
  attendees_count: number;
  created_at: string;
  assigned_user_ids: string[];
}

export default function AdminLiveSessionsPage() {
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [proUsers, setProUsers] = useState<ProUser[]>([]);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingSession, setDeletingSession] = useState<LiveSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [meetingLink, setMeetingLink] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchLiveSessions = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/admin/live-sessions", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.error || "Failed to load live sessions.");
      }

      setLiveSessions(result?.sessions || []);
      setProUsers(result?.proUsers || []);
    } catch (error) {
      console.error("Failed to fetch live sessions:", error);
      showToast("Failed to load live sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLiveSessions();
  }, [fetchLiveSessions]);

  const handleOpenModal = (sessionItem?: LiveSession) => {
    setFormError(null);
    setMemberSearch("");

    if (sessionItem) {
      setIsEditing(true);
      setEditingId(sessionItem.id);
      setTitle(sessionItem.title);
      setSubtitle(sessionItem.subtitle || "");
      setDescription(sessionItem.description || "");
      setSessionDate(sessionItem.date || "");
      setStartTime(sessionItem.start_time || "10:00");
      setEndTime(sessionItem.end_time || "11:00");
      setMeetingLink(sessionItem.link_text || "");
      setSelectedUserIds(sessionItem.assigned_user_ids || []);
    } else {
      setIsEditing(false);
      setEditingId(null);
      setTitle("");
      setSubtitle("");
      setDescription("");
      const today = new Date().toISOString().split("T")[0];
      setSessionDate(today);
      setStartTime("10:00");
      setEndTime("11:00");
      setMeetingLink("");
      setSelectedUserIds([]);
    }
    setShowModal(true);
  };

  const allProSelected =
    proUsers.length > 0 && proUsers.every((u) => selectedUserIds.includes(u.id));

  const handleToggleSelectAllPro = () => {
    if (allProSelected) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(proUsers.map((u) => u.id));
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const filteredProUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return proUsers;
    return proUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [proUsers, memberSearch]);

  const handleSaveLiveSession = async () => {
    setFormError(null);

    if (!title.trim()) {
      setFormError("Please enter a live session title.");
      return;
    }
    if (!sessionDate || !startTime || !endTime) {
      setFormError("Please select the date, start time, and end time slot.");
      return;
    }
    if (endTime <= startTime) {
      setFormError("End time must be after start time.");
      return;
    }
    const trimmedLink = meetingLink.trim();
    if (!trimmedLink || !/^https?:\/\//i.test(trimmedLink)) {
      setFormError("Please paste a valid Zoom meeting link starting with https:// or http://.");
      return;
    }
    if (selectedUserIds.length === 0) {
      setFormError("Please select at least one Pro user for this live session.");
      return;
    }

    try {
      setIsSaving(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Admin session expired. Please log in again.");
      }

      const payload = {
        ...(isEditing && editingId ? { id: editingId } : {}),
        title: title.trim(),
        subtitle: subtitle.trim(),
        description: description.trim(),
        date: sessionDate,
        startTime,
        endTime,
        meetingLink: trimmedLink,
        selectedUserIds,
      };

      const res = await fetch("/api/admin/live-sessions", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.error || "Failed to save live session.");
      }

      showToast(
        isEditing
          ? `Live session updated for ${selectedUserIds.length} Pro user${selectedUserIds.length !== 1 ? "s" : ""}.`
          : `Live session created for ${selectedUserIds.length} Pro user${selectedUserIds.length !== 1 ? "s" : ""}.`,
      );
      setShowModal(false);
      await fetchLiveSessions();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to save live session.";
      console.error("Error saving live session:", error);
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (sessionItem: LiveSession) => {
    setDeletingSession(sessionItem);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSession) return;
    setIsDeleting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Admin session expired.");
      }

      const res = await fetch(
        `/api/admin/live-sessions?id=${encodeURIComponent(String(deletingSession.id))}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.error || "Failed to delete live session.");
      }

      showToast("Live session deleted successfully.");
      await fetchLiveSessions();
    } catch (error) {
      console.error("Error deleting live session:", error);
      showToast("Failed to delete live session.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeletingSession(null);
    }
  };

  const searchedSessions = liveSessions.filter(
    (s) =>
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.subtitle?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const upcomingSessions = searchedSessions.filter(
    (s) =>
      !isLiveSessionPast({
        eventDate: s.event_date,
        date: s.date,
        startTime: s.start_time,
        durationMinutes: s.duration_minutes,
      }),
  );

  const pastSessions = searchedSessions.filter((s) =>
    isLiveSessionPast({
      eventDate: s.event_date,
      date: s.date,
      startTime: s.start_time,
      durationMinutes: s.duration_minutes,
    }),
  );

  const filteredSessions = activeTab === "upcoming" ? upcomingSessions : pastSessions;

  const stats = [
    {
      label: "Total Live Sessions",
      value: liveSessions.length.toString(),
      icon: ICONS.GLOBE,
    },
    {
      label: "Upcoming Live Sessions",
      value: upcomingSessions.length.toString(),
      icon: ICONS.CLOCK,
    },
    {
      label: "Pro Users Eligible",
      value: proUsers.length.toString(),
      icon: ICONS.CALENDAR,
    },
  ];

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div>
            <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>
              Live Session Management
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
              Schedule live Zoom sessions and assign them directly to Pro users.
            </p>
          </div>
          <Button
            onClick={() => handleOpenModal()}
            className="w-full justify-center sm:w-auto"
          >
            <Plus size={18} />
            Create Live Session
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4">
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

        {/* Live Sessions Catalog Header & Search */}
        <div className="flex items-center justify-between flex-wrap gap-4 mt-12 mb-6">
          <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>Live Sessions Catalog</h2>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search live sessions by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 border text-gray-600 border-gray-200 rounded-xl text-sm bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent w-full sm:w-72 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              activeTab === "upcoming"
                ? "bg-brand-primary text-white"
                : "bg-white text-gray-500 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            Upcoming ({upcomingSessions.length})
          </button>
          <button
            onClick={() => setActiveTab("past")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              activeTab === "past"
                ? "bg-brand-primary text-white"
                : "bg-white text-gray-500 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            Past ({pastSessions.length})
          </button>
        </div>

        {/* List View */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className={`${TYPOGRAPHY_CLASSES.TABLE_HEADER} px-4 py-3`}>
                    Live Session Details
                  </th>
                  <th className={`${TYPOGRAPHY_CLASSES.TABLE_HEADER} px-4 py-3`}>
                    Date &amp; Time Slot
                  </th>
                  <th className={`${TYPOGRAPHY_CLASSES.TABLE_HEADER} px-4 py-3`}>
                    Zoom Link &amp; Members
                  </th>
                  <th className={`${TYPOGRAPHY_CLASSES.TABLE_HEADER} px-4 py-3`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto mb-2" />
                      <p className="text-sm text-gray-500 font-medium">
                        Loading live sessions...
                      </p>
                    </td>
                  </tr>
                ) : filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center">
                      <p className="text-sm text-gray-500 font-medium">
                        No live sessions found.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((sessionItem) => {
                    const isPast = activeTab === "past";
                    const memberCount =
                      sessionItem.assigned_user_ids?.length > 0
                        ? sessionItem.assigned_user_ids.length
                        : sessionItem.attendees_count || 0;
                    const slotLabel = formatLiveSessionSlot({
                      eventDate: sessionItem.event_date,
                      date: sessionItem.date,
                      startTime: sessionItem.start_time,
                      endTime: sessionItem.end_time,
                    });

                    return (
                      <tr
                        key={sessionItem.id}
                        className={`transition-colors group ${
                          isPast
                            ? "bg-gray-50/60 opacity-80"
                            : "hover:bg-gray-50/50"
                        }`}
                      >
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border ${
                                isPast
                                  ? "bg-gray-100 border-gray-100 text-gray-400"
                                  : "bg-blue-50 border-blue-100 text-brand-primary"
                              }`}
                            >
                              <Video size={20} />
                            </div>
                            <div>
                              <h3
                                className={`text-sm font-semibold leading-tight mb-1 ${
                                  isPast ? "text-gray-400" : "text-gray-900"
                                }`}
                              >
                                {sessionItem.title}
                              </h3>
                              {sessionItem.subtitle && (
                                <p
                                  className={`${TYPOGRAPHY_CLASSES.CAPTION} ${
                                    isPast ? "text-gray-300" : ""
                                  }`}
                                >
                                  {sessionItem.subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex flex-col gap-1.5">
                            <div
                              className={`flex items-center gap-2 text-sm font-medium ${
                                isPast ? "text-gray-400" : "text-gray-700"
                              }`}
                            >
                              <Calendar
                                size={14}
                                className={isPast ? "text-gray-300" : "text-brand-primary"}
                              />
                              <span>{slotLabel}</span>
                            </div>
                            <span
                              className={`inline-flex w-fit items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                                isPast
                                  ? "bg-gray-100 text-gray-400 border-gray-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-100"
                              }`}
                            >
                              {isPast ? "Session Ended" : "Scheduled"}
                            </span>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex flex-col gap-1.5">
                            {sessionItem.link_text ? (
                              <a
                                href={sessionItem.link_text}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline max-w-[260px] truncate"
                              >
                                <ExternalLink size={12} className="shrink-0" />
                                <span className="truncate">{sessionItem.link_text}</span>
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">No meeting link set</span>
                            )}
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                              <Users size={12} className="text-gray-400" />
                              <span>
                                {memberCount} Pro member{memberCount !== 1 ? "s" : ""} selected
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              onClick={() => handleOpenModal(sessionItem)}
                              className="h-8 w-8 bg-white hover:bg-blue-100 justify-center p-0"
                              title="Edit"
                            >
                              <Edit size={18} className={isPast ? "text-gray-400" : "text-primary"} />
                            </Button>
                            <Button
                              onClick={() => handleDeleteClick(sessionItem)}
                              className="h-8 w-8 bg-white hover:bg-red-100 justify-center p-0"
                              title="Delete"
                            >
                              <Trash2 size={18} className="text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {isEditing ? "Edit Live Session" : "Create New Live Session"}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Set the title, date &amp; time slot, Zoom meeting link, and select Pro members.
                  </p>
                </div>
              </div>

              <div className="px-4 sm:px-8 py-5 sm:py-6 max-h-[72vh] overflow-y-auto light-scrollbar space-y-5">
                {formError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                    Live Session Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Live Q&A and Architecture Deep Dive"
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all text-gray-700"
                  />
                </div>

                {/* Date and Time Slot */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="w-full bg-[#1682F1]/10 border border-[#1682F1]/20 rounded-xl px-4 py-3 text-sm text-[#174778] font-semibold outline-none focus:border-[#1682F1] focus:ring-2 focus:ring-[#1682F1]/20 transition-all cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-[#1682F1]/10 border border-[#1682F1]/20 rounded-xl px-4 py-3 text-sm text-[#174778] font-semibold outline-none focus:border-[#1682F1] focus:ring-2 focus:ring-[#1682F1]/20 transition-all cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-[#1682F1]/10 border border-[#1682F1]/20 rounded-xl px-4 py-3 text-sm text-[#174778] font-semibold outline-none focus:border-[#1682F1] focus:ring-2 focus:ring-[#1682F1]/20 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                {/* Zoom Meeting Link */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                    Zoom Meeting Link
                  </label>
                  <input
                    type="url"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://zoom.us/j/1234567890?pwd=..."
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all text-gray-700"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Selected Pro users will use this link on the scheduled date and time slot to join.
                  </p>
                </div>

                {/* Pro Members Checklist */}
                <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        Pro Members ({selectedUserIds.length} / {proUsers.length} selected)
                      </label>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Only selected Pro users will see this live session.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleSelectAllPro}
                      disabled={proUsers.length === 0}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-50 ${
                        allProSelected
                          ? "bg-brand-primary text-white border-brand-primary"
                          : "bg-white text-gray-700 border-gray-200 hover:border-brand-primary hover:text-brand-primary"
                      }`}
                    >
                      {allProSelected ? (
                        <CheckSquare size={14} />
                      ) : (
                        <Square size={14} />
                      )}
                      {allProSelected ? "Deselect All Pro Users" : "Select All Pro Users"}
                    </button>
                  </div>

                  {proUsers.length > 0 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Filter Pro users by name or email..."
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  )}

                  {proUsers.length === 0 ? (
                    <div className="py-6 text-center text-xs text-gray-500 bg-white rounded-xl border border-dashed border-gray-200">
                      No Pro users found yet. Upgrade a learner to Pro in Manage Users to assign live sessions.
                    </div>
                  ) : filteredProUsers.length === 0 ? (
                    <div className="py-5 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-100">
                      No Pro users match &ldquo;{memberSearch}&rdquo;.
                    </div>
                  ) : (
                    <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                      {filteredProUsers.map((user) => {
                        const isChecked = selectedUserIds.includes(user.id);
                        return (
                          <label
                            key={user.id}
                            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                              isChecked ? "bg-brand-primary/5" : "hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleUser(user.id)}
                                className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-900 truncate">
                                  {user.name}
                                </p>
                                {user.email && (
                                  <p className="text-[11px] text-gray-500 truncate">
                                    {user.email}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                              Pro
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Optional Host & Description */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Host / Instructor (Optional)
                    </label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="e.g. Hosted by Dr. Vance"
                      className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all text-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Describe what will be covered in this live session..."
                      className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all resize-none text-gray-700"
                    />
                  </div>
                </div>
              </div>

              <div className="px-4 sm:px-8 py-5 sm:py-6 border-t border-gray-100 bg-gray-50/50 flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLiveSession}
                  disabled={isSaving}
                  className="flex-1 bg-brand-primary text-white py-3 rounded-xl text-sm font-semibold hover:bg-brand-hover transition-all shadow-md disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />}
                  {isSaving
                    ? "Saving..."
                    : isEditing
                      ? "Update Live Session"
                      : "Create Live Session"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- DELETE CONFIRMATION MODAL --- */}
        {showDeleteConfirm && deletingSession && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="px-6 py-5">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                  Delete Live Session
                </h3>
                <p className="text-sm text-gray-500 text-center">
                  Are you sure you want to permanently delete{" "}
                  <strong className="text-gray-900">
                    {deletingSession.title}
                  </strong>
                  ? This action cannot be undone.
                </p>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingSession(null);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-8 right-8 bg-copy-dark text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-100 animate-in slide-in-from-bottom-5 duration-300">
            <CheckCircle className="text-emerald-400" size={20} />
            <span className="text-sm font-semibold tracking-wide">
              {toastMessage}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
