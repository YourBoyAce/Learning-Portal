"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const navItems = [
    { icon: "📊", label: "Dashboard", href: "/dashboard", active: true },
    { icon: "📚", label: "My Learning", href: "/courses" },
    { icon: "✅", label: "Completed Courses", href: "/completed" },
    { icon: "📈", label: "Analytics", href: "/analytics" },
    { icon: "📅", label: "Calendar", href: "/calendar" },
    { icon: "👥", label: "Community", href: "/community" },
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
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    item.active
                      ? "bg-[#174778] text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            <span>🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-end">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">{userEmail?.split("@")[0]}</p>
              <p className="text-xs text-gray-400">{userEmail}</p>
            </div>
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-lg">👤</span>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
