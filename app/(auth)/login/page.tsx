// "use client";

// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { supabase } from "@/app/lib/supabase";

// export default function LoginPage() {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [rememberMe, setRememberMe] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const router = useRouter();

//   // Helper function to securely route based on database role
//   const routeUserBasedOnRole = async (userId: string) => {
//     const { data: profile, error } = await supabase
//       .from("profiles")
//       .select("role")
//       .eq("id", userId)
//       .single();

//     // Log error for debugging
//     if (error) {
//       console.error("Profile fetch error:", error);
//     }

//     if (error || !profile) {
//       setError("Invalid credentials. Please contact an administrator to create your account.");
//       setLoading(false);
//       return;
//     }

//     if (profile.role === "admin") {
//       router.push("/admin/courses");
//     } else {
//       router.push("/dashboard");
//     }
//   };

//   const handleLogin = async () => {
//     if (!email || !password) {
//       setError("Please enter both email and password.");

//       return;
//     }

//     setLoading(true);
//     setError("");

//     const { data, error: authError } = await supabase.auth.signInWithPassword({
//       email,
//       password,
//     });

//     if (authError) {
//       setError(authError.message);
//       setLoading(false);
//       return;
//     }

//     if (data.user) {
//       // Force Next.js to read the new SSR cookies before navigating
//       router.refresh();
//       await routeUserBasedOnRole(data.user.id);
//     }
//   };

//   return (
//     <div className="h-screen bg-[#F5F7FA] flex flex-col items-center justify-center">

//       {/* HEADER */}
//       <div className="text-center mb-4 shrink-0">
//         <div className="w-12 h-12 mx-auto bg-[#174778] rounded-lg flex items-center justify-center text-white shadow-lg">
//           <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
//             <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 13.09l-5.5-3.03L12 10l5.5 3.06L12 16.09zM5 13.62v3.07l7 3.89 7-3.89v-3.07l-7 3.89-7-3.89z" />
//           </svg>
//         </div>
//         <h1 className="text-2xl font-semibold mt-3 text-[#174778]">
//           Academic The Automate
//         </h1>
//         <p className="text-sm text-gray-500">
//           Intellectual Sanctuary
//         </p>
//       </div>

//       {/* MAIN CONTAINER */}
//       <div className="w-full max-w-md mx-auto shrink-0">

//         {/* LOGIN CARD */}
//         <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">

//           <h2 className="text-base font-semibold text-gray-800">
//             Welcome Back
//           </h2>
//           <p className="text-xs text-gray-500 mt-1 mb-3">
//             Please enter your credentials to continue your journey.
//           </p>

//           {/* EMAIL */}
//           <label className="text-[11px] font-semibold text-gray-500 tracking-wide">
//             EMAIL ADDRESS
//           </label>
//           <div className="flex items-center bg-[#F0F2F5] border border-gray-200 rounded-md px-3 mt-1">
//             <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
//             </svg>
//             <input
//               type="email"
//               placeholder="scholar@theautomate.edu"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               onKeyDown={(e) => e.key === "Enter" && handleLogin()}
//               className="w-full bg-transparent p-2 text-sm outline-none text-gray-600 placeholder-gray-400"
//             />
//           </div>

//           {/* PASSWORD */}
//           <label className="text-[11px] font-semibold text-gray-500 tracking-wide block mt-3">
//             PASSWORD
//           </label>
//           <div className="flex items-center bg-[#F0F2F5] border border-gray-200 rounded-md px-3 mt-1">
//             <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
//             </svg>
//             <input
//               type="password"
//               placeholder="••••••••"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               onKeyDown={(e) => e.key === "Enter" && handleLogin()}
//               className="w-full bg-transparent p-2 text-sm outline-none text-gray-600"
//             />
//           </div>

