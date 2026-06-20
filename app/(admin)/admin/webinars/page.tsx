"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY, TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import Image from "next/image";
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Edit,
  Loader2,
  Calendar,
  Video,
  Link as LinkIcon,
  CheckCircle,
  XCircle,
  Users,
} from "lucide-react";

interface Webinar {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  event_date: string;
  icon: string;
  status: string;
  link_text: string;
  attendees_count: number;
  created_at: string;
  batch_id?: number | string | null;
}

interface Batch {
  id: number | string;
  name: string;
}

export default function AdminWebinarsPage() {
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingWebinar, setDeletingWebinar] = useState<Webinar | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [icon, setIcon] = useState("ðŸ“‹");
  const [status, setStatus] = useState("streaming");
  const [linkText, setLinkText] = useState("");
  const [attendeesCount, setAttendeesCount] = useState(0);
  const [batchId, setBatchId] = useState<string | number>("");
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    /* eslint-disable */
    fetchWebinars();
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const { data, error } = await supabase
        .from("batches")
        .select("id, name")
        .order("name", { ascending: true });
      if (data && !error) setBatches(data);
    } catch (err) {
      console.error("Failed to fetch batches:", err);
    }
  };

  const fetchWebinars = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("webinars")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWebinars(data || []);
    } catch (error) {
      console.error("Failed to fetch webinars:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (webinar?: Webinar) => {
    if (webinar) {
      setIsEditing(true);
      setEditingId(webinar.id);
      setTitle(webinar.title);
      setSubtitle(webinar.subtitle || "");
      setDescription(webinar.description || "");
      setEventDate(webinar.event_date || "");
      setIcon(webinar.icon || "ðŸ“‹");
      setStatus(webinar.status || "streaming");
      setLinkText(webinar.link_text || "");
      setAttendeesCount(webinar.attendees_count || 0);
      setBatchId(webinar.batch_id || "");
    } else {
      setIsEditing(false);
      setEditingId(null);
      setTitle("");
      setSubtitle("");
      setDescription("");
      setEventDate("");
      setIcon("ðŸ“‹");
      setStatus("streaming");
      setLinkText("");
      setAttendeesCount(0);
      setBatchId("");
    }
    setShowModal(true);
  };

  const handleSaveWebinar = async () => {
    if (!title) {
      alert("Please provide a title.");
      return;
    }

    try {
      setIsSaving(true);
      const webinarData = {
        title,
        subtitle,
        description,
        event_date: eventDate,
        icon,
        status,
        link_text: linkText,
        attendees_count: attendeesCount,
        batch_id: batchId || null,
      };

      if (isEditing && editingId) {
        const { error } = await supabase
          .from("webinars")
          .update(webinarData)
          .eq("id", editingId);
        if (error) throw error;
        showToast("Webinar updated successfully.");
      } else {
        const { error } = await supabase.from("webinars").insert([webinarData]);
        if (error) throw error;
        showToast("Webinar created successfully.");
      }

      setShowModal(false);
      fetchWebinars();
    } catch (error) {
      console.error("Error saving webinar:", error);
      showToast("Failed to save webinar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (webinar: Webinar) => {
    setDeletingWebinar(webinar);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingWebinar) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("webinars").delete().eq("id", deletingWebinar.id);
      if (error) throw error;
      showToast("Webinar deleted successfully.");
      fetchWebinars();
    } catch (error) {
      console.error("Error deleting webinar:", error);
      showToast("Failed to delete webinar.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeletingWebinar(null);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredWebinars = webinars.filter(
    (w) =>
      w.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.subtitle?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div>
            <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>
              Webinar Management
            </h1>
            <p className={TYPOGRAPHY.BODY.fontSize + " " + TYPOGRAPHY.BODY.lineHeight + " " + TYPOGRAPHY.BODY.fontWeight + " text-gray-600"}>
              Schedule and curate upcoming webinars for scholars.
            </p>
          </div>
          <Button
            onClick={() => handleOpenModal()}
            className="w-full justify-center sm:w-auto"
          >
            <Plus size={18} />
            Create Webinar
          </Button>
        </div>

        {/* Search & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="md:col-span-3 relative">
            <Search
              className="absolute left-4 top-5.5 -translate-y-1/2 text-gray-600"
              size={18}
            />
            <input
              type="text"
              placeholder="Search webinars by title or instructor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-12 pr-4 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all shadow-sm text-gray-500"
            />
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0">
              <Video className="text-brand-primary" size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900 leading-none">
                {webinars.length}
              </span>
              <span className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                Total Scheduled
              </span>
            </div>
          </div>
        </div>

        {/* List View */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                    Webinar Details
                  </th>
                  <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                    Schedule
                  </th>
                  <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                    Status
                  </th>
                  <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
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
                        Loading webinars...
                      </p>
                    </td>
                  </tr>
                ) : filteredWebinars.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center">
                      <p className="text-sm text-gray-500 font-medium">
                        No webinars found.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredWebinars.map((webinar) => (
                    <tr
                      key={webinar.id}
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl shadow-sm border border-gray-100 overflow-hidden">
                            {webinar.icon && webinar.icon.length <= 2 ? (
                              <span>{webinar.icon}</span>
                            ) : (
                              <Image src={ICONS.GLOBE} alt="icon" width={24} height={24} />
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-500 leading-tight mb-1">
                              {webinar.title}
                            </h3>
                            <p className={TYPOGRAPHY_CLASSES.CAPTION}>
                              {webinar.subtitle}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                            <Calendar size={14} className="text-brand-primary" />
                            {webinar.event_date}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400">
                            <Users size={12} />
                            {webinar.attendees_count} Potential Attendees
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${webinar.status === "streaming"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-blue-50 text-blue-700 border-blue-100"
                            }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${webinar.status === "streaming" ? "bg-emerald-500 animate-pulse" : "bg-blue-500"}`}
                          />
                          {webinar.status}
                        </span>
                      </td>
                      <td className="py-5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            onClick={() => handleOpenModal(webinar)}
                            className="h-8 w-8 bg-white hover:bg-blue-100 justify-center p-0"
                            title="Edit"
                          >
                            <Edit size={18} className="text-primary" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteClick(webinar)}
                            className="h-8 w-8 bg-white hover:bg-red-100 justify-center p-0"
                            title="Delete"
                          >
                            <Trash2 size={18} className="text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
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
                    {isEditing ? "Edit Webinar" : "Create New Webinar"}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Fill in the details to schedule the webinar.
                  </p>
                </div>
              </div>

              <div className="px-4 sm:px-8 py-5 sm:py-6 max-h-[70vh] overflow-y-auto light-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Title */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Webinar Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Masterclass on Neural Networks"
                      className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all text-gray-700"
                    />
                  </div>

                  {/* Subtitle / Instructor */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Instructor / Location
                    </label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="e.g. Prof. Ariadne Â· Seminar Room R12"
                      className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all text-gray-700"
                    />
                  </div>
                  {/* Event Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Event Date & Time
                    </label>

                    <input
                      type="datetime-local"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
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
                  </div>
                  {/* Status */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all appearance-none text-gray-700"
                    >
                      <option value="streaming">Streaming</option>
                      <option value="link">Link</option>
                    </select>
                  </div>

                  {/* Assigned Batch */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Assigned Batch
                    </label>
                    <select
                      value={batchId}
                      onChange={(e) => setBatchId(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all appearance-none text-gray-700"
                    >
                      <option value="">— No Batch —</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Link Text */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Action Link Text
                    </label>
                    <input
                      type="text"
                      value={linkText}
                      onChange={(e) => setLinkText(e.target.value)}
                      placeholder="e.g. Register Now, Link Active Soon"
                      className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all text-gray-700"
                    />
                  </div>

                  {/* Attendees Count */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Initial Attendee Count
                    </label>
                    <input
                      type="number"
                      value={attendeesCount}
                      onChange={(e) =>
                        setAttendeesCount(parseInt(e.target.value) || 0)
                      }
                      className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all text-gray-700"
                    />
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Webinar Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="Describe what will be covered in this webinar..."
                      className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all resize-none text-gray-700"
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
                  onClick={handleSaveWebinar}
                  disabled={isSaving}
                  className="flex-1 bg-brand-primary text-white py-3 rounded-xl text-sm font-semibold hover:bg-brand-hover transition-all shadow-md disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />}
                  {isSaving
                    ? "Saving..."
                    : isEditing
                      ? "Update Webinar"
                      : "Create Webinar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- DELETE CONFIRMATION MODAL --- */}
        {showDeleteConfirm && deletingWebinar && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="px-6 py-5">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                  Delete Webinar
                </h3>
                <p className="text-sm text-gray-500 text-center">
                  Are you sure you want to permanently delete{" "}
                  <strong className="text-gray-900">{deletingWebinar.title}</strong>?
                  This action cannot be undone.
                </p>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingWebinar(null);
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
