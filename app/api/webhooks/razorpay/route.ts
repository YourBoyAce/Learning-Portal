/**
 * POST /api/webhooks/razorpay
 *
 * Secondary Razorpay webhook handler.  Activates Pro access when a
 * payment.captured event arrives from Razorpay's servers.
 *
 * This route is a SAFETY NET for cases where the browser closed before
 * /api/checkout/verify-payment was called (e.g. network drop after payment).
 * The verify-payment route is the primary activation path.
 *
 * Both routes share the same idempotent activateProForCourse() helper, so
 * receiving the webhook after verify-payment has already run is harmless.
 *
 * Signature verification
 *   Razorpay signs webhook payloads with
 *   HMAC-SHA256(key = RAZORPAY_WEBHOOK_SECRET, msg = rawRequestBody)
 *   and puts the hex digest in the X-Razorpay-Signature header.
 *
 * Events handled
 *   payment.captured  — payment has been successfully captured by Razorpay
 *
 * Setup (Razorpay Dashboard → Settings → Webhooks)
 *   URL:    https://<your-domain>/api/webhooks/razorpay
 *   Events: payment.captured
 *   Secret: value of RAZORPAY_WEBHOOK_SECRET
 *
 * Notes stored in the Order (set by create-order route)
 *   phase2_user_id, course_ids (comma-sep), enrollment_ids (comma-sep),
 *   pro_bundle_id
 *
 * Razorpay webhook payload shape (relevant fields):
 *   {
 *     event: "payment.captured",
 *     payload: {
 *       payment: {
 *         entity: {
 *           id: "pay_XXXX",
 *           order_id: "order_XXXX",
 *           status: "captured",
 *           notes: { phase2_user_id, course_ids, enrollment_ids, pro_bundle_id }
 *         }
 *       }
 *     }
 *   }
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { activateProForCourse } from "@/app/lib/activate-pro";

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// Disable Next.js body auto-parsing so we can read the raw bytes for HMAC
export const runtime = "nodejs";

export async function POST(request: Request) {
  // ── Guard: webhook secret not configured ──────────────────────────────────
  if (!RAZORPAY_WEBHOOK_SECRET || RAZORPAY_WEBHOOK_SECRET === "REPLACE_ME") {
    // Return 200 so Razorpay does not keep retrying while the secret is missing.
    console.warn("[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not set. Skipping.");
    return NextResponse.json({ received: true });
  }

  // ── Read raw body (needed for HMAC) ───────────────────────────────────────
  const rawBody = await request.text();

  // ── Verify Razorpay webhook signature ────────────────────────────────────
  const receivedSig = request.headers.get("x-razorpay-signature") ?? "";
  const expectedSig = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const receivedBuf = Buffer.from(receivedSig, "hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");
  const isValid =
    receivedBuf.length > 0 &&
    receivedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(receivedBuf, expectedBuf);

  if (!isValid) {
    console.error(
      "[razorpay-webhook] Signature verification failed. " +
      `received="${receivedSig.slice(0, 12)}…" expected="${expectedSig.slice(0, 12)}…"`,
    );
    return NextResponse.json(
      { error: "Webhook signature verification failed." },
      { status: 400 },
    );
  }

  // ── Parse verified body ───────────────────────────────────────────────────
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // ── Only process payment.captured ────────────────────────────────────────
  if (event?.event !== "payment.captured") {
    // Acknowledge other events so Razorpay stops retrying them
    return NextResponse.json({ received: true });
  }

  const payment = event?.payload?.payment?.entity;
  if (!payment) {
    console.error("[razorpay-webhook] payment.captured missing payment entity.", event);
    return NextResponse.json({ received: true });
  }

  const paymentId: string = payment.id ?? "";
  const orderId: string = payment.order_id ?? "";
  const status: string = payment.status ?? "";
  const notes: Record<string, string> = payment.notes ?? {};

  // Only process captured payments
  if (status !== "captured") {
    console.warn(`[razorpay-webhook] payment ${paymentId} status="${status}" — skipping.`);
    return NextResponse.json({ received: true });
  }

  const phase2UserId = notes.phase2_user_id ?? "";
  const courseIdsRaw = notes.course_ids ?? "";
  const enrollmentIdsRaw = notes.enrollment_ids ?? "";
  const proBundleId = notes.pro_bundle_id ?? "";

  if (!phase2UserId || !courseIdsRaw || !proBundleId) {
    console.error(
      `[razorpay-webhook] payment ${paymentId} (order ${orderId}) is missing ` +
      `required notes fields. Manual reconciliation required.`,
      notes,
    );
    // Return 200 to stop retries — the data is unrecoverable without the notes
    return NextResponse.json({ received: true });
  }

  const courseArr = courseIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const enrollmentArr = enrollmentIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);

  // ── Activate Pro for each purchased course ────────────────────────────────
  const errors: string[] = [];
  for (let i = 0; i < courseArr.length; i++) {
    const courseId = courseArr[i];
    const enrollmentId = enrollmentArr[i] ?? undefined;

    try {
      await activateProForCourse({
        phase2UserId,
        courseId,
        enrollmentId,
        proBundleId,
        paymentRef: paymentId,
      });
    } catch (err: any) {
      console.error(
        `[razorpay-webhook] activateProForCourse failed for course ${courseId} ` +
        `(payment ${paymentId}, order ${orderId}):`,
        err?.message ?? err,
      );
      errors.push(courseId);
    }
  }

  if (errors.length > 0) {
    // Log for manual reconciliation but return 200 so Razorpay stops retrying.
    // The admin team must check server logs and manually re-run activation for
    // the failed courses.
    console.error(
      `[razorpay-webhook] Pro activation failed for courses [${errors.join(", ")}]. ` +
      `phase2_user_id=${phase2UserId} payment=${paymentId} order=${orderId}. ` +
      `Manual reconciliation required.`,
    );
  }

  return NextResponse.json({ received: true });
}
