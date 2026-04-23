"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import Image from "next/image";

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
    { label: "Completed Courses", href: "/completed", active: pathname === "/completed", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { label: "Analytics", href: "/analytics", active: pathname === "/analytics", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
    { label: "Calendar", href: "/calendar", active: pathname === "/calendar", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { label: "Community", href: "/community", active: pathname === "/community", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    { label: "Profile", href: "/profile", active: pathname === "/profile", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      {/* Top Navbar */}
      <header className="h-[60px] bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 z-10 relative">
        <div className="text-lg font-bold text-[#174778]">
          Academic Atelier
        </div>
        <div className="flex items-center text-[13px] font-medium">
          <div className="flex items-center gap-6 mr-8">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-800 transition-colors">Dashboard</Link>
            <Link href="/explore" className="text-gray-500 hover:text-gray-800 transition-colors">Explore</Link>
            <Link href="/profile" className="text-[#174778] font-bold">Profile</Link>
          </div>

          <div className="flex items-center gap-5 border-l border-gray-200 pl-8">
            <button className="text-gray-400 hover:text-gray-600">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </button>
            <button className="text-gray-400 hover:text-gray-600">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <div className="w-8 h-8 rounded-full overflow-hidden bg-[#F1F5F9] border border-gray-200 shrink-0 cursor-pointer">
              <Image src="/icons/profile.svg" alt="User Avatar" width={32} height={32} className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[260px] bg-[#F8FAFC] border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#174778] rounded-[4px] flex items-center justify-center text-white shrink-0">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 13.09l-5.5-3.03L12 10l5.5 3.06L12 16.09zM5 13.62v3.07l7 3.89 7-3.89v-3.07l-7 3.89-7-3.89z" />
                </svg>
              </div>
              <div>
                <h1 className="font-bold text-[#174778] text-[15px] leading-tight">Atelier</h1>
                <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">INTELLECTUAL SANCTUARY</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 py-2 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${item.active
                    ? "bg-[#F1F5F9] text-[#174778]"
                    : "text-gray-500 hover:bg-[#F1F5F9] hover:text-[#174778]"
                  }`}
              >
                <div className={`${item.active ? "text-[#174778]" : "text-gray-400"}`}>
                  {item.icon}
                </div>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="p-6 space-y-4">
            <button className="w-full bg-[#0052CC] hover:bg-[#0047b3] text-white py-2.5 rounded-md text-sm font-semibold transition shadow-sm flex items-center justify-center gap-2">
              <span>+</span> New Inquiry
            </button>

            <button onClick={handleSignOut} className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-medium px-2 py-2">
              <svg className="w-[18px] h-[18px] text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Support
            </button>
          </div>
        </aside>

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
                  className="flex-1 px-4 py-2 bg-[#174778] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-[#F5F7FA]">
          {children}
        </main>
      </div>
    </div>
  );
}
