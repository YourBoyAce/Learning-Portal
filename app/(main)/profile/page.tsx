"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import Image from "next/image";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export default function Profile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      setUserEmail(session.user.email ?? null);

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;

      setProfile(profileData);
      setFullName(profileData.full_name || "");
      setBio(profileData.bio || "");
      setAvatarPreview(profileData.avatar_url);
    } catch (err) {
      console.error("Error loading profile:", err);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let avatarUrl = profile.avatar_url;

      // Upload avatar if changed
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("profile-photos")
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
      }

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          bio,
          avatar_url: avatarUrl,
        })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      // Reload profile from database to confirm changes
      const { data: updatedProfile, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profile.id)
        .single();

      if (fetchError) throw fetchError;

      setProfile(updatedProfile);
      setFullName(updatedProfile.full_name || "");
      setBio(updatedProfile.bio || "");
      setAvatarPreview(updatedProfile.avatar_url);
      setAvatarFile(null);
      setSuccess("Profile updated successfully!");
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error saving profile:", err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500">Profile not found</div>
      </div>
    );
  }

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || userEmail?.[0]?.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-[#174778] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-[#174778]">Profile</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your academic profile and account settings</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Profile Portrait */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Profile Portrait</h3>
              <div className="flex flex-col items-center">
                <div
                  className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden mb-4 border-2 border-gray-200"
                >
                  {avatarPreview ? (
                    <Image
                      src={avatarPreview}
                      alt="Avatar"
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-semibold text-gray-400">{initials}</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: "none" }}
                  id="avatar-upload"
                />
                <label
                  htmlFor="avatar-upload"
                  className="px-4 py-2 bg-[#174778] text-white text-sm font-medium rounded hover:opacity-90 cursor-pointer"
                >
                  Update Photo
                </label>
              </div>
            </div>

            {/* Account Status */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Account Status</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Role</label>
                  <div className="text-sm text-gray-800 capitalize">{profile.role || "Student"}</div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Member since</label>
                  <div className="text-sm text-gray-800">
                    {new Date(profile.created_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Verification status</label>
                  <div className="text-sm text-gray-800">Verified</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Identity */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Personal Identity</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-gray-800 focus:outline-none focus:border-[#174778]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={userEmail || ""}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-gray-500 bg-gray-50"
                  />
                </div>
              </div>
            </div>

            {/* Scholarly Bio */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Scholarly Bio</h3>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your academic background, research interests, and professional goals..."
                rows={6}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-gray-800 focus:outline-none focus:border-[#174778] resize-vertical"
              />
            </div>

            {/* Digital Footprint */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Digital Footprint</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Portfolio URL</label>
                  <input
                    type="url"
                    placeholder="https://yourportfolio.url"
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-gray-800 focus:outline-none focus:border-[#174778]"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-l-2 border-red-500 p-3 mt-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border-l-2 border-green-500 p-3 mt-4">
                  <p className="text-green-700 text-sm">{success}</p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setAvatarFile(null);
                    setAvatarPreview(profile.avatar_url);
                    setFullName(profile.full_name || "");
                    setBio(profile.bio || "");
                  }}
                  disabled={saving}
                  className="px-6 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-[#174778] text-white text-sm font-medium rounded hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Commit Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}