//           {/* REMEMBER */}
//           <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
//             <input
//               type="checkbox"
//               id="remember"
//               checked={rememberMe}
//               onChange={(e) => setRememberMe(e.target.checked)}
//               className="w-4 h-4 border border-gray-300 rounded bg-white cursor-pointer"
//             />
//             <label htmlFor="remember" className="cursor-pointer">Remember Me</label>
//           </div>

//           {/* ERROR */}
//           {error && (
//             <div className="bg-red-50 border-l-2 border-red-500 p-2 mt-3">
//               <p className="text-red-700 text-xs">{error}</p>
//             </div>
//           )}

//           {/* BUTTON */}
//           <button
//             onClick={handleLogin}
//             disabled={loading}
//             className="w-full bg-[#174778] text-white py-2 rounded-md mt-3 text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-70"
//           >
//             {loading ? "Signing in..." : (
//               <>
//                 Sign In
//                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
//                 </svg>
//               </>
//             )}
//           </button>

//         </div>
//       </div>

//       {/* RIGHT SIDE - FACTS CARD (positioned at screen edge) */}
//       <div className="hidden xl:block fixed right-8 top-1/2 -translate-y-1/2 w-64">
//         {/* INFO CARD */}
//         <div className="bg-[#F5F0EB] border-l-4 border-[#8B4513] p-4 rounded-r-md shadow-sm">
//           <div className="w-6 h-6 mb-2">
//             <svg className="w-5 h-5 text-[#8B4513]" fill="currentColor" viewBox="0 0 24 24">
//               <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm-1 14h2v-1h-2v1zm-2-3h6v-1H9v1z" />
//             </svg>
//           </div>
//           <h3 className="font-semibold text-xs text-gray-800 mb-1">
//             Did you know?
//           </h3>
//           <p className="text-xs text-gray-600 leading-relaxed">
//             Students who review their curriculum at least three times a week
//             demonstrate 40% higher retention of abstract concepts.
//           </p>
//         </div>
//       </div>

//       {/* ENROLLMENT LINK */}
//       <div className="text-sm text-gray-500 mt-4 shrink-0">
//         New to the Sanctuary? <span className="text-[#174778] font-semibold cursor-pointer">Request Enrollment</span>
//       </div>
//     </div>
//   );
// }


