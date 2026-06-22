"use server";

import {
  createAdmin2FAChallenge,
  createRememberDevice,
  getRememberTokenFromCookie,
  validateRememberDevice,
  verifyAdmin2FAChallenge,
  verifyAdminCredentials,
} from "@/app/lib/admin-2fa";

export async function initiateAdmin2FA(email: string, password: string) {
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
      rememberToken
    );

    if (isTrustedDevice) {
      return {
        success: true,
        requires2FA: false,
        maskedEmail: maskEmail(credentials.email),
      };
    }

    const challenge = await createAdmin2FAChallenge(credentials.userId, credentials.email);

    return {
      success: true,
      requires2FA: true,
      challengeToken: challenge.challengeToken,
      maskedEmail: maskEmail(credentials.email),
    };
  } catch (error) {
    console.error("Admin 2FA initiation failed:", error);
    return {
      success: false,
      error: "Unable to send verification code. Please try again.",
    };
  }
}

export async function verifyAdmin2FA(
  challengeToken: string,
  code: string,
  rememberMe = false
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

export async function resendAdmin2FA(email: string, password: string) {
  return initiateAdmin2FA(email, password);
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;

  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(localPart.length - visible.length, 3))}@${domain}`;
}
