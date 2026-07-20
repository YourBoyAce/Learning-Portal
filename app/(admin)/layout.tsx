"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import UserAvatar from "@/app/components/UserAvatar";
import Image from "next/image";
import { ICONS } from "@/app/styles/icons";
import { Button } from "@/components/ui/button";
import { PROFILE_UPDATED_EVENT } from "@/app/lib/profile-events";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

      if (profileError || profile?.role?.toLowerCase() !== "admin") {
        router.replace("/dashboard");
        return;
      }

      if (cancelled) return;
      setUserEmail(user.email ?? null);
      setFullName(profile.full_name ?? null);
      setLoading(false);
    };

    load();

    const onProfileUpdated = () => {
      void load();
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace("/login");
        }
      },
    );

    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
      listener.subscription.unsubscribe();
    };
  }, [router, pathname]);

  const displayName = fullName?.trim() || userEmail?.split("@")[0] || "User";

  if (loading) return null;

  const handleSignOut = async () => {
    setShowSignOutDialog(true);
  };

  const confirmSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const navItems = [
    {
      label: "Dashboard",
      href: "/admin",
      active: pathname === "/admin",
      icon: pathname === "/admin"
        ? ICONS.DASHBOARDLIGHT
        : ICONS.DASHBOARD,
    },

    {
      label: "Manage Courses",
      href: "/admin/courses",
      active: pathname.startsWith("/admin/courses"),
      icon: pathname.startsWith("/admin/courses")
        ? ICONS.BOOKLIGHT
        : ICONS.BOOK,
    },

    {
      label: "Manage Batches",
      href: "/admin/batches",
      active: pathname === "/admin/batches",
      icon: pathname === "/admin/batches"
        ? ICONS.BATCHLIGHT
        : ICONS.BATCH,
    },

    {
      label: "Upload Video",
      href: "/admin/upload",
      active: pathname === "/admin/upload",
      icon: pathname === "/admin/upload"
        ? ICONS.ARROWLIGHT
        : ICONS.ARROW,
    },

    {
      label: "Manage Users",
      href: "/admin/users",
      active: pathname === "/admin/users",
      icon: pathname === "/admin/users"
        ? ICONS.USERSLIGHT
        : ICONS.USERS,
    },

    {
      label: "Manage Webinars",
      href: "/admin/webinars",
      active: pathname === "/admin/webinars",
      icon: pathname === "/admin/webinars"
        ? ICONS.GLOBELIGHT
        : ICONS.GLOBE,
    },

    {
      label: "Quiz Management",
      href: "/admin/quizzes",
      active: pathname === "/admin/quizzes",
      icon: pathname === "/admin/quizzes"
        ? ICONS.BULBLIGHT
        : ICONS.BULB,
    },

    {
      label: "Artifacts Management",
      href: "/admin/artifacts",
      active: pathname === "/admin/artifacts",
      icon: pathname === "/admin/artifacts"
        ? ICONS.MATERIALLIGHT
        : ICONS.MATERIAL,
    },
    {
      label: "Communities Management",
      href: "/admin/communities",
      active: pathname === "/admin/communities",
      icon: pathname === "/admin/communities"
        ? ICONS.COMMUNITIESLIGHT
        : ICONS.COMMUNITIES,
    }
  ];
  return (
    <div className="admin-typography flex h-screen bg-surface-page overflow-hidden">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] shrink-0 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out lg:static lg:w-64 lg:max-w-none lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="p-5 sm:p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="Auto-Mate" width={160} height={48} className="object-contain" />
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="ml-auto rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
              aria-label="Close admin navigation"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item flex items-center gap-3 px-4 py-3 ${item.active
                  ? "nav-item-active"
                  : "nav-item-inactive"
                }`}
            >
              <Image
                src={item.icon}
                alt={item.label}
                width={20}
                height={20}
              />

              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-3">
          <Link href="/admin/profile">
            <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
              <UserAvatar
                name={fullName}
                email={userEmail}
                size={40}
                textSize="text-sm"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {displayName}
                </p>
                <p className="text-xs text-gray-500 truncate">{userEmail}</p>
              </div>
            </div>
          </Link>

          <Button
            type="button"
            className="w-full justify-center"
            onClick={handleSignOut}

          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign Out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Open admin navigation"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Image src="/logo.svg" alt="Auto-Mate" width={130} height={40} className="object-contain" />
          <UserAvatar
            name={fullName}
            email={userEmail}
            size={40}
            textSize="text-sm"
          />
        </header>

        {showSignOutDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Sign Out
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to sign out of your account?
              </p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  onClick={() => setShowSignOutDialog(false)}
                  className="w-full justify-center sm:w-1/2"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmSignOut}
                  className="w-full justify-center sm:w-1/2"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
