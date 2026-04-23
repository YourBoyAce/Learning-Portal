"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/app/lib/supabase";

export default function ProfilePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Scholar Extraordinaire");
  const [memberSince, setMemberSince] = useState("Loading...");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("/icons/profile.svg");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Could not verify user session.");

        setUserId(user.id);
        setEmail(user.email || "");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (!profileError && profile) {
          setFullName(profile.full_name || "");
          setBio(profile.bio || "");
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
          if (profile.role) setRole(profile.role);
          if (profile.created_at) {
            const date = new Date(profile.created_at);
            const formattedDate = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
            setMemberSince(formattedDate);
          }
        }
      } catch (err: any) {
        console.error(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    loadUserProfile();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let finalAvatarUrl = avatarUrl;
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${userId}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("profile-photos").upload(fileName, avatarFile);
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from("profile-photos").getPublicUrl(fileName);
          finalAvatarUrl = publicUrl;
        }
      }
      await supabase.from("profiles").update({
        full_name: fullName,
        bio: bio,
        avatar_url: finalAvatarUrl === "/images/profile.png" ? null : finalAvatarUrl,
      }).eq("id", userId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center bg-[#F5F7FA]">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-8 font-sans">
      <div className="max-w-[900px] mx-auto">
        <h1 className="text-4xl font-extrabold text-[#174778] tracking-tight mb-2">
          My Profile
        </h1>
        <p className="text-[13px] text-gray-500 mb-8 max-w-xl leading-relaxed">
          Customize your digital sanctuary. This information will be visible to your instructors and peers within the Academic Atelier ecosystem.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="space-y-6">

            {/* Profile Portrait */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-6 flex flex-col items-center">
              <h3 className="w-full text-left font-bold text-[#174778] text-[16px] mb-6">Profile Portrait</h3>
              <div className="relative w-[140px] h-[140px] bg-[#F1F5F9] rounded-full flex items-center justify-center border-[5px] border-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] mb-4">
                <Image src={avatarUrl} alt="Avatar" fill className="rounded-full object-cover" />
                <button
                  className="absolute bottom-1 right-1 bg-[#0052CC] text-white p-2 rounded-full shadow-md hover:bg-[#0047b3] transition border-2 border-white"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              </div>
              <p className="text-center text-[10px] text-gray-400 mb-5 px-2 leading-relaxed font-medium">
                Recommended: High-resolution square image (JPEG/PNG). Max 5MB.
              </p>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 border border-gray-200 text-[#174778] text-[13px] font-semibold rounded-md hover:bg-gray-50 transition flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Update Photo
              </button>
            </div>

            {/* Account Status */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-6">
              <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-5">ACCOUNT STATUS</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-400 font-medium">Role</span>
                  <span className="text-[13px] font-bold text-[#174778] capitalize">{role}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-400 font-medium">Member since</span>
                  <span className="text-[13px] font-bold text-[#174778]">{memberSince}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-400 font-medium">Verification</span>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-[#0052CC]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[13px] font-bold text-[#0052CC]">Verified</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Personal Identity */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-8">
              <h3 className="font-bold text-[#174778] text-[18px] mb-6">Personal Identity</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">FULL NAME</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-[#F8FAFC] border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:border-[#174778]/30 focus:bg-white focus:outline-none transition-colors" placeholder="Alexander Hamilton" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">EMAIL ADDRESS</label>
                  <input type="email" value={email} disabled className="w-full bg-[#F8FAFC] border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:outline-none cursor-not-allowed" />
                </div>
              </div>
            </div>

            {/* Scholarly Bio */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-8">
              <h3 className="font-bold text-[#174778] text-[18px] mb-6">Scholarly Bio</h3>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">INTELLECTUAL INTERESTS & GOALS</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full bg-[#F8FAFC] border border-transparent rounded-md px-4 py-4 text-[13px] text-gray-600 leading-relaxed focus:border-[#174778]/30 focus:bg-white focus:outline-none transition-colors resize-none"
                  placeholder="Dedicated polymath currently exploring..."
                />
                <div className="text-right mt-2">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{bio.length} / 500 CHARACTERS</span>
                </div>
              </div>
            </div>

            {/* Digital Footprint */}
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-8">
              <h3 className="font-bold text-[#174778] text-[18px] mb-6">Digital Footprint</h3>

              <div className="flex items-center bg-[#F8FAFC] rounded-md px-4 py-3.5 border border-transparent focus-within:border-[#174778]/30 focus-within:bg-white transition-colors mb-12">
                <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                <input type="text" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} className="w-full bg-transparent border-none text-[13px] text-gray-800 font-medium outline-none" placeholder="https://portfolio.atelier.edu/a-hamilton" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#00E5FF] rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium tracking-wide">Last saved 2 minutes ago</span>
                </div>
                <div className="flex items-center gap-5">
                  <button className="text-[13px] text-gray-600 font-semibold hover:text-gray-800 transition">
                    Discard
                  </button>
                  <button onClick={handleSave} disabled={isSaving} className="bg-[#0052CC] hover:bg-[#0047b3] text-white px-6 py-2.5 rounded-md text-[13px] font-semibold transition shadow-sm disabled:opacity-50">
                    {isSaving ? "Saving..." : "Commit Changes"}
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