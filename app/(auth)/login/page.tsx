"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { prepareAdminVerification } from "@/app/actions/admin-2fa";
import { getUserTier } from "@/app/actions/tier";
import AdminVerificationModal from "@/app/components/AdminVerificationModal";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/app/styles/icons";
import Image from "next/image";
import { Mail, Phone, Loader2, ShieldAlert, X } from "lucide-react";

type LoginStep = "credentials" | "chooseMethod";
type VerificationMethod = "email" | "phone";

const DEMO_PREMIUM_EMAILS = [
  "premium@gmail.com",
  "demouser@gmail.com",
  "user@example.com",
];

function LoginPageInner() {
  const searchParams = useSearchParams();
  const urlEmail = searchParams.get("email");
  // ?message= is set by the checkout flow for existing users (no auto-login)
  const urlMessage = searchParams.get("message");
  // ?newUser=true is set by the checkout flow for first-time buyers (triggers auto-login)
  const isNewUserFromCheckout = searchParams.get("newUser") === "true";

  const [email, setEmail] = useState(urlEmail ?? "");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [activeVerification, setActiveVerification] =
    useState<VerificationMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "warning";
  } | null>(
    // Immediately populate from ?message= query param if present (existing users)
    urlMessage ? { message: urlMessage, type: "info" } : null,
  );
  const [autoLoginInProgress, setAutoLoginInProgress] = useState(false);
  const autoLoginAttempted = useRef(false);

  const router = useRouter();

  // role and accessToken are already known at call sites — pass them in to avoid
  // redundant Supabase round-trips.
  const routeUserBasedOnRole = async (
    role: string,
    email: string,
    accessToken: string,
  ) => {
    const normalizedRole = role.toLowerCase();

    if (normalizedRole === "admin") {
      router.push("/admin");
      return;
    }

    if (normalizedRole === "instructor") {
      router.push("/mentor");
      return;
    }

    if (DEMO_PREMIUM_EMAILS.includes(email.trim().toLowerCase())) {
      router.push("/premium");
      return;
    }

    try {
      const tier = await getUserTier(accessToken);
      if (tier === "Premium") {
        router.push("/premium");
        return;
      }
    } catch (err) {
      console.error("Failed to fetch user tier during login:", err);
    }

    router.push("/dashboard");
  };

  const recordLogin = async (userId: string) => {
    await supabase.from("user_login_logs").insert({
      user_id: userId,
      logged_in_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      session_duration_seconds: 0,
    });
  };

  // Redirect already-logged-in users to their home route
  useEffect(() => {
    const checkExistingSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (!profile) return;

      await routeUserBasedOnRole(
        profile.role ?? "",
        session.user.email ?? "",
        session.access_token,
      );
    };
    void checkExistingSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Auto-login for brand-new users arriving from checkout (?email=...&newUser=true)
  // Existing users are redirected with ?message= instead and never hit this path.
  useEffect(() => {
    if (!urlEmail || !isNewUserFromCheckout || autoLoginAttempted.current)
      return;
    autoLoginAttempted.current = true;

    const attemptAutoLogin = async () => {
      setAutoLoginInProgress(true);

      try {
        const { data, error: authError } =
          await supabase.auth.signInWithPassword({
            email: urlEmail,
            password: "Welcome123!",
          });

        if (authError || !data.user) {
          // Auto-login failed (e.g., password was already changed) — fall back to manual
          setAutoLoginInProgress(false);
          setToast({
            message:
              "Your account is ready. Please enter your password to continue.",
            type: "info",
          });
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          setAutoLoginInProgress(false);
          setError("Account setup incomplete. Please contact support.");
          return;
        }

        // New users from checkout are never admin — skip admin 2FA path
        void recordLogin(data.user.id); // fire-and-forget — don't block routing

        if (typeof window !== "undefined") {
          // Prompt user to change default password on next visit
          sessionStorage.setItem("show_password_change_warning", "true");
        }

        router.refresh();
        await routeUserBasedOnRole(
          profile.role ?? "",
          data.user.email ?? "",
          data.session?.access_token ?? "",
        );
      } catch {
        setAutoLoginInProgress(false);
        setToast({
          message:
            "Your account is ready. Please enter your password to continue.",
          type: "info",
        });
      }
    };

    void attemptAutoLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlEmail, isNewUserFromCheckout]);

  const resetToCredentials = () => {
    setStep("credentials");
    setMaskedEmail("");
    setSavedPhone("");
    setActiveVerification(null);
    setError("");
  };

  const completeAdminSignIn = async () => {
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError(
        authError?.message || "Unable to complete sign in. Please try again.",
      );
      resetToCredentials();
      setLoading(false);
      return;
    }

    await recordLogin(data.user.id);
    router.refresh();
    await routeUserBasedOnRole(
      "admin",
      data.user.email ?? email,
      data.session?.access_token ?? "",
    );
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

    if (profile.role?.toLowerCase() !== "admin") {
      void recordLogin(data.user.id); // fire-and-forget — don't block routing
      router.refresh();
      await routeUserBasedOnRole(
        profile.role ?? "",
        data.user.email ?? email,
        data.session?.access_token ?? "",
      );
      return;
    }

    await supabase.auth.signOut();

    const result = await prepareAdminVerification(email, password);

    if (!result.success) {
      setError(result.error || "Unable to start admin verification.");
      setLoading(false);
      return;
    }

    if (!result.requires2FA) {
      await completeAdminSignIn();
      return;
    }

    setMaskedEmail(result.maskedEmail || email);
    setSavedPhone(result.savedPhone || "");
    setStep("chooseMethod");
    setLoading(false);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === "credentials") {
      void handleLogin();
    }
  };

  if (autoLoginInProgress) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center gap-6">
        <Image
          src="/logo.svg"
          alt="Auto-Mate"
          width={160}
          height={48}
          className="object-contain"
        />
        <div className="flex flex-col items-center gap-4 bg-white border border-gray-200 rounded-xl shadow-sm px-10 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#1682F1]" />
          <p className="text-sm font-medium text-gray-600">
            Setting up your workspace&hellip;
          </p>
          <p className="text-xs text-gray-400">
            Please wait while we log you in automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#F5F7FA] p-4 py-8 flex flex-col items-center justify-center">
        {toast && (
          <div
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md
              flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border
              animate-in slide-in-from-top-4 fade-in duration-300
              ${
                toast.type === "warning"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
          >
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium leading-snug flex-1">
              {toast.message}
            </p>
            <button
              onClick={() => setToast(null)}
              className="shrink-0 p-0.5 rounded hover:bg-black/5 transition"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="text-center mb-4 shrink-0 flex flex-col items-center">
          <Image
            src="/logo.svg"
            alt="Auto-Mate"
            width={160}
            height={48}
            className="object-contain"
          />
        </div>

        <div className="w-full max-w-md mx-auto shrink-0">
          <form
            className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm"
            onSubmit={handleSubmit}
          >
            {step === "credentials" ? (
              <>
                <h2 className="text-base font-semibold text-gray-800">
                  Welcome Back
                </h2>
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
                <h2 className="text-base font-semibold text-gray-800">
                  Verify Admin Login
                </h2>
                <p className="text-xs text-gray-500 mt-1 mb-4">
                  Your admin credentials are valid. Choose how you would like to
                  receive your verification code.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setActiveVerification("email")}
                    className="rounded-xl border border-gray-200 bg-[#F8FAFC] p-4 text-left transition hover:border-brand-primary hover:bg-brand-primary/5"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                      <Mail className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-gray-800">Email</p>
                    <p className="mt-1 text-xs text-gray-500 break-words">
                      Send a code to {maskedEmail || "your email"}.
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={!savedPhone}
                    onClick={() => {
                      if (!savedPhone) {
                        setError(
                          "No phone number is registered for this admin account. Contact an administrator.",
                        );
                        return;
                      }
                      setError("");
                      setActiveVerification("phone");
                    }}
                    className={`rounded-xl border border-gray-200 bg-[#F8FAFC] p-4 text-left transition ${
                      savedPhone
                        ? "hover:border-brand-primary hover:bg-brand-primary/5"
                        : "cursor-not-allowed opacity-50"
                    }`}
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                      <Phone className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-gray-800">
                      Phone Number
                    </p>
                    <p className="mt-1 text-xs text-gray-500 break-words">
                      {savedPhone
                        ? "Send a code automatically to your registered admin phone."
                        : "No admin phone on file. Ask an administrator to add one."}
                    </p>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={resetToCredentials}
                  className="mt-4 text-xs text-gray-500 hover:text-gray-700"
                >
                  Back to sign in
                </button>
              </>
            )}

            {error && (
              <div className="bg-red-50 border-l-2 border-red-500 p-2 mt-3">
                <p className="text-red-700 text-xs">{error}</p>
              </div>
            )}

            {step === "credentials" && (
              <Button
                type="submit"
                disabled={loading}
                className="w-full mt-6 justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in&hellip;
                  </>
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
            )}
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
              <Image
                src={ICONS.BULB}
                alt="Info"
                width={24}
                height={24}
                className="object-contain"
              />
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

      {activeVerification && (
        <AdminVerificationModal
          method={activeVerification}
          email={email}
          password={password}
          maskedEmail={maskedEmail}
          savedPhone={savedPhone}
          useStoredPhoneOnly={activeVerification === "phone"}
          onClose={() => setActiveVerification(null)}
          onVerified={() => {
            setActiveVerification(null);
            setLoading(true);
            void completeAdminSignIn();
          }}
        />
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center gap-6">
          <Image
            src="/logo.svg"
            alt="Auto-Mate"
            width={160}
            height={48}
            className="object-contain"
          />
          <Loader2 className="h-8 w-8 animate-spin text-[#1682F1]" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
