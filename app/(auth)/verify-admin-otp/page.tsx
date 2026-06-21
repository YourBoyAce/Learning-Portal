"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";

type OtpContext = {
  userId: string;
  email: string;
};

export default function VerifyAdminOtpPage() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [context, setContext] = useState<OtpContext | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadContext = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        let nextContext: OtpContext | null = null;
        const rawContext =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem("admin-otp-context")
            : null;

        if (rawContext) {
          const parsed = JSON.parse(rawContext) as {
            userId?: string;
            email?: string;
          };

          if (parsed.userId && parsed.email && parsed.userId === user.id) {
            nextContext = {
              userId: parsed.userId,
              email: parsed.email,
            };
          }
        }

        if (!nextContext) {
          nextContext = {
            userId: user.id,
            email: user.email || "",
          };
        }

        if (!nextContext.email) {
          setError("Unable to determine admin email for OTP verification.");
          return;
        }

        setContext(nextContext);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load OTP verification context.",
        );
      } finally {
        setInitializing(false);
      }
    };

    loadContext();
  }, [router]);

  const handleVerifyOtp = async () => {
    if (!context) return;
    if (otp.trim().length !== 6) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }

    setError("");
    setSuccess("");
    setVerifying(true);

    try {
      const response = await fetch("/api/auth/verify-admin-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: context.userId,
          otp: otp.trim(),
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error || "OTP verification failed. Please try again.");
        return;
      }

      setSuccess("OTP verified successfully. Redirecting...");
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!context) return;

    setError("");
    setSuccess("");
    setResending(true);

    try {
      const response = await fetch("/api/auth/send-admin-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: context.userId,
          email: context.email,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error || "Failed to resend OTP. Please try again.");
        return;
      }

      setSuccess("OTP sent successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-4 py-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
          <h2 className={TYPOGRAPHY_CLASSES.SUBHEADING}>Admin OTP Verification</h2>
          <p className="text-xs text-gray-500 mt-1 mb-5">
            Enter the 6-digit OTP sent to your admin email.
          </p>

          {context?.email && (
            <p className="text-xs text-brand-heading mb-3">
              Email: <span className="font-semibold">{context.email}</span>
            </p>
          )}

          <label className={TYPOGRAPHY_CLASSES.INNERHEADING}>ONE TIME PASSWORD</label>
          <input
            type="text"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="w-full mt-1 bg-[#F0F2F5] border border-gray-200 rounded-md px-3 py-2 text-sm outline-none text-gray-700 tracking-[0.2em]"
            placeholder="123456"
            disabled={initializing || verifying}
          />

          {error && (
            <div className="bg-red-50 border-l-2 border-red-500 p-2 mt-3">
              <p className="text-red-700 text-xs">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border-l-2 border-emerald-500 p-2 mt-3">
              <p className="text-emerald-700 text-xs">{success}</p>
            </div>
          )}

          <Button
            onClick={handleVerifyOtp}
            disabled={initializing || verifying || !context}
            className="w-full mt-6 justify-center"
          >
            {verifying ? "Verifying..." : "Verify OTP"}
          </Button>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={initializing || resending || !context}
            className="mt-4 text-xs font-semibold text-brand-primary hover:text-brand-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {resending ? "Resending OTP..." : "Resend OTP"}
          </button>
        </div>
      </div>
    </div>
  );
}

