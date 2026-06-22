"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { initiateAdmin2FA, resendAdmin2FA, verifyAdmin2FA } from "@/app/actions/admin-2fa";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/app/styles/icons";
import Image from "next/image";

type LoginStep = "credentials" | "2fa";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [challengeToken, setChallengeToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

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
      setError(
        "Invalid credentials. Please contact an administrator to create your account.",
      );
      setLoading(false);
      return;
    }

    if (profile.role?.toLowerCase() === "admin") {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
  };

  const recordLogin = async (userId: string) => {
    await supabase.from("user_login_logs").insert({
      user_id: userId,
      logged_in_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      session_duration_seconds: 0,
    });
  };

  useEffect(() => {
    const checkExistingSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await routeUserBasedOnRole(session.user.id);
      }
    };
    checkExistingSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetToCredentials = () => {
    setStep("credentials");
    setChallengeToken("");
    setMaskedEmail("");
    setOtpCode("");
    setRememberMe(false);
    setError("");
  };

  const completeAdminSignIn = async () => {
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError(authError?.message || "Unable to complete sign in. Please try again.");
      resetToCredentials();
      setLoading(false);
      return;
    }

    await recordLogin(data.user.id);
    router.refresh();
    await routeUserBasedOnRole(data.user.id);
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

    if (!data.user) {
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError(
        "Invalid credentials. Please contact an administrator to create your account.",
      );
      setLoading(false);
      return;
    }

    if (profile.role?.toLowerCase() === "admin") {
      await supabase.auth.signOut();

      const result = await initiateAdmin2FA(email, password);

      if (!result.success) {
        setError(result.error || "Unable to start admin verification.");
        setLoading(false);
        return;
      }

      if (!result.requires2FA) {
        await completeAdminSignIn();
        return;
      }

      if (!result.challengeToken) {
        setError("Unable to start admin verification.");
        setLoading(false);
        return;
      }

      setChallengeToken(result.challengeToken);
      setMaskedEmail(result.maskedEmail || email);
      setStep("2fa");
      setOtpCode("");
      setRememberMe(false);
      setLoading(false);
      return;
    }

    await recordLogin(data.user.id);
    router.refresh();
    await routeUserBasedOnRole(data.user.id);
  };

  const handleVerify2FA = async () => {
    if (!otpCode.trim()) {
      setError("Please enter the verification code sent to your email.");
      return;
    }

    setLoading(true);
    setError("");

    const result = await verifyAdmin2FA(challengeToken, otpCode, rememberMe);

    if (!result.success) {
      setError(result.error || "Invalid verification code.");
      setLoading(false);
      return;
    }

    await completeAdminSignIn();
  };

  const handleResendCode = async () => {
    setLoading(true);
    setError("");

    const result = await resendAdmin2FA(email, password);

    if (!result.success || !result.challengeToken) {
      setError(result.error || "Unable to resend verification code.");
      setLoading(false);
      return;
    }

    setChallengeToken(result.challengeToken);
    setMaskedEmail(result.maskedEmail || email);
    setOtpCode("");
    setError("");
    setLoading(false);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === "2fa") {
      void handleVerify2FA();
    } else {
      void handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-4 py-8 flex flex-col items-center justify-center">
      <div className="text-center mb-4 shrink-0 flex flex-col items-center">
        <Image src="/logo.svg" alt="Auto-Mate" width={160} height={48} className="object-contain" />
      </div>

      <div className="w-full max-w-md mx-auto shrink-0">
        <form
          className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm"
          onSubmit={handleSubmit}
        >
          {step === "credentials" ? (
            <>
              <h2 className="text-base font-semibold text-gray-800">Welcome Back</h2>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                Please enter your credentials to continue your journey.
              </p>

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
                  className="w-full bg-transparent p-2 text-sm outline-none text-gray-600 placeholder-gray-400"
                />
              </div>

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
                  className="w-full bg-transparent p-2 text-sm outline-none text-gray-600"
                />
              </div>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-gray-800">Verify Admin Login</h2>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                Enter the 6-digit code sent to {maskedEmail || "your email"}.
              </p>

              <label className="text-[11px] font-semibold text-gray-500 tracking-wide">
                VERIFICATION CODE
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
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full bg-transparent p-2 text-sm outline-none text-gray-600 tracking-[0.3em]"
                />
              </div>

              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#2283FF] focus:ring-[#2283FF]"
                />
                <span className="text-xs text-gray-600">
                  Remember this device for 30 days
                </span>
              </label>

              <div className="flex items-center justify-between mt-4">
                <button
                  type="button"
                  onClick={resetToCredentials}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Back to sign in
                </button>
                <button
                  type="button"
                  onClick={() => void handleResendCode()}
                  disabled={loading}
                  className="text-xs text-[#2283FF] hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border-l-2 border-red-500 p-2 mt-3">
              <p className="text-red-700 text-xs">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-6 justify-center"
          >
            {loading ? (
              step === "2fa" ? "Verifying..." : "Signing in..."
            ) : (
              <>
                {step === "2fa" ? "Verify & Sign In" : "Sign In"}
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

      <div className="hidden xl:block fixed right-8 top-1/2 -translate-y-1/2 w-64">
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
          <h3 className="font-semibold text-xs text-gray-800 mb-1">Did you know?</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Students who review their curriculum at least three times a week demonstrate 40% higher
            retention of abstract concepts.
          </p>
        </div>
      </div>
    </div>
  );
}
