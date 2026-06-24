"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { maskPhoneNumber } from "@/app/lib/phone-verification";
import { sendFreeOTP } from "@/app/actions/phone-verification";
import {
  resendAdmin2FA,
  sendAdminEmailOTP,
  verifyAdmin2FA,
  verifyAdminPhone2FA,
} from "@/app/actions/admin-2fa";

type VerificationMethod = "email" | "phone";

type AdminVerificationModalProps = {
  method: VerificationMethod;
  email: string;
  password: string;
  maskedEmail?: string;
  savedPhone?: string;
  useStoredPhoneOnly?: boolean;
  onClose: () => void;
  onVerified: (rememberMe: boolean) => void;
};

export default function AdminVerificationModal({
  method,
  email,
  password,
  maskedEmail,
  savedPhone = "",
  useStoredPhoneOnly = false,
  onClose,
  onVerified,
}: AdminVerificationModalProps) {
  const storedPhone = savedPhone.trim();
  const loginPhoneFlow = useStoredPhoneOnly && Boolean(storedPhone);

  const [otpCode, setOtpCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(storedPhone);
  const [activePhoneNumber, setActivePhoneNumber] = useState("");
  const [maskedPhone, setMaskedPhone] = useState(
    storedPhone ? maskPhoneNumber(storedPhone) : "",
  );
  const [challengeToken, setChallengeToken] = useState("");
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">(
    loginPhoneFlow ? "otp" : "phone",
  );
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [queueNotice, setQueueNotice] = useState("");
  const initialAutoSendDone = useRef(false);

  useEffect(() => {
    if (method !== "email") {
      return;
    }

    const sendEmailCode = async () => {
      setLoading(true);
      setError("");

      const result = await sendAdminEmailOTP(email, password);

      if (!result.success || !result.challengeToken) {
        setError(result.error || "Unable to send email verification code.");
        setLoading(false);
        return;
      }

      setChallengeToken(result.challengeToken);
      setLoading(false);
    };

    void sendEmailCode();
  }, [method, email, password]);

  useEffect(() => {
    if (method !== "phone" || !loginPhoneFlow || initialAutoSendDone.current) {
      return;
    }

    initialAutoSendDone.current = true;

    const sendInitialCode = async () => {
      setLoading(true);
      setError("");

      const result = await sendFreeOTP(storedPhone);

      if (!result.success) {
        setError(result.error || "Unable to send phone verification code.");
        setLoading(false);
        return;
      }

      setActivePhoneNumber(storedPhone);
      setMaskedPhone(result.maskedPhone || maskPhoneNumber(storedPhone));
      setQueueNotice(
        result.queueMessage ||
          "Verification code sent to your registered admin phone number.",
      );
      setPhoneStep("otp");
      setLoading(false);
    };

    void sendInitialCode();
  }, [method, loginPhoneFlow, storedPhone]);

  const sendPhoneCode = async (targetPhone: string) => {
    const trimmedPhone = targetPhone.trim();

    if (!trimmedPhone) {
      setError("Enter a phone number before requesting a code.");
      return;
    }

    setLoading(true);
    setError("");
    setQueueNotice("");

    const result = await sendFreeOTP(trimmedPhone);

    if (!result.success) {
      setError(result.error || "Unable to send verification code.");
      setLoading(false);
      return;
    }

    setPhoneNumber(trimmedPhone);
    setActivePhoneNumber(trimmedPhone);
    setMaskedPhone(result.maskedPhone || maskPhoneNumber(trimmedPhone));
    setQueueNotice(
      result.queueMessage ||
        "Verification code sent to your registered admin phone number.",
    );
    setPhoneStep("otp");
    setOtpCode("");
    setLoading(false);
  };

  const handleSendPhoneCode = async () => {
    await sendPhoneCode(phoneNumber);
  };

  const handleVerifyEmail = async () => {
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

    onVerified(rememberMe);
  };

  const handleVerifyPhone = async () => {
    if (!otpCode.trim()) {
      setError("Please enter the verification code sent to your phone.");
      return;
    }

    if (!activePhoneNumber) {
      setError("Request a new verification code for your phone number.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const result = await verifyAdminPhone2FA(
      email,
      password,
      activePhoneNumber,
      otpCode,
      rememberMe,
    );

    if (!result.success) {
      setError(result.error || "Invalid verification code.");
      setLoading(false);
      return;
    }

    onVerified(rememberMe);
  };

  const handleResendEmail = async () => {
    setLoading(true);
    setError("");

    const result = await resendAdmin2FA(email, password);

    if (!result.success || !result.challengeToken) {
      setError(result.error || "Unable to resend verification code.");
      setLoading(false);
      return;
    }

    setChallengeToken(result.challengeToken);
    setOtpCode("");
    setError("");
    setLoading(false);
  };

  const title =
    method === "email" ? "Verify with Email" : "Verify with Phone Number";

  const subtitle =
    method === "email"
      ? `Enter the 6-digit code sent to ${maskedEmail || "your email"}.`
      : loginPhoneFlow
        ? `Enter the 6-digit code sent to ${maskedPhone || "your registered phone"}.`
        : phoneStep === "phone"
          ? "Enter your mobile number to receive a verification code."
          : `Enter the 6-digit code sent to ${maskedPhone || activePhoneNumber}.`;

  const showPhoneInput =
    method === "phone" && !loginPhoneFlow && phoneStep === "phone";

  const showOtpForm =
    method === "email" ||
    (method === "phone" && (loginPhoneFlow || phoneStep === "otp"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              {method === "email" ? (
                <Mail className="h-5 w-5" />
              ) : (
                <Phone className="h-5 w-5" />
              )}
            </div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {method === "email" && !challengeToken && loading ? (
            <p className="text-sm text-gray-500">Sending verification code to your email...</p>
          ) : method === "phone" && loginPhoneFlow && loading && !activePhoneNumber ? (
            <p className="text-sm text-gray-500">
              Sending verification code to {maskedPhone || "your registered phone"}...
            </p>
          ) : showPhoneInput ? (
            <>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="9876543210"
                  className="mt-1 w-full rounded-md border border-gray-200 bg-[#F0F2F5] px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                />
                <p className="mt-2 text-[11px] text-gray-400">
                  Enter your mobile number as plain digits only, without + or spaces.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => void handleSendPhoneCode()}
                disabled={loading || !phoneNumber.trim()}
                className="w-full justify-center"
              >
                {loading ? "Sending..." : "Send Verification Code"}
              </Button>
            </>
          ) : showOtpForm ? (
            <>
              {loginPhoneFlow && maskedPhone && (
                <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3">
                  <p className="text-xs text-blue-900">
                    Code sent automatically to{" "}
                    <span className="font-semibold">{maskedPhone}</span>.
                  </p>
                </div>
              )}

              {queueNotice && !loginPhoneFlow && (
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                  <p className="text-xs leading-relaxed text-amber-900">{queueNotice}</p>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="mt-1 w-full rounded-md border border-gray-200 bg-[#F0F2F5] px-3 py-2.5 text-sm tracking-[0.3em] text-gray-700 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2">
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

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() =>
                    void (method === "email"
                      ? handleResendEmail()
                      : sendPhoneCode(activePhoneNumber || storedPhone || phoneNumber))
                  }
                  disabled={
                    loading ||
                    (method === "phone" &&
                      !activePhoneNumber &&
                      !storedPhone &&
                      !phoneNumber.trim())
                  }
                  className="text-xs text-[#2283FF] hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>

              <Button
                type="button"
                onClick={() =>
                  void (method === "email" ? handleVerifyEmail() : handleVerifyPhone())
                }
                disabled={loading || otpCode.length !== 6}
                className="w-full justify-center"
              >
                {loading ? "Verifying..." : "Verify & Sign In"}
              </Button>
            </>
          ) : null}

          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
              <p className="text-xs font-medium text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