"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button"; // Shadcn button
import { Input } from "@/components/Input";   // Reusable form input

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  // Helper function to securely route based on database role
  const routeUserBasedOnRole = async (userId: string) => {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Profile fetch error:", error);
    }

    if (error || !profile) {
      setError("Invalid credentials. Please contact an administrator to create your account.");
      setLoading(false);
      return;
    }

    if (profile.role === "admin") {
      router.push("/admin/courses");
    } else {
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
      return;
    }

    if (data.user) {
      // Force Next.js to read the new SSR cookies before navigating
      router.refresh();
      await routeUserBasedOnRole(data.user.id);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center relative">

      {/* HEADER */}
      <div className="text-center mb-6 shrink-0">
        <div className="relative w-14 h-14 mx-auto mb-3 bg-[#174778] rounded-xl flex items-center justify-center shadow-lg p-3">
          {/* Using Next Image for the scholar logo */}
          <Image
            src="/icons/scholar.svg"
            alt="Scholar Logo"
            fill
            className="object-contain p-2"
            priority
          />
        </div>
        <h1 className="text-xl font-medium mt-3 text-[#174778] tracking-wide uppercase">
          ACADEMIC THE AUTOMATE
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Intellectual Sanctuary
        </p>
      </div>

      {/* MAIN CONTAINER */}
      <div className="w-full max-w-[420px] mx-auto shrink-0 px-4 sm:px-0">

        {/* LOGIN CARD */}
        <div className="bg-white border border-gray-200 p-8 rounded-xl shadow-sm">

          <h2 className="text-lg font-bold text-gray-800 tracking-tight">
            Welcome Back
          </h2>
          <p className="text-xs text-gray-500 mt-1 mb-6">
            Please enter your credentials to continue your journey.
          </p>

          {/* GLOBAL ERROR */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-5 rounded-r-md">
              <p className="text-red-700 text-xs font-medium">{error}</p>
            </div>
          )}

          {/* REUSABLE FORM INPUTS */}
          <div className="space-y-2">
            <Input
              label="EMAIL ADDRESS"
              type="email"
              placeholder="scholar@theautomate.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />

            <Input
              label="PASSWORD"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              rightElement={
                <span className="text-[11px] text-[#174778] cursor-pointer font-medium hover:underline">
                  Forgot?
                </span>
              }
            />
          </div>

          {/* REMEMBER ME */}
          <div className="flex items-center gap-2 mt-2 mb-6">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 border border-gray-300 rounded bg-white cursor-pointer accent-[#174778]"
            />
            <label htmlFor="remember" className="text-xs text-gray-600 cursor-pointer select-none">
              Stay signed in for 30 days
            </label>
          </div>

          {/* SHADCN BUTTON */}
          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-[#174778] hover:bg-[#174778]/90 text-white py-6 rounded-md text-sm font-medium transition-all shadow-sm"
          >
            {loading ? "Signing in..." : (
              <span className="flex items-center justify-center gap-2">
                Sign In <span className="text-lg leading-none">&rarr;</span>
              </span>
            )}
          </Button>

          {/* DIVIDER */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] font-semibold text-gray-400 tracking-wider">
              OR CONTINUE WITH
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* SOCIAL BUTTONS */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="w-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-2 h-10 shadow-sm"
            >
              <Image src="/icons/google.svg" alt="Google" width={16} height={16} />
              <span className="text-xs text-gray-700 font-medium">Google</span>
            </Button>

            <Button
              variant="outline"
              className="w-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-2 h-10 shadow-sm"
            >
              <Image src="/icons/passkey.svg" alt="Passkey" width={16} height={16} />
              <span className="text-xs text-gray-700 font-medium">Passkey</span>
            </Button>
          </div>

        </div>

        {/* ENROLLMENT LINK */}
        <div className="text-center text-xs text-gray-500 mt-8 shrink-0">
          New to the Sanctuary? <span className="text-[#174778] font-bold cursor-pointer hover:underline">Request Enrollment</span>
        </div>

        {/* FOOTER LINKS */}
        <div className="flex justify-center items-center gap-4 mt-8 text-[10px] font-semibold text-[#A0AEC0] tracking-widest uppercase">
          <span className="cursor-pointer hover:text-gray-600">Privacy Policy</span>
          <span>•</span>
          <span className="cursor-pointer hover:text-gray-600">Academic Ethics</span>
          <span>•</span>
          <span className="cursor-pointer hover:text-gray-600">Support</span>
        </div>
      </div>

      {/* RIGHT SIDE - FACTS CARD & IMAGE (positioned at screen edge) */}
      <div className="hidden xl:flex flex-col gap-4 fixed right-8 top-1/2 -translate-y-1/2 w-64 z-10">

        {/* INFO CARD */}
        <div className="bg-white p-6 shadow-sm flex flex-col gap-1 border border-gray-100">
          <div className="w-6 h-6 mb-2">
            <Image src="/icons/bulb.svg" alt="Did you know?" width={20} height={20} />
          </div>
          <h3 className="font-medium text-sm text-[#174778]">
            Did you know?
          </h3>
          <p className="text-[11px] text-[#A0AEC0] leading-relaxed mt-1">
            Students who review their curriculum at least three times a week
            demonstrate 40% higher retention of abstract concepts.
          </p>
        </div>

        {/* IMAGE BENEATH IT */}
        <div className="relative w-full h-48 rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-white">
          <Image
            src="/images/login-illustration.png" // Update this path to match the image you want here!
            alt="Study Illustration"
            fill
            className="object-cover"
          />
        </div>

      </div>
    </div>
  );
}