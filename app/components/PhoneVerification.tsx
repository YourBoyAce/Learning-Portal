"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { sendFreeOTP, verifyFreeOTP } from "@/app/actions/phone-verification";
import { Button } from "@/components/ui/button";

type PhoneVerificationProps = {
  initialPhone?: string;
  initialVerified?: boolean;
  onVerified?: (phone: string) => void;
};

type Step = "phone" | "otp" | "success";

export default function PhoneVerification({
  initialPhone = "",
  initialVerified = false,
  onVerified,
}: PhoneVerificationProps) {
  const [step, setStep] = useState<Step>(initialVerified ? "success" : "phone");
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [otpCode, setOtpCode] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState(initialVerified ? initialPhone : "");

  const handleSendCode = async () => {
    setLoading(true);
    setError("");

    const result = await sendFreeOTP(phoneNumber);

    if (!result.success) {
      setError(result.error || "Unable to send verification code.");
      setLoading(false);
      return;
    }

    setMaskedPhone(result.maskedPhone || phoneNumber);
    setOtpCode("");
    setStep("otp");
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    setError("");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session?.access_token) {
      setError("You must be signed in to verify your phone.");
      setLoading(false);
      return;
    }

    const result = await verifyFreeOTP(
      phoneNumber,
      otpCode,
      sessionData.session.access_token,
    );

    if (!result.success) {
      setError(result.error || "Unable to verify code.");
      setLoading(false);
      return;
    }

    setVerifiedPhone(phoneNumber.trim());
    setStep("success");
    onVerified?.(phoneNumber.trim());
    setLoading(false);
  };

  const handleChangeNumber = () => {
    setStep("phone");
    setOtpCode("");
    setError("");
    setMaskedPhone("");
  };

  if (step === "success") {
    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-emerald-900">Phone verified</h4>
            <p className="mt-1 text-sm text-emerald-800">
              {verifiedPhone || phoneNumber} is linked to your account.
            </p>
            <button
              type="button"
              onClick={handleChangeNumber}
              className="mt-3 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
            >
              Change phone number
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h4 className="text-sm font-bold text-brand-primary">Phone Verification</h4>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Verify your mobile number with a one-time code sent via SMS.
        </p>
      </div>

      {step === "phone" ? (
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="9876543210"
              className="w-full rounded-md border border-transparent bg-surface-subtle px-4 py-3.5 text-[13px] font-medium text-gray-800 transition-colors focus:border-brand-primary/30 focus:bg-white focus:outline-none"
            />
            <p className="mt-2 text-[11px] text-gray-400">
              Enter your mobile number as plain digits only, without + or spaces.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => void handleSendCode()}
            disabled={loading || !phoneNumber.trim()}
            className="w-full justify-center sm:w-auto"
          >
            {loading ? "Sending..." : "Send Verification Code"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3">
            <p className="text-xs text-blue-900">
              Enter the 6-digit code sent to{" "}
              <span className="font-semibold">{maskedPhone || phoneNumber}</span>.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Verification Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="w-full rounded-md border border-transparent bg-surface-subtle px-4 py-3.5 text-[13px] font-medium tracking-[0.35em] text-gray-800 transition-colors focus:border-brand-primary/30 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={() => void handleVerifyCode()}
              disabled={loading || otpCode.length !== 6}
              className="w-full justify-center sm:w-auto"
            >
              {loading ? "Verifying..." : "Verify Code"}
            </Button>

            <button
              type="button"
              onClick={() => void handleSendCode()}
              disabled={loading}
              className="text-xs font-semibold text-brand-primary hover:underline disabled:opacity-50"
            >
              Resend code
            </button>

            <button
              type="button"
              onClick={handleChangeNumber}
              disabled={loading}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              Change number
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
          <p className="text-xs font-medium text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
