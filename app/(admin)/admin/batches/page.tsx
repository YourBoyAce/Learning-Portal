"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import {
  BookOpen,
  Users,
  User,
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
  id: number;
  name: string;
  description: string;
  created_at?: string;
  category?: string;
}

export default function AdminBatches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  type NewType = Profile;

  const [users, setUsers] = useState<NewType[]>([]);
  const [events, setEvents] = useState<Batch[]>([]);
  const [created_at, setCreated_At] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Create/Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
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

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        console.error("Auth error:", sessionError);
        return;
      }

      const response = await fetch("/api/admin/batches", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      const result = await response.json().catch(() => null);

      if (response.ok && Array.isArray(result?.batches)) {
        setBatches(result.batches);
      }
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
    const { data } = await supabase.from("profiles").select("id, full_name");

    if (data) setUsers(data);
  };

  const fetchEvents = async () => {
    const { data } = await supabase
      .from("batches")
      .select("*")
      .order("created_at", { ascending: true });

    if (data) setEvents(data);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
    fetchEvents();

    const channel = supabase
      .channel("batches")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "batches",
        },
        () => {
          fetchEvents();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateNew = async () => {
    setBatchName("");
    setBatchDescription("");
    setCreated_At("");

    fetchEvents();
    setIsEditing(false);
    setEditingBatchId(null);
    setModalMessage(null);

    if (!selectedUser || !batchName || !created_at) {
      alert("Please fill all required fields");
      return;
    }

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please log in again to continue.");
      }

      const response = await fetch("/api/admin/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          name: batchName,
          description: batchDescription,
          created: created_at,
        }),
      });

      if (!response.ok) return new Error("not implemented");

      setShowModal(false);
    } catch (err) {
      if (err instanceof Error) alert(err.message);
      return;
    }
  };

  const handleEdit = (batch: Batch) => {
    setIsEditing(true);
    setEditingBatchId(batch.id);
    setBatchName(batch.name);
    setBatchDescription(batch.description || "");
    setModalMessage(null);
    setShowModal(true);
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
        // Update existing batch
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
          }),
        });

        // If PUT isn't implemented, fall back to direct Supabase update
        if (response.status === 405) {
          const supabaseAdmin = supabase;
          const { error: updateError } = await supabaseAdmin
            .from("batches")
            .update({ name, description })
            .eq("id", editingBatchId);

          if (updateError) throw updateError;
        } else {
          const result = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(
              result?.error || `Request failed (${response.status}).`,
            );
          }
        }
      } else {
        // Create new batch
        const response = await fetch("/api/admin/batches", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({ name, description }),
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

      const { error } = await supabase
        .from("mainbatches")
        .delete()
        .eq("id", deletingBatch.id);

      if (error) throw error;

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

        {/* Batches Table */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-base font-bold text-gray-900">All Batches</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search batches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174778] focus:border-transparent w-60"
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
                  onClick={handleCreateNew}
                  className="bg-[#174778] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#113a63] transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Batch
                </button>
              )}
            </div>
          )}

          {/* Table */}
          {!loading && filteredBatches.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Batch
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Assigned Scholar
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((batch) => (
                    <tr
                      key={batch.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-[#174778]/10 rounded-lg flex items-center justify-center shrink-0">
                            <BookOpen className="w-4 h-4 text-[#174778]" />
                          </div>
                          <span className="font-semibold text-gray-900 text-sm">
                            {batch.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500 line-clamp-1 max-w-xs block">
                          {batch.description || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {batch.created_at
                            ? new Date(batch.created_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )
                            : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            <div className="space-y-5 p-4 ">
              {/* User Select */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User size={14} /> Assign Scholar
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all appearance-none cursor-pointer text-black"
                >
                  <option value="">-- Select User --</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.id}
                    </option>
                  ))}
                </select>
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
              <button
                onClick={handleCreateNew}
                className="w-full bg-[#174778] hover:bg-[#113a63] text-white py-3.5 rounded-lg text-sm font-semibold transition-all shadow-sm mt-2"
              >
                Create Batch
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
    </div>
  );
}
