"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { createUser } from "@/app/actions/create-user";

interface Scholar {
  id: string;
  name: string;
  email: string;
  roles: string[];
  engagement: number;
}

export default function AdminUsers() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch users from Supabase on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform profiles to scholar format
      const transformedScholars: Scholar[] = profiles.map((profile: { id: string; email: string; role: string }) => ({
        id: profile.id,
        name: profile.email?.split("@")[0] || "Unknown",
        email: profile.email,
        roles: [profile.role === "admin" ? "Admin" : "Student"],
        engagement: Math.floor(Math.random() * 100),
      }));

      setScholars(transformedScholars);
    } catch (err: unknown) {
      console.error("Error fetching users:", err);
      setError("Failed to fetch users. Please ensure the profiles table exists.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!email || !password || !role) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);
      formData.append("role", role);

      const result = await createUser(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      // Reset form and refresh users
      setEmail("");
      setPassword("");
      setRole("");
      setSuccess("User created successfully!");
      fetchUsers();

      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      console.error("Error creating user:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to create user. Please check your permissions.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              User Management
            </h1>
            <p className="text-sm text-gray-500 max-w-2xl">
              Manage the academic community members, assign roles, and monitor engagement levels across the sanctuary.
            </p>
          </div>
          <button className="mt-4 md:mt-0 bg-[#2563EB] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New User
          </button>
        </div>

        {/* Main Content - 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Panel - Forms */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Add New Scholar Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Scholar</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="scholar@atelier.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Temporary Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] pr-10"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Academic Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
                  >
                    <option value="">Select role...</option>
                    <option>Research Fellow</option>
                    <option>Academic Member</option>
                    <option>Guest Scholar</option>
                    <option>Lead Curator</option>
                  </select>
                </div>

                <button 
                  onClick={handleCreateUser}
                  disabled={loading}
                  className="w-full bg-[#2563EB] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? "Registering..." : (
                    <>
                      Register Member
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
                
                {error && (
                  <div className="bg-red-50 border-l-2 border-red-500 p-2">
                    <p className="text-red-700 text-xs">{error}</p>
                  </div>
                )}
                
                {success && (
                  <div className="bg-green-50 border-l-2 border-green-500 p-2">
                    <p className="text-green-700 text-xs">{success}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#2563EB] rounded-xl p-4 text-white">
                <p className="text-xs font-medium opacity-80 mb-1">Total Scholars</p>
                <p className="text-2xl font-bold">{scholars.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-1">Admins</p>
                <p className="text-2xl font-bold text-gray-900">{scholars.filter(s => s.roles.includes("Admin")).length}</p>
              </div>
            </div>
          </div>

          {/* Right Panel - Active Academic Registry */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              
              {/* Table Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Active Academic Registry</h3>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Scholar
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Engagement
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {scholars.map((scholar) => (
                      <tr key={scholar.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                              {scholar.name.split(" ").map(n => n[0]).join("")}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{scholar.name}</p>
                              <p className="text-xs text-gray-500">{scholar.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {scholar.roles.map((r, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-full max-w-[120px]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-500">{scholar.engagement}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-[#2563EB] h-2 rounded-full transition-all duration-300"
                                style={{ width: `${scholar.engagement}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-6 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing 4 of 286 scholars
                </p>
                <div className="flex items-center gap-1">
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2563EB] text-white text-sm font-medium">
                    1
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-medium transition-colors">
                    2
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-sm font-medium transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}