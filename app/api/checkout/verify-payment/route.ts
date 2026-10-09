/**
 * POST /api/checkout/verify-payment
 *
 * Server-side Razorpay payment verification.  Called by the client
 * immediately after the Razorpay checkout modal fires its success handler.
 *
 * This route is the PRIMARY path for activating Pro access.  The Razorpay
 * webhook (POST /api/webhooks/razorpay) is a secondary safety net for cases
 * where the browser closes before this route is called.
 *
 * Request
 *   Authorization: Bearer <supabase-access-token>
 *   Body:
 *     razorpay_order_id:   string  — from Razorpay modal success handler
 *     razorpay_payment_id: string  — from Razorpay modal success handler
 *     razorpay_signature:  string  — from Razorpay modal success handler
 *     courseIds:           string  — comma-separated (echoed from create-order)
 *     enrollmentIds:       string  — comma-separated, same order
 *     proBundleId:         string  — echoed from create-order
 *
 * Verification
 *   HMAC-SHA256( key = RAZORPAY_KEY_SECRET,
 *                msg = razorpay_order_id + "|" + razorpay_payment_id )
 *   must equal razorpay_signature (hex digest).
 *
 * The course ownership + enrollment eligibility is NOT re-validated here
 * because it was already validated when the order was created and the
 * order_id / enrollment_ids were set by the server.  If you want a stricter
 * double-check, call validateUpgradeRequest() again before activating.
 *
 * Response (success)
 *   { success: true }
 *
 * Response (failure)
 *   { error: string }  with appropriate HTTP status code
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { activateProForCourse } from "@/app/lib/activate-pro";
import { apiErrorResponse } from "@/app/lib/error-handler";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET === "REPLACE_ME") {
    return NextResponse.json(
      { error: "Payment processing is not configured." },
      { status: 503 },
    );
  }

  // ── Authenticate the calling user ─────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Verify the token belongs to a real user
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData } = await authClient.auth.getUser(accessToken);
  if (!authData.user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }
  const authUserId = authData.user.id;

  // Resolve phase2 user id
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: p2User } = await (db as any)
    .schema("phase2")
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  const phase2UserId: string = (p2User as any)?.id ?? authUserId;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, string> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    courseIds,
    enrollmentIds,
    proBundleId,
  } = body;

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature ||
    !courseIds ||
    !proBundleId
  ) {
    return NextResponse.json(
      { error: "Missing required payment fields." },
      { status: 400 },
    );
  }

  // ── Razorpay HMAC-SHA256 signature verification ───────────────────────────
  // Razorpay signs: HMAC_SHA256(key=key_secret, msg=order_id + "|" + payment_id)
  const expectedSig = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(razorpay_signature, "hex");
  const expectedBuffer = Buffer.from(expectedSig, "hex");
  const isValid =
    sigBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(sigBuffer, expectedBuffer);

  if (!isValid) {
    console.error(
      `[verify-payment] Invalid signature for order ${razorpay_order_id}, ` +
      `payment ${razorpay_payment_id}, user ${authUserId}.`,
    );
    return NextResponse.json(
      { error: "Payment verification failed. Signature mismatch." },
      { status: 400 },
    );
  }

  // ── Activate Pro for each purchased course ────────────────────────────────
  const courseArr = courseIds.split(",").map((s) => s.trim()).filter(Boolean);
  const enrollmentArr = (enrollmentIds ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  if (courseArr.length === 0) {
    return NextResponse.json({ error: "No courses to activate." }, { status: 400 });
  }

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
        paymentRef: razorpay_payment_id,
      });
    } catch (err: any) {
      console.error(
        `[verify-payment] activateProForCourse failed for course ${courseId} ` +
        `(payment ${razorpay_payment_id}):`,
        err?.message ?? err,
      );
      errors.push(courseId);
    }
  }

  if (errors.length > 0) {
    // Partial activation — some courses upgraded, some not.
    // Log for reconciliation; return 207 so the client knows there was a partial failure.
    console.error(
      `[verify-payment] Pro activation failed for courses [${errors.join(", ")}]. ` +
      `auth_user_id=${authUserId} phase2_user_id=${phase2UserId} ` +
      `order=${razorpay_order_id} payment=${razorpay_payment_id}. ` +
      `Manual reconciliation required.`,
    );
    return NextResponse.json(
      {
        success: false,
        error:
          "Payment verified, but some courses could not be activated. " +
          "Please contact support with your payment reference.",
        paymentId: razorpay_payment_id,
        failedCourses: errors,
      },
      { status: 207 },
    );
  }

  return NextResponse.json({ success: true });
}
