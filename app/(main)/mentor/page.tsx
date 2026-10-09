"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useLoading } from "@/app/context/LoadingContext";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/app/components/UserAvatar";
import { Calendar, Mail, Loader2, Sparkles, CheckCircle2, AlertCircle, ExternalLink, ShieldAlert, BookOpen } from "lucide-react";
import { dispatchProfileUpdated } from "@/app/lib/profile-events";
import { getUserCommunities } from "@/app/actions/community-chat";
import CourseCard from "@/app/components/course/CourseCard";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  cal_link: string;
  mentor_bio: string;
  mentor_expertise: string[];
}

export default function MentorDashboardPage() {
  const { setLoading: setGlobalLoading } = useLoading();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [mentorCourses, setMentorCourses] = useState<any[]>([]);
  const router = useRouter();

  // Form states
  const [calLink, setCalLink] = useState("");
  const [mentorBio, setMentorBio] = useState("");
  const [mentorExpertise, setMentorExpertise] = useState("");
  
  // Feedback messages
  const [message, setMessage] = useState<{ type: "success" | "error" | ""; text: string }>({
    type: "",
    text: "",
  });

  const isRoleValid =
    userProfile?.role?.toLowerCase() === "instructor" ||
    userProfile?.role?.toLowerCase() === "admin";

  useEffect(() => {
    setGlobalLoading(loading);
    return () => setGlobalLoading(false);
  }, [loading, setGlobalLoading]);

  // Load current profile & mentor details
  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        const user = session?.user;

        if (authError || !user || !session) {
          throw new Error("User session not found.");
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, full_name, role, cal_link, mentor_bio, mentor_expertise")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;
        
        // Fetch mentor's courses
        const { courses, error: coursesError } = await getUserCommunities(session.access_token);
        if (!coursesError) {
          setMentorCourses(courses || []);
        }

        if (profile) {
          const loadedProfile: UserProfile = {
            id: profile.id,
            email: profile.email || "",
            full_name: profile.full_name || user.email?.split("@")[0] || "Instructor",
            role: profile.role || "user",
            cal_link: profile.cal_link || "",
            mentor_bio: profile.mentor_bio || "",
            mentor_expertise: Array.isArray(profile.mentor_expertise) ? profile.mentor_expertise : [],
          };

          setUserProfile(loadedProfile);
          setCalLink(loadedProfile.cal_link);
          setMentorBio(loadedProfile.mentor_bio);
          setMentorExpertise(loadedProfile.mentor_expertise.join(", "));
        }
      } catch (err) {
        console.error("Error loading mentor details:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    setIsSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const expertiseList = mentorExpertise
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from("profiles")
        .update({
          cal_link: calLink.trim(),
          mentor_bio: mentorBio.trim(),
          mentor_expertise: expertiseList,
        })
        .eq("id", userProfile.id);

      if (error) throw error;

      // Update local state copy
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              cal_link: calLink.trim(),
              mentor_bio: mentorBio.trim(),
              mentor_expertise: expertiseList,
            }
          : null
      );

      dispatchProfileUpdated();
      setMessage({ type: "success", text: "Dashboard settings saved successfully!" });
    } catch (err) {
      console.error("Failed to update mentor details:", err);
      setMessage({
        type: "error",
        text: "Failed to update settings. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Render loading state
  if (loading) {
    return null; // Handled by global layout loading spinner
  }

  // Guard: Not an Instructor or Admin
  if (!isRoleValid) {
    return (
      <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 flex items-center justify-center font-sans">
        <div className="max-w-md w-full bg-white border border-gray-100 rounded-3xl p-8 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
            <ShieldAlert size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900">Access Restricted</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              The Mentor Dashboard is restricted to registered instructors and program leads. 
              If you believe this is an error, please contact your workspace administrator.
            </p>
          </div>
          <Button
            onClick={() => window.location.href = "/dashboard"}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-brand-primary text-white"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Format expertise preview list
  const previewExpertise = mentorExpertise
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="border-b border-gray-100 pb-6 text-left">
          <h1 className={`${TYPOGRAPHY_CLASSES.MAIN_HEADING} flex items-center gap-2.5`}>
            <Calendar className="w-7 h-7 text-brand-primary" />
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your scheduling configuration, bio, and expertise shown to students in Mentor Connect.
          </p>
        </div>

        {/* Mentor Courses Section */}
        {mentorCourses.length > 0 && (
          <div className="space-y-4 text-left">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-brand-primary" />
              Your Courses
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {mentorCourses.map((course) => (
                <div key={course.id} className="h-full">
                  <CourseCard
                    id={course.id}
                    title={course.title}
                    description={course.description || undefined}
                    thumbnail={course.thumbnail_url || undefined}
                    variant="user"
                    showProgress={false}
                    onClick={() => router.push(`/courses/${course.id}`)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4">
          
          {/* Left Column: Settings Form */}
          <div className="lg:col-span-7 bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm text-left space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-gray-50">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-gray-900">Booking & Profile Setup</h2>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              
              {/* Cal.com link */}
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                  CAL.COM SCHEDULING LINK
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-3.5 text-xs text-gray-400 font-medium">
                      cal.com/
                    </span>
                    <input
                      type="text"
                      value={calLink}
                      onChange={(e) => setCalLink(e.target.value)}
                      className="w-full bg-surface-subtle border border-transparent rounded-md pl-20 pr-4 py-3.5 text-[13px] text-gray-800 font-medium focus:border-brand-primary/30 focus:bg-white focus:outline-none transition-all"
                      placeholder="username/30min"
                      required
                    />
                  </div>
                  <a
                    href="https://cal.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-4 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl text-gray-500 transition-all text-xs font-semibold gap-1.5"
                  >
                    Cal.com <ExternalLink size={12} />
                  </a>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Enter your Cal.com event path (excluding the main domain). Make sure this event is public.
                </p>
              </div>

              {/* Professional Bio */}
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                  PROFESSIONAL BIO
                </label>
                <textarea
                  value={mentorBio}
                  onChange={(e) => setMentorBio(e.target.value)}
                  rows={4}
                  maxLength={400}
                  className="w-full bg-surface-subtle border border-transparent rounded-md px-4 py-4 text-[13px] text-gray-600 leading-relaxed focus:border-brand-primary/30 focus:bg-white focus:outline-none transition-all resize-none"
                  placeholder="Tell students about your background, experience, and how you can support them..."
                  required
                />
                <div className="text-right text-[9px] text-gray-400 font-bold">
                  {mentorBio.length} / 400 CHARACTERS
                </div>
              </div>

              {/* Expertise */}
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                  EXPERTISE TAGS (COMMA-SEPARATED)
                </label>
                <input
                  type="text"
                  value={mentorExpertise}
                  onChange={(e) => setMentorExpertise(e.target.value)}
                  className="w-full bg-surface-subtle border border-transparent rounded-md px-4 py-3.5 text-[13px] text-gray-800 font-medium focus:border-brand-primary/30 focus:bg-white focus:outline-none transition-all"
                  placeholder="e.g. Next.js, API Engineering, System Design, Python"
                />
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Provide keywords separated by commas to help scholars recognize your fields of instruction.
                </p>
              </div>

              {/* Status Message */}
              {message.text && (
                <div className={`p-4 rounded-xl flex items-start gap-3 border ${
                  message.type === "success" 
                    ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                    : "bg-red-50 text-red-800 border-red-100"
                }`}>
                  {message.type === "success" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <span className="text-xs font-semibold leading-normal">{message.text}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="w-full justify-center py-3 rounded-xl font-bold bg-brand-primary hover:bg-brand-primary/95 text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving Changes...
                    </>
                  ) : (
                    "Save Dashboard Settings"
                  )}
                </Button>
              </div>

            </form>
          </div>

          {/* Right Column: Live Student Preview Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 text-left">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Student Preview Card
              </h2>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                Live Preview
              </span>
            </div>

            {/* Simulated Booking Card */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all min-h-[340px] text-left relative overflow-hidden">
              <div className="space-y-5">
                
                {/* Header: Avatar + Role Badge */}
                <div className="flex items-start justify-between gap-2">
                  <UserAvatar
                    name={userProfile?.full_name || ""}
                    email={userProfile?.email || ""}
                    size={60}
                    textSize="text-xl"
                  />
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    userProfile?.role?.toLowerCase() === "admin"
                      ? "bg-purple-50 text-purple-700 border-purple-100"
                      : "bg-blue-50 text-blue-700 border-blue-100"
                  }`}>
                    {userProfile?.role?.toLowerCase() === "admin" ? "Lead Mentor" : "Cohort Mentor"}
                  </span>
                </div>

                {/* Profile Information */}
                <div>
                  <h3 className="font-bold text-gray-900 leading-snug text-base">
                    {userProfile?.full_name}
                  </h3>
                  {userProfile?.email && (
                    <p className="text-[10px] text-gray-400 font-semibold mt-0.5 truncate flex items-center gap-1">
                      <Mail size={10} /> {userProfile.email}
                    </p>
                  )}
                </div>

                {/* Bio */}
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 bg-gray-50 p-3 rounded-2xl border border-gray-50 min-h-[72px]">
                  {mentorBio.trim() || "Your professional bio will appear here to introduce you to students..."}
                </p>

                {/* Expertise Tags */}
                {previewExpertise.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {previewExpertise.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] font-bold text-gray-500 bg-gray-100/70 border border-gray-100 rounded px-1.5 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                    {previewExpertise.length > 3 && (
                      <span className="text-[9px] font-bold text-brand-primary bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
                        +{previewExpertise.length - 3} More
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* CTA button */}
              <div className="pt-5 border-t border-gray-50 mt-5">
                <Button
                  disabled
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-brand-primary/20 text-brand-primary/60 cursor-not-allowed border border-transparent shadow-none"
                >
                  <Calendar size={14} />
                  Schedule 1-on-1
                </Button>
              </div>

            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left">
              <h4 className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                <AlertCircle size={14} className="text-slate-500" />
                How student booking works
              </h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                When students click the "Schedule 1-on-1" button on your card from their Mentor Connect dashboard, 
                an interactive modal will open loading your Cal.com link: <strong>cal.com/{calLink || "..."}</strong>.
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
