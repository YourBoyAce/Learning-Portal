import crypto from "crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { transporter } from "@/app/lib/mailer";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const REMEMBER_ME_DAYS = 30;
const REMEMBER_COOKIE_NAME = "admin_remember_token";

export function hashRememberToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function getRememberTokenFromCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REMEMBER_COOKIE_NAME)?.value;
}

export async function setRememberCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REMEMBER_ME_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function clearRememberCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(REMEMBER_COOKIE_NAME);
}

export async function purgeExpiredRememberDevices(userId?: string) {
  const query = supabaseAdmin
    .from("admin_remember_devices")
    .delete()
    .lt("expires_at", new Date().toISOString());

  if (userId) {
    query.eq("user_id", userId);
  }

  await query;
}

export async function validateRememberDevice(userId: string, token?: string) {
  if (!token) {
    return false;
  }

  await purgeExpiredRememberDevices(userId);

  const { data: device, error } = await supabaseAdmin
    .from("admin_remember_devices")
    .select("id, token_hash, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !device) {
    return false;
  }

  if (new Date(device.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("admin_remember_devices").delete().eq("id", device.id);
    await clearRememberCookie();
    return false;
  }

  if (hashRememberToken(token) !== device.token_hash) {
    return false;
  }

  return true;
}

export async function createRememberDevice(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await supabaseAdmin.from("admin_remember_devices").delete().eq("user_id", userId);

  const { error } = await supabaseAdmin.from("admin_remember_devices").insert({
    user_id: userId,
    token_hash: hashRememberToken(token),
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error("Failed to save trusted device.");
  }

  await setRememberCookie(token);
}

export function generateOtpCode(): string {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

export function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function verifyAdminCredentials(email: string, password: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) {
    return { ok: false as const, error: "Invalid email or password." };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profileError || profile?.role?.toLowerCase() !== "admin") {
    return { ok: false as const, error: "Two-factor authentication is only required for admin accounts." };
  }

  return {
    ok: true as const,
    userId: data.user.id,
    email: data.user.email ?? email.trim().toLowerCase(),
  };
}

export async function createAdmin2FAChallenge(userId: string, email: string) {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  await supabaseAdmin.from("admin_2fa_challenges").delete().eq("user_id", userId);

  const { data: challenge, error } = await supabaseAdmin
    .from("admin_2fa_challenges")
    .insert({
      user_id: userId,
      email,
      code_hash: hashOtpCode(code),
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !challenge) {
    throw new Error("Failed to create verification challenge.");
  }

  await sendAdmin2FAEmail(email, code);

  return {
    challengeToken: challenge.id,
    expiresAt,
  };
}

export async function verifyAdmin2FAChallenge(challengeToken: string, code: string) {
  const { data: challenge, error } = await supabaseAdmin
    .from("admin_2fa_challenges")
    .select("id, user_id, email, code_hash, expires_at, attempts")
    .eq("id", challengeToken)
    .single();

  if (error || !challenge) {
    return { ok: false as const, error: "Verification session expired. Please sign in again." };
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("admin_2fa_challenges").delete().eq("id", challengeToken);
    return { ok: false as const, error: "Verification code expired. Please sign in again." };
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    await supabaseAdmin.from("admin_2fa_challenges").delete().eq("id", challengeToken);
    return { ok: false as const, error: "Too many failed attempts. Please sign in again." };
  }

  const isValid = hashOtpCode(code.trim()) === challenge.code_hash;

  if (!isValid) {
    await supabaseAdmin
      .from("admin_2fa_challenges")
      .update({ attempts: challenge.attempts + 1 })
      .eq("id", challengeToken);

    return { ok: false as const, error: "Invalid verification code. Please try again." };
  }

  await supabaseAdmin.from("admin_2fa_challenges").delete().eq("id", challengeToken);

  return {
    ok: true as const,
    userId: challenge.user_id,
    email: challenge.email,
  };
}

async function sendAdmin2FAEmail(email: string, code: string) {
  const displayName = email.split("@")[0];

  await transporter.sendMail({
    from: `"Academic Atelier" <${process.env.ADMIN_EMAIL}>`,
    to: email,
    subject: "Your Admin Login Verification Code",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
        <h2 style="color: #174778;">Admin Login Verification</h2>
        <p style="color: #374151; font-size: 16px; line-height: 1.5;">
          Hi ${displayName}, use the verification code below to complete your admin sign-in.
        </p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; color: #4b5563; font-size: 14px;">Your verification code</p>
          <p style="margin: 12px 0 0 0; color: #174778; font-size: 32px; font-weight: bold; letter-spacing: 6px;">${code}</p>
        </div>

        <p style="color: #374151; font-size: 14px; line-height: 1.5;">
          This code expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not attempt to sign in, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
