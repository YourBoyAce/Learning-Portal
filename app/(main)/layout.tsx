"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

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
    { label: "Dashboard", href: "/dashboard", active: pathname === "/dashboard" },
    { label: "My Learning", href: "/courses", active: pathname === "/courses" },
    { label: "Completed Courses", href: "/completed", active: pathname === "/completed" },
    { label: "Analytics", href: "/analytics", active: pathname === "/analytics" },
    { label: "Calendar", href: "/calendar", active: pathname === "/calendar" },
    { label: "Community", href: "/community", active: pathname === "/community" },
  ];

  return (
    <div className="flex h-screen bg-[#F5F7FA]">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#174778] rounded-lg flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 13.09l-5.5-3.03L12 10l5.5 3.06L12 16.09zM5 13.62v3.07l7 3.89 7-3.89v-3.07l-7 3.89-7-3.89z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-[#174778] text-sm">The Automate</h1>
              <p className="text-[10px] text-gray-400">INTELLECTUAL SANCTUARY</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
            Learning Path
          </p>
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`flex items-center px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                    item.active
                      ? "bg-[#174778] text-white"
                      : "text-gray-700 hover:bg-[#174778]/10 hover:text-[#174778]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-3">
          <Link href="/profile">
            <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
              <div className="w-10 h-10 bg-[#174778] rounded-full flex items-center justify-center shrink-0">
                <span className="text-white text-lg font-semibold">
                  {userEmail?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {userEmail?.split("@")[0]}
                </p>
                <p className="text-xs text-gray-500 truncate">{userEmail}</p>
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full bg-[#174778] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90"
          >
            Sign Out
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

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
