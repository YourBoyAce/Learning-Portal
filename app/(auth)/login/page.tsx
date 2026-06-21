"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import {Button} from "@/components/ui/button";
import {ICONS} from "@/app/styles/icons";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  useEffect(() => {
    // Rectify "Invalid Refresh Token" error by clearing stale sessions on mount
    const cleanupSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error?.message?.includes('Refresh Token Not Found') || error || !session) {
          // Clear invalid tokens from localStorage
          window.localStorage.removeItem('sb-rqeqcwlchxfboqtghkko-auth-token');
          window.localStorage.removeItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
          await supabase.auth.signOut();
        }
      } catch (err) {
        console.error('Session cleanup error:', err);
        await supabase.auth.signOut();
      }
    };
    cleanupSession();
  }, []);

  // Helper function to securely route based on database role
  const routeUserBasedOnRole = async (userId: string, userEmail: string) => {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role,password_updated")
      .eq("id", userId)
      .single();

    // Log error for debugging
    if (error) {
      console.error("Profile fetch error:", error);
    }

    if (error || !profile) {
      setError(
        "Invalid credentials. Please contact an administrator to create your account.",
      );
      setLoading(false);
      return;
    }

    if (profile.role?.toLowerCase() === "admin") {
      const response = await fetch("/api/auth/send-admin-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          email: userEmail,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error || "Failed to send admin OTP. Please try again.");
        setLoading(false);
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "admin-otp-context",
          JSON.stringify({
            userId,
            email: userEmail,
            createdAt: Date.now(),
          }),
        );
      }

      router.push("/verify-admin-otp");
    } else {
      if (profile.password_updated === false) {
        router.push("/update-password");
        return;
      }

      router.push("/dashboard");
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter both email and password.");

      return;
    }

    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }

    if (data.user) {
      // Record login event for admin analytics
      await supabase.from("user_login_logs").insert({
        user_id: data.user.id,
        logged_in_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
        session_duration_seconds: 0,
      });

      // Force Next.js to read the new SSR cookies before navigating
      router.refresh();
      await routeUserBasedOnRole(data.user.id, data.user.email || email);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-4 py-8 flex flex-col items-center justify-center">
      {/* HEADER */}
      <div className="text-center mb-4 shrink-0 flex flex-col items-center">
        <Image src="/logo.svg" alt="Auto-Mate" width={160} height={48} className="object-contain" />
      </div>

      {/* MAIN CONTAINER */}
      <div className="w-full max-w-md mx-auto shrink-0">
        {/* LOGIN CARD */}
        <form
          className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm"
          onSubmit={handleLogin}
        >
          <h2 className="text-base font-semibold text-gray-800">
            Welcome Back
          </h2>
          <p className="text-xs text-gray-500 mt-1 mb-3">
            Please enter your credentials to continue your journey.
          </p>

          {/* EMAIL */}
          <label className="text-[11px] font-semibold text-gray-500 tracking-wide">
            EMAIL ADDRESS
          </label>
          <div className="flex items-center bg-[#F0F2F5] border border-gray-200 rounded-md px-3 mt-1">
            <svg
              className="w-4 h-4 text-gray-400 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
              />
            </svg>
            <input
              type="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full bg-transparent p-2 text-sm outline-none text-gray-600 placeholder-gray-400"
            />
          </div>

          {/* PASSWORD */}
          <label className="text-[11px] font-semibold text-gray-500 tracking-wide block mt-3">
            PASSWORD
          </label>
          <div className="flex items-center bg-[#F0F2F5] border border-gray-200 rounded-md px-3 mt-1">
            <svg
              className="w-4 h-4 text-gray-400 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full bg-transparent p-2 text-sm outline-none text-gray-600"
            />
          </div>


          {/* ERROR */}
          {error && (
            <div className="bg-red-50 border-l-2 border-red-500 p-2 mt-3">
              <p className="text-red-700 text-xs">{error}</p>
            </div>
          )}

          {/* BUTTON */}
          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full mt-6 justify-center"
          >
            {loading ? (
              "Signing in..."
            ) : (
              <>
                Sign In
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
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </>
            )}
          </Button>
        </form>
      </div>

      {/* RIGHT SIDE - FACTS CARD (positioned at screen edge) */}
      <div className="hidden xl:block fixed right-8 top-1/2 -translate-y-1/2 w-64">
        {/* INFO CARD */}
        <div
  className="border-l-4 p-4 rounded-r-md shadow-sm"
  style={{
    backgroundColor: "rgba(22, 130, 241, 0.08)",
    borderLeftColor: "var(--color-accent)",
  }}
>
          <div className="w-6 h-6 mb-2">
            <Image src={ICONS.BULB} alt="Info" width={24} height={24} className="object-contain" />
              
            
          </div>
          <h3 className="font-semibold text-xs text-gray-800 mb-1">
            Did you know?
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Students who review their curriculum at least three times a week
            demonstrate 40% higher retention of abstract concepts.
          </p>
        </div>
      </div>
    </div>
  );
}
