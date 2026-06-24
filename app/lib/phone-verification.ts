const PLAIN_PHONE_REGEX = /^\d{10,15}$/;

export function normalizePhoneNumber(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const digitsOnly = trimmed.replace(/\D/g, "");

  if (!PLAIN_PHONE_REGEX.test(digitsOnly)) {
    return null;
  }

  return digitsOnly;
}

/** Plain digits in DB/UI; TextBee/carriers expect E.164 with a leading + at send time. */
export function formatPhoneForSmsGateway(plainPhone: string): string {
  const digits = plainPhone.replace(/\D/g, "");

  if (/^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }

  if (/^91[6-9]\d{9}$/.test(digits)) {
    return `+${digits}`;
  }

  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length <= 6) {
    return phoneNumber;
  }

  const prefix = phoneNumber.slice(0, 2);
  const suffix = phoneNumber.slice(-4);
  return `${prefix}${"*".repeat(Math.max(phoneNumber.length - 6, 3))}${suffix}`;
}
