"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { maskPhoneNumber } from "@/app/lib/phone-verification";
import { consumePhoneVerification } from "@/app/lib/phone-verification-db";
import {
  createAdmin2FAChallenge,
  createRememberDevice,
  getRememberTokenFromCookie,
  validateRememberDevice,
  verifyAdmin2FAChallenge,
  verifyAdminCredentials,
} from "@/app/lib/admin-2fa";

export async function prepareAdminVerification(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return { success: false, error: "Please enter both email and password." };
  }

  try {
    const credentials = await verifyAdminCredentials(normalizedEmail, password);

    if (!credentials.ok) {
      return { success: false, error: credentials.error };
    }

    const rememberToken = await getRememberTokenFromCookie();
    const isTrustedDevice = await validateRememberDevice(
      credentials.userId,
      rememberToken,
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone, phone_verified")
      .eq("id", credentials.userId)
      .maybeSingle();

    const savedPhone = profile?.phone?.trim() || "";

    if (isTrustedDevice) {
      return {
        success: true,
        requires2FA: false,
        maskedEmail: maskEmail(credentials.email),
        savedPhone,
        maskedPhone: savedPhone ? maskPhoneNumber(savedPhone) : undefined,
      };
    }

    return {
      success: true,
      requires2FA: true,
      maskedEmail: maskEmail(credentials.email),
      savedPhone,
      maskedPhone: savedPhone ? maskPhoneNumber(savedPhone) : undefined,
    };
  } catch (error) {
    console.error("Admin verification preparation failed:", error);
    return {
      success: false,
      error: "Unable to start admin verification. Please try again.",
    };
  }
}

export async function sendAdminEmailOTP(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return { success: false, error: "Please enter both email and password." };
  }

  try {
    const credentials = await verifyAdminCredentials(normalizedEmail, password);

    if (!credentials.ok) {
      return { success: false, error: credentials.error };
    }

    const challenge = await createAdmin2FAChallenge(
      credentials.userId,
      credentials.email,
    );

    return {
      success: true,
      challengeToken: challenge.challengeToken,
      maskedEmail: maskEmail(credentials.email),
    };
  } catch (error) {
    console.error("Admin email OTP failed:", error);
    return {
      success: false,
      error: "Unable to send verification code. Please try again.",
    };
  }
}

export async function initiateAdmin2FA(email: string, password: string) {
  const prepared = await prepareAdminVerification(email, password);

  if (!prepared.success) {
    return prepared;
  }

  if (!prepared.requires2FA) {
    return prepared;
  }

  return sendAdminEmailOTP(email, password);
}

export async function verifyAdmin2FA(
  challengeToken: string,
  code: string,
  rememberMe = false,
) {
  if (!challengeToken || !code.trim()) {
    return { success: false, error: "Please enter the verification code." };
  }

  try {
    const result = await verifyAdmin2FAChallenge(challengeToken, code);

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    if (rememberMe) {
      await createRememberDevice(result.userId);
    }

    return { success: true };
  } catch (error) {
    console.error("Admin 2FA verification failed:", error);
    return {
      success: false,
      error: "Unable to verify code. Please try again.",
    };
  }
}

export async function verifyAdminPhone2FA(
  email: string,
  password: string,
  phoneNumber: string,
  userEnteredCode: string,
  rememberMe = false,
) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return { success: false, error: "Please enter both email and password." };
  }

  if (!/^\d{6}$/.test(userEnteredCode.trim())) {
    return { success: false, error: "Enter the 6-digit verification code." };
  }

  try {
    const credentials = await verifyAdminCredentials(normalizedEmail, password);

    if (!credentials.ok) {
      return { success: false, error: credentials.error };
    }

    const otpResult = await consumePhoneVerification(phoneNumber, userEnteredCode);

    if (!otpResult.ok) {
      return { success: false, error: otpResult.error };
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        phone: otpResult.phone,
        phone_verified: true,
      })
      .eq("id", credentials.userId);

    if (rememberMe) {
      await createRememberDevice(credentials.userId);
    }

    return { success: true };
  } catch (error) {
    console.error("Admin phone 2FA verification failed:", error);
    return {
      success: false,
      error: "Unable to verify code. Please try again.",
    };
  }
}

export async function resendAdmin2FA(email: string, password: string) {
  return sendAdminEmailOTP(email, password);
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;

  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(localPart.length - visible.length, 3))}@${domain}`;
}
