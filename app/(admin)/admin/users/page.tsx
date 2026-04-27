"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
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
} from "lucide-react";

interface Scholar {
  id: string;
  name: string;
  email: string;
  role: string;
  engagement: number;
}

const AVAILABLE_ROLES = [
  "Admin",
  "User",
  "Research Fellow",
  "Academic Curator",
  "Guest Scholar",
  "Lead Curator",
];

export default function AdminUsers() {
  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("User");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState({ type: "", message: "" });

  // Table & Stats State
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [activeScholarsCount, setActiveScholarsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [filterQuery, setFilterQuery] = useState("");
  const [filterType, setFilterType] = useState<"email" | "role">("email");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Action Menu State
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && profiles) {
      const transformedScholars = profiles.map((profile: any) => ({
        id: profile.id,
        name: profile.full_name || profile.email?.split("@")[0] || "Unknown",
        email: profile.email || "No Email",
        role: profile.role || "User",
        engagement: Math.floor(Math.random() * 100), // Placeholder engagement
      }));
      setScholars(transformedScholars);

      // Simulate "Online Now" based on a fraction of total users until
      // Supabase Realtime Presence is explicitly configured in your database.
      setActiveScholarsCount(
        Math.max(1, Math.ceil(transformedScholars.length * 0.3)),
      );
    }
    setLoading(false);
  };

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
      setFormFeedback({ type: "success", message: "Scholar account created!" });
      setEmail("");
      setPassword("");
      setRole("User");
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
    const headers = ["ID", "Name", "Email", "Role", "Engagement"];
    const csvContent = [
      headers.join(","),
      ...scholars.map(
        (s) =>
          `"${s.id}","${s.name}","${s.email}","${s.role}","${s.engagement}"`,
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "active_academic_registry.csv";
    link.click();
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    await updateUserRole(userId, newRole);
    setOpenActionMenuId(null);
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    if (
      window.confirm(
        "Are you sure you want to permanently remove this scholar?",
      )
    ) {
      await deleteUser(userId);
      setOpenActionMenuId(null);
      fetchUsers();
    }
  };

  const filteredScholars = scholars.filter((scholar) => {
    if (!filterQuery) return true;
    const query = filterQuery.toLowerCase();
    if (filterType === "email")
      return scholar.email.toLowerCase().includes(query);
    if (filterType === "role")
      return scholar.role.toLowerCase().includes(query);
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 lg:p-10 font-sans text-gray-900">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#174778] tracking-tight">
            User Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage scholars, roles, and platform access.
          </p>
        </div>

        {/* MAIN LAYOUT GRID: Left Column (Form + Widget) | Right Column (Table) */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[380px_1fr] gap-8 items-start">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-6">
            {/* 1. ADD NEW SCHOLAR FORM */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-[#0f172a] mb-6">
                Add New Scholar
              </h2>

              <form onSubmit={handleAddUser} className="space-y-5">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="scholar@theautomate.edu"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                    Initial Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all pr-10"
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
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                    Assign Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-gray-50/50 outline-none focus:border-[#174778] focus:ring-1 focus:ring-[#174778] transition-all appearance-none"
                  >
                    {AVAILABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
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

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#174778] hover:bg-[#113a63] text-white py-3.5 rounded-lg text-sm font-semibold transition-all shadow-sm disabled:opacity-70 flex items-center justify-center mt-4"
                >
                  {isSubmitting ? "Processing..." : "Create Scholar Account"}
                </button>
              </form>
            </div>

            {/* 2. ACTIVE SCHOLARS WIDGET */}
            <div className="bg-[#0f172a] rounded-2xl shadow-lg p-6 flex items-center justify-between text-white relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500 opacity-10 rounded-full blur-2xl"></div>

              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Active scholars right now
                  </p>
                </div>
                <p className="text-4xl font-bold mt-2 text-white">
                  {loading ? "-" : activeScholarsCount}
                </p>
              </div>

              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center relative z-10 shrink-0">
                <Users className="text-emerald-400" size={24} />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: ACADEMIC REGISTRY TABLE */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-[#0f172a]">
                Active Academic Registry
              </h2>

              <div className="flex items-center gap-3">
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-gray-400">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder={`Filter by ${filterType}...`}
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#174778] w-[200px]"
                  />
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                    title="Filter Criteria"
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
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${filterType === "email" ? "text-[#174778] font-semibold" : "text-gray-600"}`}
                      >
                        {filterType === "email" && <CheckCircle2 size={14} />}{" "}
                        Email
                      </button>
                      <button
                        onClick={() => {
                          setFilterType("role");
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${filterType === "role" ? "text-[#174778] font-semibold" : "text-gray-600"}`}
                      >
                        {filterType === "role" && <CheckCircle2 size={14} />}{" "}
                        Role
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleDownloadCSV}
                  className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Download CSV"
                >
                  <Download size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="py-4 px-6 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Scholar
                    </th>
                    <th className="py-4 px-6 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Assigned Role
                    </th>
                    <th className="py-4 px-6 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Engagement
                    </th>
                    <th className="py-4 px-6 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center py-10 text-gray-500"
                      >
                        Loading scholars...
                      </td>
                    </tr>
                  ) : filteredScholars.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center py-10 text-gray-500"
                      >
                        No scholars found.
                      </td>
                    </tr>
                  ) : (
                    filteredScholars.map((scholar) => (
                      <tr
                        key={scholar.id}
                        className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#174778]/10 text-[#174778] flex items-center justify-center font-bold text-sm shrink-0">
                              {scholar.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">
                                {scholar.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {scholar.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex px-2.5 py-1 rounded-md bg-blue-50 text-[#174778] text-[11px] font-bold tracking-wide capitalize border border-blue-100">
                            {scholar.role}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full max-w-[80px]">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${scholar.engagement}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-600">
                              {scholar.engagement}%
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right relative">
                          <button
                            onClick={() =>
                              setOpenActionMenuId(
                                openActionMenuId === scholar.id
                                  ? null
                                  : scholar.id,
                              )
                            }
                            className="p-1.5 text-gray-400 hover:text-gray-800 rounded-md hover:bg-gray-100 transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {openActionMenuId === scholar.id && (
                            <div className="absolute right-8 top-10 w-48 bg-white border border-gray-100 shadow-xl rounded-xl z-50 py-2 overflow-hidden text-left">
                              <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                                Change Role To:
                              </div>
                              {AVAILABLE_ROLES.map((r) => (
                                <button
                                  key={r}
                                  onClick={() =>
                                    handleChangeRole(scholar.id, r)
                                  }
                                  className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 text-gray-700 transition-colors"
                                >
                                  {r}
                                </button>
                              ))}
                              <div className="border-t border-gray-100 mt-1 pt-1">
                                <button
                                  onClick={() => handleDelete(scholar.id)}
                                  className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 text-red-600 font-semibold transition-colors"
                                >
                                  Remove Scholar
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
