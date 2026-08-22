"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { Logo } from "@/app/components/Logo";
import UserAvatar from "@/app/components/UserAvatar";
import Image from "next/image";
import {ICONS} from "@/app/styles/icons";
import {Button} from "@/components/ui/button";
import { PROFILE_UPDATED_EVENT } from "@/app/lib/profile-events";
import MentionNotificationsBell from "@/app/components/MentionNotificationsBell";

function MainLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab");
  
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Close sidebar on path change
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

      if (cancelled) return;
      setUserEmail(user.email ?? null);
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      setFullName(profile?.full_name?.trim() || null);
      setRole(profile?.role || null);
      
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

  const displayName = fullName || userEmail?.split("@")[0] || "User";

  // Session heartbeat
  useEffect(() => {
    if (loading || !userEmail) return;

    const sessionStart = Date.now();

    const heartbeat = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const elapsedSeconds = Math.floor((Date.now() - sessionStart) / 1000);

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
    }, 60000);

    return () => clearInterval(heartbeat);
  }, [loading, userEmail]);

  if (loading) return null;

  const handleSignOut = () => {
    setShowSignOutDialog(true);
  };

  const confirmSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const isMentor = role?.toLowerCase() === "instructor" || role?.toLowerCase() === "admin";

  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      active: pathname === "/dashboard",
      icon: pathname === "/dashboard"
        ? ICONS.DASHBOARDLIGHT
        : ICONS.DASHBOARD,
    },
  ];

  // Add student-only tabs if user is not a mentor
  if (!isMentor) {
    navItems.push(
      {
        label: "My Learning",
        href: "/courses",
        active: pathname === "/courses",
        icon: pathname === "/courses"
          ? ICONS.BOOKLIGHT
          : ICONS.BOOK,
      },
      {
        label: "Quizzes",
        href: "/practice?tab=quizzes",
        active: pathname === "/practice" && activeTab !== "artifacts",
        icon: pathname === "/practice" && activeTab !== "artifacts"
          ? ICONS.BULBLIGHT
          : ICONS.BULB,
      },
      {
        label: "Artifacts",
        href: "/practice?tab=artifacts",
        active: pathname === "/practice" && activeTab === "artifacts",
        icon: pathname === "/practice" && activeTab === "artifacts"
          ? ICONS.MATERIALLIGHT
          : ICONS.MATERIAL,
      },
      {
        label: "Live Webinars",
        href: "/webinars",
        active: pathname === "/webinars",
        icon: pathname === "/webinars" ? ICONS.GLOBELIGHT : ICONS.GLOBE,
      }
    );
  }

  // Communities is visible to everyone
  navItems.push({
    label: "Communities",
    href: "/communities",
    active: pathname === "/communities" || pathname.startsWith("/communities/"),
    icon: pathname === "/communities" || pathname.startsWith("/communities/")
      ? ICONS.COMMUNITIESLIGHT
      : ICONS.COMMUNITIES,
  });

  // Inbox is visible to everyone
  navItems.push({
    label: "Inbox",
    href: "/inbox",
    active: pathname === "/inbox",
    icon: pathname === "/inbox" ? ICONS.BATCHLIGHT : ICONS.BATCH,
  });

  // Mentor Planner is visible to everyone
  navItems.push({
    label: "Mentor Planner",
    href: "/mentor-planner",
    active: pathname === "/mentor-planner",
    icon: pathname === "/mentor-planner"
      ? ICONS.USERSLIGHT
      : ICONS.USERS,
  });

  // If user is admin or instructor, append the Mentor Dashboard page
  if (isMentor) {
    navItems.push({
      label: "Mentor Dashboard",
      href: "/mentor",
      active: pathname === "/mentor" || pathname.startsWith("/mentor/"),
      icon: ICONS.CALENDAR,
    });
    navItems.push({
      label: "Invites",
      href: "/invites",
      active: pathname === "/invites",
      icon: pathname === "/invites" ? ICONS.BATCHLIGHT : ICONS.BATCH,
    });
  }

  // Profile page always goes last
  navItems.push({
    label: "Profile",
    href: "/profile",
    active: pathname === "/profile",
    icon: pathname === "/profile"
      ? ICONS.PROFILELIGHT
      : ICONS.PROFILE,
  });

  return (
    <div className="flex flex-col h-screen bg-surface-subtle">
      <div className="flex flex-1 overflow-hidden relative">
        
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-surface-subtle border-r border-gray-200 flex flex-col shrink-0 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/logo.svg" alt="Auto-Mate" width={160} height={48} className="object-contain" />
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none lg:hidden transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 px-4 py-2 text-gray-500 flex flex-col gap-2">
            {navItems.map((item) => (
  <Link
  key={item.href}
  href={item.href}
  className={`nav-item flex items-center gap-3 px-4 py-3 ${
    item.active
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

          <div className="p-6 space-y-4">
            <Button onClick={handleSignOut} className="w-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sign Out
            </Button>

            <Button className="w-full">
              <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Support
            </Button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-h-0">
          <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between lg:justify-end">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Logo width={120} height={40} />
            </div>

            <div className="flex items-center gap-3">
              {isMentor && (
                <MentionNotificationsBell communitiesPath="/communities" />
              )}
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-700">
                  {displayName}
                </p>
                <p className="text-xs text-gray-400">{userEmail}</p>
              </div>
              <UserAvatar
                name={fullName}
                email={userEmail}
                size={40}
                textSize="text-sm"
              />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-surface-page">
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
              <Button
                onClick={() => setShowSignOutDialog(false)}
                className="w-1/2 justify-center"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmSignOut}
                className="w-1/2 justify-center"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <MainLayoutContent>{children}</MainLayoutContent>
    </Suspense>
  );
}