import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashOtpCode, normalizePhoneNumber } from "@/app/lib/phone-verification";

export async function consumePhoneVerification(phoneNumber: string, code: string) {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const trimmedCode = code.trim();

  if (!normalizedPhone || !/^\d{6}$/.test(trimmedCode)) {
    return { ok: false as const, error: "Invalid verification code. Please try again." };
  }

  const hashedCode = hashOtpCode(trimmedCode);

  let { data: verification, error: lookupError } = await supabaseAdmin
    .from("phone_verifications")
    .select("id, expires_at, verified")
    .eq("phone_number", normalizedPhone)
    .eq("otp_code", hashedCode)
    .eq("verified", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Backward compatibility with any legacy unhashed code created right before deployment
  if (!verification) {
    const { data: legacyVerification } = await supabaseAdmin
      .from("phone_verifications")
      .select("id, expires_at, verified")
      .eq("phone_number", normalizedPhone)
      .eq("otp_code", trimmedCode)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (legacyVerification) {
      verification = legacyVerification;
    }
  }

  if (lookupError || !verification) {
    return { ok: false as const, error: "Invalid verification code. Please try again." };
  }

  if (new Date(verification.expires_at).getTime() < Date.now()) {
    return { ok: false as const, error: "Verification code expired. Request a new code." };
  }

  const { error: verifyError } = await supabaseAdmin
    .from("phone_verifications")
    .update({ verified: true })
    .eq("id", verification.id);

  if (verifyError) {
    return { ok: false as const, error: "Unable to complete verification. Please try again." };
  }

  return { ok: true as const, phone: normalizedPhone };
}
