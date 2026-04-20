"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  // Check if user already has a session
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.push("/dashboard");
      }
    };

    checkUser();
  }, [router]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          router.push("/dashboard");
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]);

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="h-screen bg-[#F5F7FA] flex flex-col items-center justify-center">

      {/* HEADER */}
      <div className="text-center mb-4 shrink-0">
        <div className="w-12 h-12 mx-auto bg-[#0B1E6D] rounded-lg flex items-center justify-center text-white shadow-lg">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 13.09l-5.5-3.03L12 10l5.5 3.06L12 16.09zM5 13.62v3.07l7 3.89 7-3.89v-3.07l-7 3.89-7-3.89z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold mt-3 text-[#0B1E6D]">
          Academic The Automate
        </h1>
        <p className="text-sm text-gray-500">
          Intellectual Sanctuary
        </p>
      </div>

      {/* MAIN CONTAINER */}
      <div className="w-full max-w-md mx-auto shrink-0">

        {/* LOGIN CARD */}
        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">

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
            <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
            <input
              type="email"
              placeholder="scholar@theautomate.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full bg-transparent p-2 text-sm outline-none text-gray-600 placeholder-gray-400"
            />
          </div>

          {/* PASSWORD */}
          <div className="flex justify-between items-center mt-3">
            <label className="text-[11px] font-semibold text-gray-500 tracking-wide">
              PASSWORD
            </label>
            <span className="text-[11px] text-[#0B1E6D] cursor-pointer font-medium">
              Forgot?
            </span>
          </div>

          <div className="flex items-center bg-[#F0F2F5] border border-gray-200 rounded-md px-3 mt-1">
            <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full bg-transparent p-2 text-sm outline-none text-gray-600"
            />
          </div>

          {/* REMEMBER */}
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
            <div className="w-4 h-4 border border-gray-300 rounded bg-white" />
            <span>Stay signed in for 30 days</span>
          </div>

          {/* ERROR */}
          {error && (
            <p className="text-red-500 text-xs mt-2">{error}</p>
          )}

          {/* BUTTON */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-[#0B1E6D] text-white py-2 rounded-md mt-3 text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? "Signing in..." : (
              <>
                Sign In
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>

          {/* DIVIDER */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] text-gray-400">
              OR CONTINUE WITH
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* SOCIAL */}
          <div className="grid grid-cols-2 gap-3">
            <button className="bg-[#F0F2F5] border border-gray-200 py-2 rounded-md text-sm flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
            <button className="bg-[#F0F2F5] py-2 rounded-md text-sm flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Passkey
            </button>
          </div>

        </div>
      </div>

      {/* RIGHT SIDE - FACTS CARD (positioned at screen edge) */}
      <div className="hidden xl:block fixed right-8 top-1/2 -translate-y-1/2 w-64">
        {/* INFO CARD */}
        <div className="bg-[#F5F0EB] border-l-4 border-[#8B4513] p-4 rounded-r-md shadow-sm">
          <div className="w-6 h-6 mb-2">
            <svg className="w-5 h-5 text-[#8B4513]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm-1 14h2v-1h-2v1zm-2-3h6v-1H9v1z" />
            </svg>
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

      {/* ENROLLMENT LINK */}
      <div className="text-sm text-gray-500 mt-4 shrink-0">
        New to the Sanctuary? <span className="text-[#0B1E6D] font-semibold cursor-pointer">Request Enrollment</span>
      </div>
    </div>
  );
}