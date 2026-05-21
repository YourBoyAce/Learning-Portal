"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { Logo } from "@/app/components/Logo";
import UserAvatar from "@/app/components/UserAvatar";
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);

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
      const { data: profile } = await supabase
  .from("profiles")
  .select("full_name")
  .eq("id", user.id)
  .single();

if (profile?.full_name) {
  setFullName(profile.full_name);
}
      
      setLoading(false);
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace("/login");
        }
      },
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  // Session heartbeat: update login log every 60s to track time spent
  useEffect(() => {
    if (loading || !userEmail) return;

    const sessionStart = Date.now();

    const heartbeat = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const elapsedSeconds = Math.floor((Date.now() - sessionStart) / 1000);

      // Get the most recent login log for this user today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: recentLog } = await supabase
        .from("user_login_logs")
        .select("id")
        .eq("user_id", session.user.id)
        .gte("logged_in_at", todayStart.toISOString())
        .order("logged_in_at", { ascending: false })
        .limit(1);

      if (recentLog && recentLog.length > 0) {
        await supabase
          .from("user_login_logs")
          .update({
            last_heartbeat_at: new Date().toISOString(),
            session_duration_seconds: elapsedSeconds,
          })
          .eq("id", recentLog[0].id);
      }
    }, 60000); // every 60 seconds

    return () => clearInterval(heartbeat);
  }, [loading, userEmail]);

  if (loading) return null;

  const handleSignOut = async () => {
    setShowSignOutDialog(true);
  };

  const confirmSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", active: pathname === "/dashboard", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg> },
    { label: "My Learning", href: "/courses", active: pathname === "/courses", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
    { label: "Quizzes & Artifacts", href: "/practice", active: pathname === "/practice", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> },
    { label: "Profile", href: "/profile", active: pathname === "/profile", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[260px] bg-[#F8FAFC] border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <Logo width={180} height={60} />
            </div>
          </div>

          <nav className="flex-1 px-4 py-2 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${item.active
                    ? "bg-[#F1F5F9] text-[#2283FF]"
                    : "text-gray-500 hover:bg-[#F1F5F9] hover:text-[#2283FF]"
                  }`}
              >
                <div className={`${item.active ? "text-[#2283FF]" : "text-gray-400"}`}>
                  {item.icon}
                </div>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="p-6 space-y-4">
            <button onClick={handleSignOut} className="w-full bg-[#2283FF] hover:bg-[#2283FF] text-white py-2.5 rounded-md text-sm font-semibold transition-all duration-200 shadow-sm flex items-center justify-center gap-2 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sign Out
            </button>

            <button className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-medium px-2 py-2">
              <svg className="w-[18px] h-[18px] text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Support
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-end">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">
                  {userEmail?.split("@")[0]}
                </p>
                <p className="text-xs text-gray-400">{userEmail}</p>
              </div>
              {/* <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-lg">ðŸ‘¤</span>
              </div> */}
              <UserAvatar
  name={fullName}
  email={userEmail}
  size={40}
  textSize="text-sm"
/>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-[#F5F7FA]">
            {children}
          </main>
        </div>
      </div>

      {showSignOutDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign Out</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to sign out of your account?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignOutDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSignOut}
                className="flex-1 px-4 py-2 bg-[#2283FF] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
