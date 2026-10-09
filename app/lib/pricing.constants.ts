/**
 * Pricing constants for the Pro plan upgrade flow (Razorpay / INR).
 *
 * Razorpay amounts are expressed in the smallest currency unit — INR paise
 * (1 INR = 100 paise), exactly as USD uses cents.
 *
 * PRO_UPGRADE_PRICE_PAISE  – default price in INR paise charged per course
 *                            when upgrading from Starter → Pro.
 *                            Configured via NEXT_PUBLIC_PRO_PRICE_PAISE.
 *                            Default: 490000 paise = ₹4,900.
 *
 * PRO_PRICE_OVERRIDES      – optional per-course override map (courseId → paise).
 *                            Configured via NEXT_PUBLIC_PRO_PRICE_OVERRIDES
 *                            (JSON object: '{"<courseId>": 790000, ...}').
 *
 * NOTE: All prices are re-validated server-side in
 *   app/api/checkout/create-order/route.ts before the Razorpay order is
 *   created.  Client-submitted amounts are never trusted.
 */

/** Default Pro upgrade price in INR paise. 490000 = ₹4,900. */
export const PRO_UPGRADE_PRICE_PAISE: number = (() => {
  const raw = process.env.NEXT_PUBLIC_PRO_PRICE_PAISE;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 490000;
})();

/**
 * Per-course price overrides in INR paise.
 * Key = course id (string), value = price in paise.
 * Example env value: '{"42": 790000, "17": 390000}'
 */
export const PRO_PRICE_OVERRIDES: Record<string, number> = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_PRO_PRICE_OVERRIDES;
    if (!raw || raw === "{}") return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([k, v]) => [k, Number(v)] as [string, number])
        .filter(([, v]) => Number.isFinite(v) && v > 0),
    );
  } catch {
    return {};
  }
})();

/**
 * Returns the Pro upgrade price in INR paise for a given course id.
 * Falls back to the default if no per-course override is set.
 */
export function getProPricePaise(courseId: string | number): number {
  const key = String(courseId);
  const override = PRO_PRICE_OVERRIDES[key];
  return Number.isFinite(override) && override > 0
    ? override
    : PRO_UPGRADE_PRICE_PAISE;
}

/**
 * Formats a paise amount as a human-readable INR string.
 * e.g. 490000 → "₹4,900.00"
 */
export function formatPrice(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
