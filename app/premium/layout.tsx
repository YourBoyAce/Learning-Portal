"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase, resolveUserName } from "@/app/lib/supabase";
import { Logo } from "@/app/components/Logo";
import UserAvatar from "@/app/components/UserAvatar";
import Image from "next/image";
import { ICONS } from "@/app/styles/icons";
import { Button } from "@/components/ui/button";
import { PROFILE_UPDATED_EVENT } from "@/app/lib/profile-events";
import { Video, Inbox, Calendar as CalendarIcon, LogOut } from "lucide-react";
import { useSecurityGatedData } from "@/app/hooks/useSecurityGatedData";

function PremiumLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { tier, isLoading: isTierLoading } = useSecurityGatedData();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Close sidebar on path change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isTierLoading) return;

    const enforcePremiumAccess = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      const role = profile?.role?.toLowerCase() ?? "";
      if (role === "admin") {
        router.replace("/admin");
        return;
      }
      if (role === "instructor") {
        router.replace("/mentor");
        return;
      }

      if (tier === null) {
        router.replace("/login");
        return;
      }

      if (tier !== "Premium") {
        router.replace("/dashboard");
      }
    };

    void enforcePremiumAccess();
  }, [isTierLoading, tier, router]);

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

      const resolvedName = await resolveUserName(supabase, user.id, user.email);
      setFullName(resolvedName);
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
  }, [router]);

  const displayName = fullName || userEmail?.split("@")[0] || "User";

  if (loading || isTierLoading) return null;

  const handleSignOut = () => {
    setShowSignOutDialog(true);
  };

  const confirmSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const navItems = [
    {
      label: "Live Sessions",
      href: "/premium/webinars",
      active: pathname === "/premium/webinars",
      icon: pathname === "/premium/webinars" ? ICONS.GLOBELIGHT : ICONS.GLOBE,
    },
    {
      label: "Inbox",
      href: "/premium/inbox",
      active: pathname === "/premium/inbox",
      icon: pathname === "/premium/inbox" ? ICONS.BATCHLIGHT : ICONS.BATCH,
    },
    {
      label: "Calendar",
      href: "/premium/calendar",
      active: pathname === "/premium/calendar",
      icon: ICONS.CALENDAR,
    },
  ];

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
          className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-surface-subtle border-r border-gray-200 flex flex-col shrink-0 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="p-6 flex items-center justify-between">
            <Link href="/premium" className="flex items-center gap-3">
              <Logo width={160} height={48} className="object-contain" />
            </Link>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none lg:hidden transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="px-6 mb-4">
            <div className="bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-md inline-block">
              Premium
            </div>
          </div>

          <nav className="flex-1 px-4 py-2 text-gray-500 flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item flex items-center gap-3 px-4 py-3 ${item.active ? "nav-item-active" : "nav-item-inactive"
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

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between lg:justify-end">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <Logo width={120} height={40} />
            </div>

            <div className="flex items-center gap-3">
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Sign Out
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to sign out of your account?
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowSignOutDialog(false)}
                className="w-1/2 justify-center"
                variant="outline"
              >
                Cancel
              </Button>
              <Button onClick={confirmSignOut} className="w-1/2 justify-center">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PremiumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <PremiumLayoutContent>{children}</PremiumLayoutContent>
    </Suspense>
  );
}
