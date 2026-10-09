/**
 * POST /api/checkout/create-order
 *
 * Creates a Razorpay Order for a Pro plan upgrade and returns the order
 * details the client needs to open the Razorpay checkout modal.
 *
 * Request
 *   Authorization: Bearer <supabase-access-token>
 *   Body: { courseIds: string[] }
 *
 * Response (success)
 *   {
 *     orderId:       string   // Razorpay order id  (order_XXXXXXX)
 *     keyId:         string   // NEXT_PUBLIC_RAZORPAY_KEY_ID — safe to expose
 *     totalPaise:    number   // total amount in INR paise
 *     courseIds:     string   // comma-separated — echoed for the client modal
 *     enrollmentIds: string   // comma-separated, same order as courseIds
 *     proBundleId:   string   // used by verify-payment to write the correct bundle
 *   }
 *
 * Security
 *   - All prices are recomputed on the server via validateUpgradeRequest().
 *   - The client never submits a price; it only submits course IDs.
 *   - The Razorpay secret key never leaves the server.
 *   - The client uses the returned orderId + keyId to open the modal.
 *
 * Setup
 *   Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and
 *   NEXT_PUBLIC_RAZORPAY_KEY_ID in .env.local.
 *   (NEXT_PUBLIC_RAZORPAY_KEY_ID must equal RAZORPAY_KEY_ID; the public copy
 *   is only used on the client side of the modal.)
 */

import { NextResponse } from "next/server";
import { validateUpgradeRequest } from "@/app/actions/checkout";
import { apiErrorResponse } from "@/app/lib/error-handler";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export async function POST(request: Request) {
  // ── Guard: Razorpay not yet configured ────────────────────────────────────
  if (
    !RAZORPAY_KEY_ID ||
    RAZORPAY_KEY_ID === "rzp_test_REPLACE_ME" ||
    !RAZORPAY_KEY_SECRET ||
    RAZORPAY_KEY_SECRET === "REPLACE_ME"
  ) {
    return NextResponse.json(
      { error: "Payment processing is not configured yet. Please contact support." },
      { status: 503 },
    );
  }

  // ── Authenticate ──────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { courseIds?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.courseIds) || body.courseIds.length === 0) {
    return NextResponse.json(
      { error: "courseIds must be a non-empty array." },
      { status: 400 },
    );
  }

  // ── Server-side validation (ownership, eligibility, prices) ──────────────
  const validation = await validateUpgradeRequest(
    accessToken,
    body.courseIds as string[],
  );

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  const { authUserId, phase2UserId, selectedCourses, totalPaise } = validation.data;

  // ── Create Razorpay Order ─────────────────────────────────────────────────
  // Razorpay Orders API: https://razorpay.com/docs/api/orders/create/
  // Authentication: HTTP Basic with key_id:key_secret
  const courseIdsCsv = selectedCourses.map((c) => c.courseId).join(",");
  const enrollmentIdsCsv = selectedCourses.map((c) => c.currentEnrollmentId).join(",");
  const proBundleId = selectedCourses[0]?.proBundleId ?? "";

  // receipt is a short idempotency label (max 40 chars) visible in the dashboard
  const receipt = `upg-${authUserId.slice(0, 8)}-${Date.now()}`.slice(0, 40);

  const basicAuth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

  let rzpOrderId: string;
  try {
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        amount: totalPaise,    // INR paise — server-computed, never from client
        currency: "INR",
        receipt,
        // Razorpay stores up to 15 notes (key-value pairs, each key/value max 256 chars)
        notes: {
          auth_user_id:   authUserId.slice(0, 256),
          phase2_user_id: phase2UserId.slice(0, 256),
          course_ids:     courseIdsCsv.slice(0, 256),
          enrollment_ids: enrollmentIdsCsv.slice(0, 256),
          pro_bundle_id:  proBundleId.slice(0, 256),
        },
      }),
    });

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text().catch(() => "(no body)");
      console.error(`Razorpay create-order failed ${rzpRes.status}:`, errBody);
      return NextResponse.json(
        { error: "Failed to create payment order. Please try again." },
        { status: 502 },
      );
    }

    const rzpOrder = await rzpRes.json();
    rzpOrderId = rzpOrder.id;

    if (!rzpOrderId) {
      console.error("Razorpay create-order: response missing id", rzpOrder);
      return NextResponse.json(
        { error: "Unexpected response from payment provider." },
        { status: 502 },
      );
    }
  } catch (err) {
    return apiErrorResponse(err, "Razorpay create-order", 500);
  }

  // Return exactly what the client modal needs.
  // Never return RAZORPAY_KEY_SECRET.
  return NextResponse.json({
    orderId:       rzpOrderId,
    keyId:         RAZORPAY_KEY_ID, // public key — safe to send to the browser
    totalPaise,
    courseIds:     courseIdsCsv,
    enrollmentIds: enrollmentIdsCsv,
    proBundleId,
  });
}
