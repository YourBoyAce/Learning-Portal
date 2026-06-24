"use server";

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatPhoneForSmsGateway, maskPhoneNumber, normalizePhoneNumber } from "@/app/lib/phone-verification";
import { consumePhoneVerification } from "@/app/lib/phone-verification-db";
import {
  buildTextBeeOtpMessage,
  getTextBeeSimSubscriptionId,
  parseTextBeeSendResponse,
} from "@/app/lib/textbee";

const OTP_EXPIRY_MINUTES = 5;

function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

async function getAuthenticatedUserId(accessToken: string) {
  if (!accessToken) {
    return { ok: false as const, error: "You must be signed in to verify your phone." };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return { ok: false as const, error: "Invalid session. Please sign in again." };
  }

  return { ok: true as const, userId: data.user.id };
}

export async function sendFreeOTP(phoneNumber: string) {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  if (!normalizedPhone) {
    return {
      success: false,
      error: "Enter a valid phone number using digits only (10-15 digits).",
    };
  }

  const deviceId = process.env.TEXTBEE_DEVICE_ID;
  const apiKey = process.env.TEXTBEE_API_KEY;

  if (!deviceId || !apiKey) {
    return {
      success: false,
      error: "SMS service is not configured. Contact your administrator.",
    };
  }

  const otpCode = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  try {
    await supabaseAdmin
      .from("phone_verifications")
      .delete()
      .eq("phone_number", normalizedPhone)
      .eq("verified", false);

    const { error: insertError } = await supabaseAdmin.from("phone_verifications").insert({
      phone_number: normalizedPhone,
      otp_code: otpCode,
      expires_at: expiresAt,
      verified: false,
    });

    if (insertError) {
      console.error("Failed to store phone verification:", insertError);
      return {
        success: false,
        error: "Unable to start phone verification. Please try again.",
      };
    }

    const smsRecipient = formatPhoneForSmsGateway(normalizedPhone);

    const smsMessage = buildTextBeeOtpMessage(otpCode, OTP_EXPIRY_MINUTES);

    const smsPayload: Record<string, unknown> = {
      recipients: [smsRecipient],
      message: smsMessage,
    };

    const simSubscriptionId = getTextBeeSimSubscriptionId();
    if (simSubscriptionId !== undefined) {
      smsPayload.simSubscriptionId = simSubscriptionId;
    } else if (process.env.TEXTBEE_SIM_SUBSCRIPTION_ID?.trim()) {
      console.warn(
        "TEXTBEE_SIM_SUBSCRIPTION_ID is set but invalid. Expected a number like 1 or 2. SMS will use the device default SIM.",
      );
    }

    const smsResponse = await fetch(
      `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(smsPayload),
      },
    );

    const smsBody = await smsResponse.text().catch(() => "");
    const providerResult = parseTextBeeSendResponse(smsResponse.status, smsBody);

    if (!providerResult.ok) {
      console.error("TextBee SMS failed:", {
        status: smsResponse.status,
        body: smsBody,
        phone: normalizedPhone,
      });

      await supabaseAdmin
        .from("phone_verifications")
        .delete()
        .eq("phone_number", normalizedPhone)
        .eq("otp_code", otpCode);

      return {
        success: false,
        error: providerResult.error,
      };
    }

    if (process.env.NODE_ENV === "development") {
      console.info("[DEV] OTP stored for testing:", {
        phone: normalizedPhone,
        otpCode,
        smsMessage,
        smsBatchId: providerResult.smsBatchId,
      });
    }

    console.info("TextBee SMS queued:", {
      phone: normalizedPhone,
      smsRecipient,
      smsMessage,
      simSubscriptionId: simSubscriptionId ?? "device default SIM",
      status: smsResponse.status,
      smsBatchId: providerResult.smsBatchId,
      queueMessage: providerResult.queueMessage,
    });

    return {
      success: true,
      maskedPhone: maskPhoneNumber(normalizedPhone),
      expiresAt,
      queued: true,
      queueMessage: providerResult.queueMessage,
      smsBatchId: providerResult.smsBatchId,
    };
  } catch (error) {
    console.error("sendFreeOTP failed:", error);
    return {
      success: false,
      error: "Unable to send verification code. Please try again.",
    };
  }
}

export async function verifyFreeOTP(
  phoneNumber: string,
  userEnteredCode: string,
  accessToken: string,
) {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const code = userEnteredCode.trim();

  if (!normalizedPhone) {
    return {
      success: false,
      error: "Enter a valid phone number using digits only (10-15 digits).",
    };
  }

  if (!/^\d{6}$/.test(code)) {
    return {
      success: false,
      error: "Enter the 6-digit verification code.",
    };
  }

  const auth = await getAuthenticatedUserId(accessToken);

  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const otpResult = await consumePhoneVerification(normalizedPhone, code);

    if (!otpResult.ok) {
      return { success: false, error: otpResult.error };
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        phone: otpResult.phone,
        phone_verified: true,
      })
      .eq("id", auth.userId);

    if (profileError) {
      console.error("Failed to update profile phone verification:", profileError);
      return {
        success: false,
        error: "Code verified, but profile update failed. Please contact support.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("verifyFreeOTP failed:", error);
    return {
      success: false,
      error: "Unable to verify code. Please try again.",
    };
  }
}
