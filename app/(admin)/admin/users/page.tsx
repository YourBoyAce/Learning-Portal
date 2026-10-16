"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY, TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import Image from "next/image";
import {
  createUser,
  updateUserRole,
  updateUserPlan,
  deleteUser,
  getAdminUsers,
} from "@/app/actions/create-user";
import {
  MoreVertical,
  Download,
  Filter,
  Search,
  CheckCircle2,
  Users,
  Timer,
  LogIn,
  LogOut,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { PROFILE_UPDATED_EVENT } from "@/app/lib/profile-events";

interface LoginSession {
  loginAt: string;
  logoutAt: string;
  durationSeconds: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  plan?: string;
  todaySessions: LoginSession[];
  todayTimeSpentSeconds: number;
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  created_at?: string | null;
};

const ROLES = [
  { value: "user", label: "User" },
  { value: "instructor", label: "Instructor" },
  { value: "admin", label: "Admin" },
];

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminUsers() {
  const pathname = usePathname();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("user");
  const [plan, setPlan] = useState("starter");
  const [courses, setCourses] = useState<Array<{ id: number | string; title: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState({ type: "", message: "" });

  const [users, setUsers] = useState<User[]>([]);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [filterQuery, setFilterQuery] = useState("");
  const [filterType, setFilterType] = useState<"email" | "role">("email");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"users" | "mentors" | "admins">("users");
  const ITEMS_PER_PAGE = 6;

  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await getAdminUsers(token);
      if (res.success && res.users) {
        setUsers(res.users);
        setActiveUsersCount(res.users.filter((u) => u.todaySessions.length > 0).length);
      } else {
        console.warn("getAdminUsers error:", res.error);
      }
    } catch (err) {
      console.error("fetchUsers error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();

    const onProfileUpdated = () => {
      void fetchUsers();
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
  }, [pathname]);

  useEffect(() => {
    async function loadCourses() {
      const { data } = await supabase
        .from("maincourses")
        .select("id, title")
        .order("title", { ascending: true });
      if (data) {
        setCourses(data);
      }
    }
    loadCourses();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormFeedback({ type: "", message: "" });

    const formData = new FormData();
    formData.append("username", username);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("role", role);
    formData.append("plan", plan);
    if (selectedCourseId) {
      formData.append("courseId", selectedCourseId);
      formData.append("productId", selectedCourseId);
    }
    if (role === "admin") {
      formData.append("phone", phone);
    }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    if (token) {
      formData.append("accessToken", token);
    }

    const result = await createUser(formData, token);

    if (result.success) {
      setFormFeedback({
        type: "success",
        message:
          result.message ||
          "User created successfully.",
      });
      setUsername("");
      setEmail("");
      setPassword("");
      setPhone("");
      setRole("user");
      setPlan("starter");
      setSelectedCourseId("");
      fetchUsers();
    } else {
      setFormFeedback({
        type: "error",
        message: result.error || "Failed to create user.",
      });
    }
    setIsSubmitting(false);
  };

  const getCategory = (r: string) => {
    const roleStr = r?.toLowerCase() || "";
    if (roleStr === "admin") return "admins";
    if (roleStr === "instructor" || roleStr === "mentor") return "mentors";
    return "users";
  };

  const usersCategory = users.filter((u) => getCategory(u.role) === "users");
  const mentorsCategory = users.filter((u) => getCategory(u.role) === "mentors");
  const adminsCategory = users.filter((u) => getCategory(u.role) === "admins");
  const activeCategoryUsers =
    activeTab === "users"
      ? usersCategory
      : activeTab === "mentors"
        ? mentorsCategory
        : adminsCategory;

  const handleDownloadCSV = () => {
    const headers = [
      "ID",
      "Name",
      "Email",
      "Role",
      "Sessions Today",
      "Time Spent Today",
    ];
    const csvContent = [
      headers.join(","),
      ...activeCategoryUsers.map(
        (u) =>
          `"${u.id}","${u.name}","${u.email}","${u.role}","${u.todaySessions.length}","${formatDuration(u.todayTimeSpentSeconds)}"`,
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${activeTab}.csv`;
    link.click();
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    await updateUserRole(userId, newRole, token);
    setOpenActionMenuId(null);
    showToast("Role updated successfully.");
    fetchUsers();
  };

  const handleChangePlan = async (userId: string, newPlan: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    const res = await updateUserPlan(userId, newPlan, token);
    setOpenActionMenuId(null);
    if (res.success) {
      showToast(res.message || "Plan updated successfully.");
      fetchUsers();
    } else {
      showToast(res.error || "Failed to update plan.");
    }
  };

  const handleDeleteClick = (user: User) => {
    setDeletingUser(user);
    setShowDeleteConfirm(true);
    setOpenActionMenuId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      await deleteUser(deletingUser.id, token);
      showToast("User removed successfully.");
      fetchUsers();
    } catch (err) {
      console.error(err);
      showToast("Failed to remove user.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeletingUser(null);
    }
  };

  const filteredUsers = activeCategoryUsers.filter((user) => {
    if (!filterQuery) return true;
    const query = filterQuery.toLowerCase();
    if (filterType === "email") return user.email.toLowerCase().includes(query);
    if (filterType === "role") return user.role.toLowerCase().includes(query);
    return true;
  });

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  return (
    <div className="min-h-screen bg-surface-subtle p-4 sm:p-6 lg:p-10 font-sans text-gray-900">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-8">
          <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>
            User Management
          </h1>
          <p className={TYPOGRAPHY.BODY.fontSize + " " + TYPOGRAPHY.BODY.lineHeight + " " + TYPOGRAPHY.BODY.fontWeight + " text-gray-600"}>
            Manage users, roles, and platform access.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] 2xl:grid-cols-[420px_1fr] gap-6 xl:gap-8 items-start">
          {/* LEFT COLUMN: ADD NEW USER FORM */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className={TYPOGRAPHY_CLASSES.SUBHEADING + " mb-4"}>Add New User</h3>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
                <div>
                  <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter display name"
                    className={`${TYPOGRAPHY_CLASSES.CAPTION} !text-gray-900 placeholder:!text-gray-400 w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary`}
                    style={{
                      fontSize: TYPOGRAPHY.CAPTION.fontSize,
                      lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                      fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                    }}
                  />
                </div>

                <div>
                  <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className={`${TYPOGRAPHY_CLASSES.CAPTION} !text-gray-900 placeholder:!text-gray-400 w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer`}
                    style={{
                      fontSize: TYPOGRAPHY.CAPTION.fontSize,
                      lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                      fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                    }}
                  />
                </div>

                <div>
                  <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter user password"
                    className={`${TYPOGRAPHY_CLASSES.CAPTION} !text-gray-900 placeholder:!text-gray-400 w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer`}
                    style={{
                      fontSize: TYPOGRAPHY.CAPTION.fontSize,
                      lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                      fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                    }}
                  />
                </div>

                <div>
                  <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                    Assign Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value);
                      if (e.target.value !== "admin") {
                        setPhone("");
                      }
                    }}
                    className={`${TYPOGRAPHY_CLASSES.CAPTION} !text-gray-900 placeholder:!text-gray-400 w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer`}
                    style={{
                      fontSize: TYPOGRAPHY.CAPTION.fontSize,
                      lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                      fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                {role === "user" && (
                  <>
                    <div>
                      <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                        Select Course
                      </label>
                      <select
                        value={selectedCourseId}
                        onChange={(e) => setSelectedCourseId(e.target.value)}
                        className={`${TYPOGRAPHY_CLASSES.CAPTION} !text-gray-900 placeholder:!text-gray-400 w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer`}
                        style={{
                          fontSize: TYPOGRAPHY.CAPTION.fontSize,
                          lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                          fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                        }}
                      >
                        <option value="">Choose Course (Optional)</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                        User Plan
                      </label>
                      <select
                        value={plan}
                        onChange={(e) => setPlan(e.target.value)}
                        className={`${TYPOGRAPHY_CLASSES.CAPTION} !text-gray-900 placeholder:!text-gray-400 w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary cursor-pointer`}
                        style={{
                          fontSize: TYPOGRAPHY.CAPTION.fontSize,
                          lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                          fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                        }}
                      >
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>
                  </>
                )}

                {role === "admin" && (
                  <div className="sm:col-span-2 rounded-xl border border-brand-primary/15 bg-brand-primary/5 p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-brand-primary">
                        Admin phone number
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Required for admin login verification via SMS. Stored as plain digits only.
                      </p>
                    </div>
                    <div>
                      <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="Enter the Number"
                        className={`${TYPOGRAPHY_CLASSES.CAPTION} !text-gray-900 placeholder:!text-gray-400 w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary`}
                        style={{
                          fontSize: TYPOGRAPHY.CAPTION.fontSize,
                          lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                          fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {formFeedback.message && (
                <div
                  className={`p-3 rounded-lg text-sm font-medium ${formFeedback.type === "error"
                    ? "bg-red-50 text-red-600"
                    : formFeedback.type === "warning"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-green-50 text-green-700"
                    }`}
                >
                  {formFeedback.message}
                </div>
              )}

              {/* Submit Button & Active Users Widget Row */}
              <div className="pt-2 flex flex-col sm:flex-row xl:flex-col items-stretch sm:items-center xl:items-stretch justify-between gap-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto xl:w-full px-6 h-11 shrink-0"
                >
                  {isSubmitting
                    ? `Creating ${role === "admin" ? "Admin" : role === "instructor" ? "Instructor" : "Scholar"}...`
                    : `Create ${role === "admin" ? "Admin" : role === "instructor" ? "Instructor" : "Scholar"}`}
                </Button>

                {/* ACTIVE USERS WIDGET */}
                <div className="bg-brand-heading/10 backdrop-blur-md border border-brand-heading/15 rounded-xl px-5 py-3 flex items-center justify-between gap-4 text-brand-heading relative overflow-hidden shrink-0">
                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500 opacity-10 rounded-full blur-xl"></div>

                  <div className="relative z-10 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <Image
                        src={ICONS.USERS}
                        alt="User Icon"
                        width={22}
                        height={22}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-heading opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-heading"></span>
                        </span>
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          Users Logged In Today
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-2xl font-bold text-brand-heading relative z-10">
                    {loading ? "-" : activeUsersCount}
                  </p>
                </div>
              </div>
            </form>
          </div>

          {/* LOWER SECTION: USER REGISTRY TABLE (FULL WIDTH) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col w-full">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className={TYPOGRAPHY_CLASSES.SUBHEADING}>User Registry</h3>

                {/* TAB TOGGLE: USERS VS MENTORS VS ADMINS */}
                <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                  <button
                    onClick={() => {
                      setActiveTab("users");
                      setCurrentPage(1);
                    }}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === "users"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                      }`}
                  >
                    <Users size={14} />
                    Users
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === "users"
                        ? "bg-brand-primary/10 text-brand-primary font-bold"
                        : "bg-gray-200/70 text-gray-600"
                        }`}
                    >
                      {usersCategory.length}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("mentors");
                      setCurrentPage(1);
                    }}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === "mentors"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                      }`}
                  >
                    <GraduationCap size={14} />
                    Mentors
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === "mentors"
                        ? "bg-purple-500/10 text-purple-600 font-bold"
                        : "bg-gray-200/70 text-gray-600"
                        }`}
                    >
                      {mentorsCategory.length}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("admins");
                      setCurrentPage(1);
                    }}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === "admins"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                      }`}
                  >
                    <ShieldCheck size={14} />
                    Admins
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === "admins"
                        ? "bg-red-500/10 text-red-600 font-bold"
                        : "bg-gray-200/70 text-gray-600"
                        }`}
                    >
                      {adminsCategory.length}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:flex-initial flex items-center">
                  <div className="absolute left-3 text-gray-400">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder={`Search by ${filterType}...`}
                    value={filterQuery}
                    onChange={(e) => {
                      setFilterQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full sm:w-[200px] pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                    title="Filter options"
                  >
                    <Filter size={18} />
                  </button>

                  {showFilterDropdown && (
                    <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-100 shadow-lg rounded-xl z-20 py-1 overflow-hidden">
                      <button
                        onClick={() => {
                          setFilterType("email");
                          setCurrentPage(1);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${filterType === "email" ? "text-brand-primary font-semibold" : "text-gray-600"}`}
                      >
                        {filterType === "email" && <CheckCircle2 size={14} />}
                        Email
                      </button>
                      <button
                        onClick={() => {
                          setFilterType("role");
                          setCurrentPage(1);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${filterType === "role" ? "text-brand-primary font-semibold" : "text-gray-600"}`}
                      >
                        {filterType === "role" && <CheckCircle2 size={14} />}
                        Role
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleDownloadCSV}
                  className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Export as CSV"
                >
                  <Download size={18} />
                </button>
              </div>
            </div>

            {/* MOBILE CARD VIEW (< md) */}
            <div className="block md:hidden p-4 space-y-4 flex-1 overflow-y-auto">
              {loading ? (
                <div className="text-center py-10 text-gray-500">
                  Loading {activeTab}...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  No {activeTab} found.
                </div>
              ) : (
                paginatedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm relative space-y-3"
                  >
                    {/* Top Row: User Avatar & Name + Top Right Action Button */}
                    <div className="flex items-start justify-between pr-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {user.name}
                          </p>
                          <p
                            style={{
                              fontSize: TYPOGRAPHY.CAPTION.fontSize,
                              lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                              fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                            }}
                            className={`${TYPOGRAPHY_CLASSES.CAPTION} text-gray-500 break-all`}
                          >
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Top Right Action Button (3 vertically aligned dots) */}
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={() =>
                          setOpenActionMenuId(
                            openActionMenuId === user.id ? null : user.id,
                          )
                        }
                        className="p-1.5 text-gray-400 hover:text-gray-800 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <MoreVertical size={18} />
                      </button>
                      {openActionMenuId === user.id && (
                        <div className="absolute right-0 top-8 w-44 bg-white border border-gray-100 shadow-xl rounded-xl z-50 py-2 overflow-hidden text-left">
                          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                            Change Role To:
                          </div>
                          {ROLES.map((r) => (
                            <button
                              key={r.value}
                              onClick={() => handleChangeRole(user.id, r.value)}
                              className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 text-gray-700 transition-colors"
                            >
                              {r.label}
                            </button>
                          ))}
                          {user.role === "user" && (
                            <>
                              <div className="border-t border-gray-100 mt-1 pt-1">
                                <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                                  Upgrade / Change Plan:
                                </div>
                                {[
                                  { value: "starter", label: "Starter" },
                                  { value: "pro", label: "Pro" },
                                  { value: "premium", label: "Premium" },
                                ].map((p) => (
                                  <button
                                    key={p.value}
                                    onClick={() => handleChangePlan(user.id, p.value)}
                                    className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center justify-between ${user.plan === p.value
                                      ? "text-brand-primary font-bold bg-brand-primary/5"
                                      : "text-gray-700"
                                      }`}
                                  >
                                    <span>{p.label} Plan</span>
                                    {user.plan === p.value && <CheckCircle2 size={12} className="text-brand-primary" />}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                          <div className="border-t border-gray-100 mt-1 pt-1">
                            <button
                              onClick={() => handleDeleteClick(user)}
                              className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 text-red-600 font-semibold transition-colors"
                            >
                              {user.role === "admin"
                                ? "Remove Admin"
                                : user.role === "instructor"
                                  ? "Remove Instructor"
                                  : "Remove Scholar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Session and Time Spent in a Row */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        {user.todaySessions.length > 0 ? (
                          <div className="space-y-1">
                            {user.todaySessions.slice(0, 1).map((session, i) => (
                              <div key={i} className="flex items-center gap-1 text-[11px] font-semibold flex-wrap">
                                <LogIn className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span className="text-emerald-700">{formatTime(session.loginAt)}</span>
                                <span className="text-gray-300">→</span>
                                <LogOut className="w-3 h-3 text-red-400 shrink-0" />
                                <span className="text-red-600">{formatTime(session.logoutAt)}</span>
                              </div>
                            ))}
                            {user.todaySessions.length > 1 && (
                              <span className="text-[10px] text-gray-400 block">
                                +{user.todaySessions.length - 1} more session{user.todaySessions.length > 2 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Not logged in today</span>
                        )}
                      </div>

                      <div className="shrink-0">
                        {user.todayTimeSpentSeconds > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-md border border-amber-100">
                            <Timer className="w-3 h-3" />
                            {formatDuration(user.todayTimeSpentSeconds)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">0s</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* DESKTOP TABLE VIEW (md+) */}
            <div className="hidden md:block overflow-x-auto flex-1 light-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 capitalize tracking-wide">
                      {activeTab === "mentors" ? "Mentor" : activeTab === "admins" ? "Admin" : "User"}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 capitalize tracking-wide">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 capitalize tracking-wide">
                      Today&apos;s Sessions
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 capitalize tracking-wide">
                      Time Spent
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 capitalize tracking-wide">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-gray-500">
                        Loading {activeTab}...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-gray-500">
                        No {activeTab} found.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                      >
                        {/* User */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm shrink-0">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {user.name}
                              </p>
                              <p style={{
                                fontSize: TYPOGRAPHY.CAPTION.fontSize,
                                lineHeight: TYPOGRAPHY.CAPTION.lineHeight,
                                fontWeight: TYPOGRAPHY.CAPTION.fontWeight,
                              }}
                                className={TYPOGRAPHY_CLASSES.CAPTION}>{user.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role & Plan */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2.5 py-1 text-[11px] font-bold tracking-wide rounded-md border capitalize ${user.role?.toLowerCase() === "admin"
                                ? "bg-red-500/10 text-red-600 border-red-500/20"
                                : user.role?.toLowerCase() === "instructor"
                                  ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                  : "bg-brand-success/10 text-[#174778] border-brand-success/20"
                                }`}
                            >
                              {user.role || "User"}
                            </span>
                            {user.role === "user" && (
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-md border capitalize ${user.plan === "premium"
                                  ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                                  : user.plan === "pro"
                                    ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                                    : "bg-gray-100 text-gray-700 border-gray-200"
                                  }`}
                              >
                                {user.plan ? `${user.plan} Plan` : "Starter Plan"}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Today's Sessions */}
                        <td className="py-4 px-4">
                          {user.todaySessions.length > 0 ? (
                            <div className="space-y-1.5">
                              {user.todaySessions.slice(0, 2).map((session, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[11px] font-semibold">
                                  <LogIn className="w-3 h-3 text-emerald-500 shrink-0" />
                                  <span className="text-emerald-700">{formatTime(session.loginAt)}</span>
                                  <span className="text-gray-300">→</span>
                                  <LogOut className="w-3 h-3 text-red-400 shrink-0" />
                                  <span className="text-red-600">{formatTime(session.logoutAt)}</span>
                                  {session.durationSeconds > 0 && (
                                    <span className="text-gray-400 text-[10px]">
                                      ({formatDuration(session.durationSeconds)})
                                    </span>
                                  )}
                                </div>
                              ))}
                              {user.todaySessions.length > 2 && (
                                <span className="text-[10px] text-gray-400">
                                  +{user.todaySessions.length - 2} more session{user.todaySessions.length > 3 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Not logged in today</span>
                          )}
                        </td>

                        {/* Time Spent */}
                        <td className="py-4 px-4">
                          {user.todayTimeSpentSeconds > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-md border border-amber-100">
                              <Timer className="w-3 h-3" />
                              {formatDuration(user.todayTimeSpentSeconds)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-4 px-4 text-right relative">
                          <button
                            onClick={() =>
                              setOpenActionMenuId(
                                openActionMenuId === user.id ? null : user.id,
                              )
                            }
                            className="p-1.5 text-gray-400 hover:text-gray-800 rounded-md hover:bg-gray-100 transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {openActionMenuId === user.id && (
                            <div className="absolute right-8 top-10 w-48 bg-white border border-gray-100 shadow-xl rounded-xl z-50 py-2 overflow-hidden text-left">
                              <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                                Change Role To:
                              </div>
                              {ROLES.map((r) => (
                                <button
                                  key={r.value}
                                  onClick={() => handleChangeRole(user.id, r.value)}
                                  className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 text-gray-700 transition-colors"
                                >
                                  {r.label}
                                </button>
                              ))}
                              {user.role === "user" && (
                                <>
                                  <div className="border-t border-gray-100 mt-1 pt-1">
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                                      Upgrade / Change Plan:
                                    </div>
                                    {[
                                      { value: "starter", label: "Starter" },
                                      { value: "pro", label: "Pro" },
                                      { value: "premium", label: "Premium" },
                                    ].map((p) => (
                                      <button
                                        key={p.value}
                                        onClick={() => handleChangePlan(user.id, p.value)}
                                        className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center justify-between ${user.plan === p.value
                                          ? "text-brand-primary font-bold bg-brand-primary/5"
                                          : "text-gray-700"
                                          }`}
                                      >
                                        <span>{p.label} Plan</span>
                                        {user.plan === p.value && <CheckCircle2 size={12} className="text-brand-primary" />}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                              <div className="border-t border-gray-100 mt-1 pt-1">
                                <button
                                  onClick={() => handleDeleteClick(user)}
                                  className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 text-red-600 font-semibold transition-colors"
                                >
                                  {user.role === "admin"
                                    ? "Remove Admin"
                                    : user.role === "instructor"
                                      ? "Remove Instructor"
                                      : "Remove Scholar"}
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {!loading && filteredUsers.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/30">
                <p className="text-xs text-gray-500 font-medium">
                  Showing{" "}
                  <span className="font-semibold text-gray-800">
                    {startIndex + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-gray-800">
                    {Math.min(startIndex + ITEMS_PER_PAGE, filteredUsers.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-800">
                    {filteredUsers.length}
                  </span>{" "}
                  {activeTab}
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    title="Previous Page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (page) =>
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - currentPage) <= 1,
                    )
                    .map((page, idx, array) => {
                      const showEllipsis = idx > 0 && page - array[idx - 1] > 1;
                      return (
                        <div key={page} className="flex items-center gap-1">
                          {showEllipsis && (
                            <span className="px-1 text-xs text-gray-400 select-none">
                              ...
                            </span>
                          )}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${currentPage === page
                              ? "bg-brand-primary text-white shadow-sm"
                              : "text-gray-600 border border-gray-200 hover:bg-white"
                              }`}
                          >
                            {page}
                          </button>
                        </div>
                      );
                    })}

                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    title="Next Page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* --- DELETE CONFIRMATION MODAL --- */}
      {showDeleteConfirm && deletingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                Remove {deletingUser.role === "admin" ? "Admin" : deletingUser.role === "instructor" ? "Instructor" : "Scholar"}
              </h3>
              <p className="text-sm text-gray-500 text-center">
                Are you sure you want to permanently remove{" "}
                <strong className="text-gray-900">{deletingUser.name || deletingUser.email}</strong>?
                This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingUser(null);
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <Button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isDeleting ? "Removing..." : "Remove"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {toastMessage && (
        <div className="fixed bottom-8 right-8 bg-copy-dark text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="text-emerald-400" size={20} />
          <span className="text-sm font-semibold tracking-wide">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
}
