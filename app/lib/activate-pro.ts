/**
 * activate-pro.ts — shared server-only helper that upgrades a user's
 * phase2.enrollments rows from Starter to Pro.
 *
 * Used by both:
 *   - app/api/checkout/verify-payment/route.ts  (client-side HMAC verification)
 *   - app/api/webhooks/razorpay/route.ts        (server-side webhook)
 *
 * The function is idempotent: if the enrollment is already on Pro or Premium
 * it returns immediately without writing to the database.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function makeServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type ActivateProParams = {
  phase2UserId:  string;
  courseId:      string;
  enrollmentId?: string; // optional — the existing Starter row to update in-place
  proBundleId:   string;
  paymentRef:    string; // razorpay_payment_id or order id — for logging only
};

/**
 * Upgrades the enrollment for (phase2UserId, courseId) to Pro.
 *
 * Strategy:
 *  1. Check current tier — skip if already Pro/Premium (idempotent).
 *  2. If enrollmentId is known, UPDATE that row's bundle_id directly.
 *  3. Fallback: UPSERT on (user_id, course_id) conflict so the row is
 *     always left in the correct state even if the id was wrong.
 *
 * Throws on unrecoverable DB errors so the caller can log and decide
 * whether to continue processing other courses.
 */
export async function activateProForCourse(
  params: ActivateProParams,
): Promise<void> {
  const { phase2UserId, courseId, enrollmentId, proBundleId, paymentRef } = params;
  const db = makeServiceClient();
  const oneYearFromNow = new Date(
    new Date().setFullYear(new Date().getFullYear() + 1),
  ).toISOString();

  // ── 1. Idempotency check ──────────────────────────────────────────────────
  const { data: existing } = await (db as any)
    .schema("phase2")
    .from("enrollments")
    .select("id, bundles(bundle_name)")
    .eq("user_id", phase2UserId)
    .eq("course_id", courseId)
    .eq("status", "active")
    .limit(5);

  if (existing && existing.length > 0) {
    for (const row of existing as any[]) {
      const bn: string =
        Array.isArray(row.bundles)
          ? (row.bundles[0]?.bundle_name ?? "")
          : (row.bundles?.bundle_name ?? "");
      if (bn.toLowerCase().includes("pro") || bn.toLowerCase().includes("premium")) {
        console.log(
          `[activate-pro] course ${courseId} already on "${bn}" ` +
          `for user ${phase2UserId} — skipping (ref: ${paymentRef}).`,
        );
        return;
      }
    }
  }

  // ── 2. Update the known Starter enrollment row ────────────────────────────
  if (enrollmentId) {
    const { error: updateErr } = await (db as any)
      .schema("phase2")
      .from("enrollments")
      .update({
        bundle_id:       proBundleId,
        status:          "active",
        access_end_date: oneYearFromNow,
      })
      .eq("id", enrollmentId)
      .eq("user_id", phase2UserId) // ownership guard — cannot modify another user's row
      .eq("course_id", courseId);

    if (!updateErr) {
      console.log(
        `[activate-pro] updated enrollment ${enrollmentId} → Pro ` +
        `(course ${courseId}, user ${phase2UserId}, ref: ${paymentRef}).`,
      );
      return;
    }

    console.error(
      `[activate-pro] UPDATE failed for enrollment ${enrollmentId} ` +
      `(course ${courseId}):`,
      updateErr.message,
    );
    // Fall through to upsert as recovery
  }

  // ── 3. Upsert fallback ────────────────────────────────────────────────────
  let orderId: number | null = null;
  const { data: existingOrder } = await (db as any)
    .schema("phase2")
    .from("orders")
    .select("id")
    .eq("user_id", phase2UserId)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingOrder?.id) {
    orderId = existingOrder.id;
  } else {
    try {
      const { data: newOrder } = await (db as any)
        .schema("phase2")
        .from("orders")
        .insert({
          user_id: phase2UserId,
          course_id: courseId,
          bundle_id: proBundleId,
          amount: 6000,
          status: "paid",
          razorpay_order_id: `upg_order_${Date.now()}`,
          razorpay_payment_id: paymentRef,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      if (newOrder?.id) orderId = newOrder.id;
    } catch (ordErr) {
      console.warn("[activate-pro] order insert warning:", ordErr);
    }
  }

  const { data: courseData } = await db
    .from("maincourses")
    .select("product_id")
    .eq("id", courseId)
    .maybeSingle();

  const { error: upsertErr } = await (db as any)
    .schema("phase2")
    .from("enrollments")
    .upsert(
      {
        user_id:          phase2UserId,
        order_id:         orderId,
        course_id:        courseId,
        bundle_id:        proBundleId,
        product_id:       (courseData as any)?.product_id ?? null,
        batch_type:       "recorded",
        status:           "active",
        access_start_date: new Date().toISOString(),
        access_end_date:   oneYearFromNow,
      },
      // Conflict key: every (user_id, course_id) pair should be unique per
      // active enrollment.
      { onConflict: "user_id,course_id", ignoreDuplicates: false },
    );

  if (upsertErr) {
    throw new Error(
      `[activate-pro] upsert failed for user ${phase2UserId} ` +
      `course ${courseId} (ref: ${paymentRef}): ${upsertErr.message}`,
    );
  }

  console.log(
    `[activate-pro] upserted Pro enrollment for course ${courseId}, ` +
    `user ${phase2UserId}, ref: ${paymentRef}.`,
  );
}
