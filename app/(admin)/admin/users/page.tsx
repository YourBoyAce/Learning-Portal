"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY, TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import Image from "next/image";
import {
  createUser,
  updateUserRole,
  deleteUser,
} from "@/app/actions/create-user";
import {
  Eye,
  EyeOff,
  MoreVertical,
  Download,
  Filter,
  Search,
  CheckCircle2,
  Users,
  Timer,
  LogIn,
  LogOut,
} from "lucide-react";

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
  todaySessions: LoginSession[];
  todayTimeSpentSeconds: number;
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

const ROLES = [
  { value: "user", label: "User" },
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState({ type: "", message: "" });

  const [users, setUsers] = useState<User[]>([]);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [filterQuery, setFilterQuery] = useState("");
  const [filterType, setFilterType] = useState<"email" | "role">("email");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  async function fetchUsers() {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: loginLogs } = await supabase
      .from("user_login_logs")
      .select("user_id, logged_in_at, last_heartbeat_at, session_duration_seconds")
      .gte("logged_in_at", todayStart.toISOString())
      .order("logged_in_at", { ascending: true });

    const logsByUser = new Map<string, { sessions: LoginSession[]; totalSec: number }>();
    if (loginLogs) {
      for (const log of loginLogs) {
        if (!logsByUser.has(log.user_id)) {
          logsByUser.set(log.user_id, { sessions: [], totalSec: 0 });
        }
        const g = logsByUser.get(log.user_id)!;
        const duration = log.session_duration_seconds || 0;
        const loginMs = new Date(log.logged_in_at).getTime();
        const logoutMs =
          duration > 0
            ? loginMs + duration * 1000
            : log.last_heartbeat_at
              ? new Date(log.last_heartbeat_at).getTime()
              : loginMs;

        g.sessions.push({
          loginAt: log.logged_in_at,
          logoutAt: new Date(logoutMs).toISOString(),
          durationSeconds: duration,
        });
        g.totalSec += duration;
      }
    }

    if (!error && profiles) {
      const transformed = (profiles as ProfileRow[]).map((profile) => {
        const userLogs = logsByUser.get(profile.id);
        return {
          id: profile.id,
          name: profile.full_name || profile.email?.split("@")[0] || "Unknown",
          email: profile.email || "No Email",
          role: profile.role?.toLowerCase() || "user",
          todaySessions: userLogs?.sessions || [],
          todayTimeSpentSeconds: userLogs?.totalSec || 0,
        };
      });
      setUsers(transformed);
      setActiveUsersCount(transformed.filter((u) => u.todaySessions.length > 0).length);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormFeedback({ type: "", message: "" });

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    formData.append("role", role);

    const result = await createUser(formData);

    if (result.success) {
      setFormFeedback({ type: "success", message: "User account created." });
      setEmail("");
      setPassword("");
      setRole("user");
      fetchUsers();
    } else {
      setFormFeedback({
        type: "error",
        message: result.error || "Failed to create user.",
      });
    }
    setIsSubmitting(false);
  };

  const handleDownloadCSV = () => {
    const headers = ["ID", "Name", "Email", "Role", "Sessions Today", "Time Spent Today"];
    const csvContent = [
      headers.join(","),
      ...users.map(
        (u) =>
          `"${u.id}","${u.name}","${u.email}","${u.role}","${u.todaySessions.length}","${formatDuration(u.todayTimeSpentSeconds)}"`,
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "users.csv";
    link.click();
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    await updateUserRole(userId, newRole);
    setOpenActionMenuId(null);
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    if (window.confirm("Are you sure you want to permanently remove this user?")) {
      await deleteUser(userId);
      setOpenActionMenuId(null);
      fetchUsers();
    }
  };

  const filteredUsers = users.filter((user) => {
    if (!filterQuery) return true;
    const query = filterQuery.toLowerCase();
    if (filterType === "email") return user.email.toLowerCase().includes(query);
    if (filterType === "role") return user.role.toLowerCase().includes(query);
    return true;
  });

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

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[380px_1fr] gap-6 lg:gap-8 items-start">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-6">
            {/* ADD NEW USER FORM */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className={`${TYPOGRAPHY_CLASSES.SUBHEADING} mb-6`}>Add New User</h2>

              <form onSubmit={handleAddUser} className="space-y-5">
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
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                  />
                </div>

                <div>
                  <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                    Initial Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>
                    Assign Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all appearance-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                {formFeedback.message && (
                  <div
                    className={`p-3 rounded-lg text-sm font-medium ${formFeedback.type === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}
                  >
                    {formFeedback.message}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? "Creating..." : "Create User"}
                </Button>
              </form>
            </div>

            {/* ACTIVE USERS WIDGET */}
            <div className="bg-brand-heading/10 backdrop-blur-md border border-brand-heading/15 rounded-2xl shadow-sm p-6 flex items-center justify-between text-brand-heading relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500 opacity-10 rounded-full blur-2xl"></div>

              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-heading opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-heading"></span>
                  </span>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users logged in today
                  </p>
                </div>
                <p className="text-4xl font-bold mt-2 text-brand-heading">
                  {loading ? "-" : activeUsersCount}
                </p>
              </div>

              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center relative z-10 shrink-0">
                <Image
                  src={ICONS.USERS}
                  alt="User Icon"
                  width={30}
                  height={30}
                />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: USER REGISTRY TABLE */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>User Registry</h2>

              <div className="flex items-center gap-3">
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-gray-400">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder={`Search by ${filterType}...`}
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
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

            <div className="overflow-x-auto flex-1">
              <table className="w-full min-w-[860px] text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      User
                    </th>
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      Role
                    </th>
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      Today&apos;s Sessions
                    </th>
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      Time Spent
                    </th>
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-gray-500">
                        Loading users...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-gray-500">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
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
                              <p style={{
                                fontSize: TYPOGRAPHY.BODY.fontSize,
                                lineHeight: TYPOGRAPHY.BODY.lineHeight,
                                fontWeight: TYPOGRAPHY.H2.fontWeight,
                              }}
                                className="text-brand-heading">
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

                        {/* Role */}
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 text-[11px] font-bold tracking-wide rounded-md border ${user.role?.toLowerCase() === "admin"
                              ? "bg-red-500/10 text-red-600 border-red-500/20"
                              : "bg-brand-success/10 text-[#174778] border-brand-success/20"
                              }`}
                          >
                            {user.role || "User"}
                          </span>
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
                        <td className="py-4 px-4 text-center">
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
                              <div className="border-t border-gray-100 mt-1 pt-1">
                                <button
                                  onClick={() => handleDelete(user.id)}
                                  className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 text-red-600 font-semibold transition-colors"
                                >
                                  Remove User
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
          </div>
        </div>
      </div>
    </div>
  );
}
