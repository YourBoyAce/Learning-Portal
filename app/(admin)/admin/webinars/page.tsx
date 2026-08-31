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

interface Product {
  id: number | string;
  title: string;
}

export default function AdminWebinarsPage() {
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
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
  const [selectedProductId, setSelectedProductId] = useState<string | number>(
    "",
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [dbCourses, setDbCourses] = useState<
    {
      id: string | number;
      title: string;
      product_id?: number | string | null;
    }[]
  >([]);
  const [batchSchedule, setBatchSchedule] = useState("all");
  const [invitePremiumOnly, setInvitePremiumOnly] = useState(true);

  useEffect(() => {
    /* eslint-disable */
    fetchWebinars();
    fetchProducts();
    fetchCourses();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, title")
        .order("title", { ascending: true });
      if (data && !error) setProducts(data);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("maincourses")
        .select("id, title, product_id")
        .order("title", { ascending: true });
      if (data && !error) setDbCourses(data);
    } catch (err) {
      console.error("Failed to fetch courses:", err);
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
      setIcon(webinar.icon || "📋");
      setStatus(webinar.status || "streaming");
      setLinkText(webinar.link_text || "");
      setAttendeesCount(webinar.attendees_count || 0);
      setSelectedProductId("");
      setBatchSchedule("all");
      setInvitePremiumOnly(true);
    } else {
      setIsEditing(false);
      setEditingId(null);
      setTitle("");
      setSubtitle("");
      setDescription("");
      setEventDate("");
      setIcon("📋");
      setStatus("streaming");
      setLinkText("");
      setAttendeesCount(0);
      setSelectedProductId("");
      setBatchSchedule("all");
      setInvitePremiumOnly(true);
    }
    setShowModal(true);
  };

  const getPremiumUserIdsForWebinarInvite = async (): Promise<string[]> => {
    try {
      const premiumUserIds = new Set<string>();

      // 1. Query phase2 enrollments for active premium learners
      const { data: p2Data } = await supabase
        .schema("phase2")
        .from("enrollments")
        .select("user_id, bundles!inner(bundle_name)")
        .eq("status", "active");

      if (p2Data && p2Data.length > 0) {
        const p2UserIds: string[] = [];
        p2Data.forEach((row: any) => {
          const bundleName = row?.bundles?.bundle_name;
          if (typeof bundleName === "string" && bundleName.toLowerCase().includes("premium")) {
            if (row.user_id) p2UserIds.push(row.user_id);
          }
        });

        if (p2UserIds.length > 0) {
          const { data: usersData } = await supabase
            .schema("phase2")
            .from("users")
            .select("auth_user_id")
            .in("id", p2UserIds);

          (usersData || []).forEach((u: any) => {
            if (u?.auth_user_id) premiumUserIds.add(u.auth_user_id);
          });
        }
      }

      // 2. Query public.profiles as fallback/complement for active user accounts
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("role", "user");

      if (profiles && profiles.length > 0) {
        profiles.forEach((p) => {
          if (p.id) premiumUserIds.add(p.id);
        });
      }

      return Array.from(premiumUserIds);
    } catch (error) {
      console.error(
        "Failed to resolve premium user IDs for webinar invite:",
        error,
      );
      return [];
    }
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
      };

      if (isEditing && editingId) {
        // ── EDIT: update the webinar row ──────────────────────────────────
        const { error } = await supabase
          .from("webinars")
          .update(webinarData)
          .eq("id", editingId);
        if (error) throw error;

        // Update existing calendar_events invitations for this webinar.
        // Only title/description/date/time change — user_id, webinar_id and
        // tag (which holds RSVP status) are intentionally NOT touched.
        const updatedInviteFields = {
          title: `Webinar invite: ${title}`,
          description: `${description || "Join our live webinar."}\n---\nWebinar: ${title}\nDate: ${eventDate}\nHosted by: ${subtitle || "Admin"}\nType: Webinar`,
          event_date: eventDate ? eventDate.split("T")[0] : "",
          event_time:
            eventDate && eventDate.includes("T")
              ? `${eventDate.split("T")[1]}:00`
              : "09:00:00",
          // Stamp webinar_id on rows that previously had NULL (created before this fix)
          webinar_id: editingId,
        };

        // Fetch the webinar's OLD title so we can match legacy rows by title.
        // This handles invitations created before webinar_id was populated.
        const existingWebinar = webinars.find((w) => w.id === editingId);
        const oldInviteTitle = `Webinar invite: ${existingWebinar?.title ?? title}`;

        // Try to update by webinar_id first (new rows), then fall back to old title match.
        const { count: matchCount } = await supabase
          .from("calendar_events")
          .select("id", { count: "exact", head: true })
          .eq("webinar_id", editingId);

        let inviteUpdateError: unknown = null;

        if ((matchCount ?? 0) > 0) {
          // New rows — matched by webinar_id
          const { error } = await supabase
            .from("calendar_events")
            .update(updatedInviteFields)
            .eq("webinar_id", editingId);
          inviteUpdateError = error;
        } else {
          // Legacy rows — matched by old invitation title (webinar_id was NULL)
          const { error } = await supabase
            .from("calendar_events")
            .update(updatedInviteFields)
            .eq("title", oldInviteTitle)
            .eq("event_type", "webinar");
          inviteUpdateError = error;
        }

        if (inviteUpdateError) {
          // Webinar was updated but invitations could not be synced — surface this clearly.
          console.error("Invitation update failed:", inviteUpdateError);
          showToast(
            "Webinar updated, but invitation sync failed. Please check the console.",
          );
        } else {
          showToast("Webinar updated successfully.");
        }
      } else {
        // ── CREATE: insert the webinar, then create invitations ───────────
        const { data, error } = await supabase
          .from("webinars")
          .insert([webinarData])
          .select("id")
          .single();
        if (error) throw error;
        const createdWebinarId: number | null = data?.id ?? null;

        if (invitePremiumOnly) {
          const premiumUserIds = await getPremiumUserIdsForWebinarInvite();

          if (premiumUserIds.length > 0) {
            const inviteRows = premiumUserIds.map((userId) => ({
              user_id: userId,
              title: `Webinar invite: ${title}`,
              description: `${description || "Join our live webinar."}\n---\nWebinar: ${title}\nDate: ${eventDate}\nHosted by: ${subtitle || "Admin"}\nType: Webinar`,
              event_date: eventDate ? eventDate.split("T")[0] : "",
              event_time:
                eventDate && eventDate.includes("T")
                  ? `${eventDate.split("T")[1]}:00`
                  : "09:00:00",
              event_type: "webinar",
              tag: "status:pending|webinar|dur:60",
              webinar_id: createdWebinarId,
            }));

            const { error: inviteError } = await supabase
              .from("calendar_events")
              .insert(inviteRows);
            if (inviteError) throw inviteError;
            showToast(
              `Webinar created and invited ${premiumUserIds.length} premium users.`,
            );
          } else {
            showToast(
              "Webinar created. No premium users were found for invites.",
            );
          }
        } else {
          showToast("Webinar created successfully.");
        }
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
      const { error } = await supabase
        .from("webinars")
        .delete()
        .eq("id", deletingWebinar.id);
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

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const searchedWebinars = webinars.filter(
    (w) =>
      w.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.subtitle?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const upcomingWebinars = searchedWebinars.filter((w) => {
    if (!w.event_date) return true;
    const eventDate = new Date(w.event_date);
    if (!isNaN(eventDate.getTime())) {
      return eventDate > twoHoursAgo;
    }
    return true;
  });

  const pastWebinars = searchedWebinars.filter((w) => {
    if (!w.event_date) return false;
    const eventDate = new Date(w.event_date);
    if (!isNaN(eventDate.getTime())) {
      return eventDate <= twoHoursAgo;
    }
    return false;
  });

  const filteredWebinars = activeTab === "upcoming" ? upcomingWebinars : pastWebinars;

  const stats = [
    {
      label: "Total Webinars",
      value: webinars.length.toString(),
      icon: ICONS.GLOBE,
    },
    {
      label: "Upcoming Webinars",
      value: upcomingWebinars.length.toString(),
      icon: ICONS.CLOCK,
    },
    {
      label: "Past Webinars",
      value: pastWebinars.length.toString(),
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
              Webinar Management
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

        {/* Webinars Catalog Header & Search */}
        <div className="flex items-center justify-between flex-wrap gap-4 mt-12 mb-6">
          <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>Webinars Catalog</h2>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search webinars by title..."
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
            Upcoming ({upcomingWebinars.length})
          </button>
          <button
            onClick={() => setActiveTab("past")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              activeTab === "past"
                ? "bg-brand-primary text-white"
                : "bg-white text-gray-500 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            Past ({pastWebinars.length})
          </button>
        </div>

        {/* List View */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th
                    className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}
                  >
                    Webinar Details
                  </th>
                  <th
                    className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}
                  >
                    Schedule
                  </th>
                  <th
                    className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}
                  >
                    Status
                  </th>
                  <th
                    className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}
                  >
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
                  filteredWebinars.map((webinar) => {
                    const isPast = activeTab === "past";
                    let dateDisplay = webinar.event_date;
                    let timeDisplay = "";
                    if (isPast && webinar.event_date) {
                      const d = new Date(webinar.event_date);
                      if (!isNaN(d.getTime())) {
                        dateDisplay = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                        timeDisplay = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                      } else if (webinar.event_date.includes("T")) {
                        const parts = webinar.event_date.split('T');
                        dateDisplay = parts[0];
                        timeDisplay = parts[1] || "";
                      }
                    }

                    return (
                      <tr
                        key={webinar.id}
                        className={`transition-colors group ${
                          isPast
                            ? "bg-gray-50/60 opacity-80"
                            : "hover:bg-gray-50/50"
                        }`}
                      >
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm border overflow-hidden ${
                              isPast
                                ? "bg-gray-100 border-gray-100 grayscale"
                                : "bg-gray-100 border-gray-100"
                            }`}>
                              {webinar.icon && webinar.icon.length <= 2 ? (
                                <span className={isPast ? "opacity-50" : ""}>{webinar.icon}</span>
                              ) : (
                                <Image
                                  src={ICONS.GLOBE}
                                  alt="icon"
                                  width={24}
                                  height={24}
                                  className={isPast ? "opacity-40" : ""}
                                />
                              )}
                            </div>
                            <div>
                              <h3 className={`text-sm font-medium leading-tight mb-1 ${
                                isPast ? "text-gray-400" : "text-gray-500"
                              }`}>
                                {webinar.title}
                              </h3>
                              <p className={`${TYPOGRAPHY_CLASSES.CAPTION} ${
                                isPast ? "text-gray-300" : ""
                              }`}>
                                {webinar.subtitle}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex flex-col gap-1">
                            <div className={`flex ${isPast && timeDisplay ? 'flex-col items-start gap-0.5' : 'items-center gap-2'} text-sm font-medium ${
                              isPast ? "text-gray-400" : "text-gray-500"
                            }`}>
                              <div className="flex items-center gap-2">
                                <Calendar
                                  size={14}
                                  className={isPast ? "text-gray-300" : "text-brand-primary"}
                                />
                                {dateDisplay}
                              </div>
                              {isPast && timeDisplay && (
                                <div className="text-[11px] text-gray-400 pl-5.5">
                                  {timeDisplay}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                              <Users size={12} />
                              {webinar.attendees_count} Potential Attendees
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          {isPast ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border bg-gray-100 text-gray-400 border-gray-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                              Session Ended
                            </span>
                          ) : (
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
                          )}
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              onClick={() => handleOpenModal(webinar)}
                              className="h-8 w-8 bg-white hover:bg-blue-100 justify-center p-0"
                              title="Edit"
                            >
                              <Edit size={18} className={isPast ? "text-gray-400" : "text-primary"} />
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

                  {/* Product */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Product
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                      }}
                      className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all appearance-none text-gray-700"
                    >
                      <option value="">— Select Product —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target Batch / Schedule */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Target Batch / Schedule
                    </label>
                    <select
                      value={batchSchedule}
                      onChange={(e) => setBatchSchedule(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all appearance-none text-gray-700"
                    >
                      <option value="all">All Batches</option>
                      <option value="weekday">Weekday Batch</option>
                      <option value="weekend">Weekend Batch</option>
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

                  <div className="md:col-span-2">
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3">
                      <div>
                        <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                          Invite only premium users
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Creates premium webinar invites for every active
                          premium-tier learner.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={invitePremiumOnly}
                        onChange={(e) => setInvitePremiumOnly(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                      />
                    </label>
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
                  <strong className="text-gray-900">
                    {deletingWebinar.title}
                  </strong>
                  ? This action cannot be undone.
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
