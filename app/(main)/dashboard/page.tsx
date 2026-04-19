"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Profile = {
  full_name?: string | null;
  role?: string | null;
};

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;
      if (!user) {
        router.replace("/login");
        return;
      }

      if (cancelled) return;

      setUserEmail(user.email ?? null);

      const { data: fetchedProfile } = await supabase
        .from("profiles")
        .select("full_name,role")
        .eq("id", user.id)
        .single();

      if (cancelled) return;
      setProfile((fetchedProfile ?? null) as Profile | null);
      setLoading(false);
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace("/login");
        }
      }
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  const userName = useMemo(() => {
    return (
      profile?.full_name ||
      (userEmail ? userEmail.split("@")[0] : null) ||
      "Learner"
    );
  }, [profile?.full_name, userEmail]);

  if (loading) return null;

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">

        <div className="flex justify-end mb-4">
          <button
            onClick={handleSignOut}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>
        
        {/* Welcome Banner - Dark Blue */}
        <div className="bg-[#0B1E6D] rounded-2xl p-8 text-white mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back to The Automate, {userName}.
          </h1>
          <p className="text-blue-200 text-sm mb-6 max-w-2xl">
            Your intellectual journey continues. You have five modules to complete this week to stay on track for your fellowship.
          </p>
          <div className="flex gap-3">
            <button className="bg-white text-[#0B1E6D] px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-100">
              Resume Last Lesson
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button className="bg-transparent border border-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10">
              View Calendar
            </button>
          </div>
        </div>

        {/* Active Course & Progress */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Active Course */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">In Next</span>
              <span className="text-xs text-gray-500">02:45:00</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-1">Advanced Semiotics in Digital Architecture</h2>
            <p className="text-xs text-gray-500 mb-4">Your next module is ready</p>
            
            {/* Course Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Module 4: The Language of Space</h3>
                <p className="text-xs text-gray-500">Hosted by Dr. Aria Thorne • 14:00 GMT</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex -space-x-1">
                    <div className="w-5 h-5 bg-gray-300 rounded-full"></div>
                    <div className="w-5 h-5 bg-gray-400 rounded-full"></div>
                  </div>
                  <span className="text-xs text-gray-400">Joining soon...</span>
                </div>
              </div>
              <button className="w-10 h-10 bg-[#0B1E6D] rounded-lg flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Weekly Progress */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Weekly Progress</h3>
            <div className="flex items-center justify-center mb-4">
              <div className="w-24 h-24 rounded-full border-4 border-[#0B1E6D] flex items-center justify-center">
                <span className="text-2xl font-bold text-[#0B1E6D]">75%</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Hours Studied</span>
                <span className="text-gray-700 font-medium">12.5 hrs</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Tasks Completed</span>
                <span className="text-gray-700 font-medium">8/10</span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Studies */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Active Studies</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Pick up exactly where you left off in your curated coursework.</span>
              <button className="text-[#0B1E6D] text-sm font-medium flex items-center gap-1">
                Browse All
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            {/* Course 1 */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 text-white">
              <div className="w-12 h-12 bg-white/10 rounded-lg mb-3 flex items-center justify-center">
                <span className="text-xl">🎓</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Philosophy</span>
              <h3 className="font-semibold mt-1 mb-2">Metaphysics & Modernity</h3>
              <div className="w-full bg-gray-700 rounded-full h-1 mb-2">
                <div className="bg-blue-400 h-1 rounded-full" style={{ width: "45%" }}></div>
              </div>
              <p className="text-xs text-gray-400">45% • Last Accessed: 3 days ago</p>
            </div>

            {/* Course 2 */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 text-white">
              <div className="w-12 h-12 bg-white/10 rounded-lg mb-3 flex items-center justify-center">
                <span className="text-xl">🔬</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-gray-400">History</span>
              <h3 className="font-semibold mt-1 mb-2">Technological Determinism</h3>
              <div className="w-full bg-gray-700 rounded-full h-1 mb-2">
                <div className="bg-blue-400 h-1 rounded-full" style={{ width: "12%" }}></div>
              </div>
              <p className="text-xs text-gray-400">12% • Nearing Completion</p>
            </div>

            {/* Course 3 */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 text-white">
              <div className="w-12 h-12 bg-white/10 rounded-lg mb-3 flex items-center justify-center">
                <span className="text-xl">🏛️</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Architecture</span>
              <h3 className="font-semibold mt-1 mb-2">Neo-Classical Transitions</h3>
              <div className="w-full bg-gray-700 rounded-full h-1 mb-2">
                <div className="bg-blue-400 h-1 rounded-full" style={{ width: "0%" }}></div>
              </div>
              <p className="text-xs text-gray-400">Ready to start</p>
            </div>
          </div>
        </div>

        {/* Bottom Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Scholar's Insight */}
          <div className="bg-[#8B4513] rounded-xl p-6 text-white">
            <h3 className="font-semibold mb-2">Scholar&apos;s Insight</h3>
            <p className="text-sm text-white/80 leading-relaxed">
              &ldquo;Knowledge is not static. The more things you will know. The more that you learn, the more places you&apos;ll go.&rdquo; — Theodore Geisel
            </p>
          </div>

          {/* Expand Your Horizons */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Expand Your Horizons</h3>
              <p className="text-xs text-gray-500 max-w-xs">
                Our spring research grants are now open for application. Learn how your current coursework can qualify you for funding.
              </p>
            </div>
            <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
              Explore Grants
            </button>
          </div>
        </div>

        {/* User Info Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Logged in as: <span className="text-gray-700 font-medium">{userEmail}</span>
            {profile?.role && (
              <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-gray-600">{profile.role}</span>
            )}
          </p>
        </div>

      </div>
    </div>
  );
}