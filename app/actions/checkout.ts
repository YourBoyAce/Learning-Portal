"use server";

/**
 * checkout.ts — server actions for the Pro upgrade checkout flow (Razorpay).
 *
 * getUpgradeEligibleCourses
 *   Returns the authenticated user's enrollments that are eligible for a
 *   Starter → Pro upgrade, together with the per-course Pro price (in INR
 *   paise) and the user's current tier for each course.
 *
 * validateUpgradeRequest
 *   Server-side guard used by the order-creation route.
 *   Re-checks enrollment ownership, current tier, and recomputes the
 *   authoritative total so the client can never submit an arbitrary price.
 *   Also resolves the Pro bundle id needed to write the correct bundle_id
 *   when activating Pro after payment.
 */

import { createClient } from "@supabase/supabase-js";
import { getProPricePaise } from "@/app/lib/pricing.constants";
import { UserTier } from "@/app/lib/tier.constants";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ─── Public types ─────────────────────────────────────────────────────────────

export type EligibleCourse = {
  courseId:     string;
  courseTitle:  string;
  currentTier:  UserTier;
  /** Price in INR paise (Razorpay's smallest unit) */
  priceAmount:  number;
};

export type UpgradeEligibilityResult =
  | { success: true;  courses: EligibleCourse[] }
  | { success: false; error: string };

export type ValidatedUpgradeRequest = {
  authUserId:   string;
  phase2UserId: string;
  selectedCourses: Array<{
    courseId:            string;
    courseTitle:         string;
    /** Price in INR paise */
    priceAmount:         number;
    currentEnrollmentId: string;
    proBundleId:         string;
  }>;
  /** Sum of all selected course prices in INR paise */
  totalPaise: number;
};

export type ValidationResult =
  | { success: true;  data: ValidatedUpgradeRequest }
  | { success: false; error: string };

// ─── Internal helpers ─────────────────────────────────────────────────────────

function makeAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveAuthUser(accessToken: string) {
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

function tierFromBundle(bundleName: string | null): UserTier {
  if (!bundleName) return "Starter"; // null bundle_id → Starter (legacy rows)
  const lower = bundleName.toLowerCase();
  if (lower.includes("premium")) return "Premium";
  if (lower.includes("pro"))     return "Pro";
  return "Starter";
}

function compareTier(tier: UserTier): number {
  if (tier === "Premium") return 3;
  if (tier === "Pro")     return 2;
  if (tier === "Starter") return 1;
  return 0;
}

// ─── Exported server actions ──────────────────────────────────────────────────

/**
 * Returns all courses where the user has an active Starter enrollment
 * and is therefore eligible to upgrade to Pro.
 *
 * Also returns Pro/Premium courses so the upgrade page can show "Current plan"
 * and disable the Starter option for those courses.
 * Courses with no active enrollment at all are excluded.
 */
export async function getUpgradeEligibleCourses(
  accessToken: string,
): Promise<UpgradeEligibilityResult> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: "Server configuration error." };
  }

  const user = await resolveAuthUser(accessToken);
  if (!user) return { success: false, error: "Unauthorized." };

  const db = makeAdminClient();

  // Admins/instructors have Premium — nothing to upgrade
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as any)?.role?.toLowerCase() ?? "";
  if (role === "admin" || role === "instructor") {
    return { success: true, courses: [] };
  }

  // Resolve phase2 user id (falls back to auth uid for legacy rows)
  const { data: p2User } = await db
    .schema("phase2")
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const phase2UserId: string = (p2User as any)?.id ?? user.id;

  // Fetch all active enrollments with bundle info
  const { data: enrollments, error: enrollErr } = await db
    .schema("phase2")
    .from("enrollments")
    .select("id, course_id, bundle_id, bundles(bundle_name)")
    .eq("user_id", phase2UserId)
    .eq("status", "active");

  if (enrollErr) {
    console.error("getUpgradeEligibleCourses enrollment error:", enrollErr.message);
    return { success: false, error: "Failed to fetch enrollments." };
  }

  if (!enrollments || enrollments.length === 0) {
    return { success: true, courses: [] };
  }

  // Deduplicate per course — keep the highest-tier row so Pro/Premium wins
  const courseMap = new Map<
    string,
    { enrollmentId: string; bundleName: string | null; bundleId: string | null }
  >();
  for (const row of enrollments as any[]) {
    const courseId = String(row.course_id);
    const bundleName: string | null =
      Array.isArray(row.bundles)
        ? (row.bundles[0]?.bundle_name ?? null)
        : (row.bundles?.bundle_name ?? null);

    const existing = courseMap.get(courseId);
    if (!existing) {
      courseMap.set(courseId, {
        enrollmentId: String(row.id),
        bundleName,
        bundleId: row.bundle_id ?? null,
      });
      continue;
    }
    if (compareTier(tierFromBundle(bundleName)) > compareTier(tierFromBundle(existing.bundleName))) {
      courseMap.set(courseId, {
        enrollmentId: String(row.id),
        bundleName,
        bundleId: row.bundle_id ?? null,
      });
    }
  }

  // Fetch course titles in one query
  const courseIds = [...courseMap.keys()];
  const { data: courses, error: courseErr } = await db
    .from("maincourses")
    .select("id, title")
    .in("id", courseIds);

  if (courseErr) {
    console.error("getUpgradeEligibleCourses course error:", courseErr.message);
    return { success: false, error: "Failed to fetch course data." };
  }

  const courseTitleMap = new Map<string, string>(
    ((courses ?? []) as any[]).map((c) => [String(c.id), c.title ?? "Untitled Course"]),
  );

  const result: EligibleCourse[] = [];
  for (const [courseId, { bundleName }] of courseMap.entries()) {
    result.push({
      courseId,
      courseTitle:  courseTitleMap.get(courseId) ?? "Untitled Course",
      currentTier:  tierFromBundle(bundleName),
      priceAmount:  getProPricePaise(courseId),
    });
  }

  // Sort: Starter (upgradeable) first, then alphabetically
  result.sort((a, b) => {
    const aEl = (a.currentTier === "Starter" || a.currentTier === null) ? 0 : 1;
    const bEl = (b.currentTier === "Starter" || b.currentTier === null) ? 0 : 1;
    if (aEl !== bEl) return aEl - bEl;
    return a.courseTitle.localeCompare(b.courseTitle);
  });

  return { success: true, courses: result };
}

/**
 * Validates the user's upgrade request before the Razorpay order is created.
 *
 * - Confirms the calling user owns every selected course enrollment.
 * - Confirms every selected course is currently on Starter (not already Pro/Premium).
 * - Recomputes the authoritative total in INR paise.
 * - Resolves the Pro bundle id from phase2.bundles so the activation routes
 *   can write the correct bundle_id without a second DB lookup.
 *
 * The client never provides prices — only course ids.
 */
export async function validateUpgradeRequest(
  accessToken: string,
  selectedCourseIds: string[],
): Promise<ValidationResult> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: "Server configuration error." };
  }

  if (!Array.isArray(selectedCourseIds) || selectedCourseIds.length === 0) {
    return { success: false, error: "No courses selected." };
  }

  const user = await resolveAuthUser(accessToken);
  if (!user) return { success: false, error: "Unauthorized." };

  const db = makeAdminClient();

  // Admins/instructors do not go through checkout
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as any)?.role?.toLowerCase() ?? "";
  if (role === "admin" || role === "instructor") {
    return { success: false, error: "Admins and instructors do not need to upgrade." };
  }

  const { data: p2User } = await db
    .schema("phase2")
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const phase2UserId: string = (p2User as any)?.id ?? user.id;

  // Deduplicate and cap at 50 courses
  const deduped = [...new Set(selectedCourseIds.map((id) => String(id).trim()))].slice(0, 50);

  // Fetch enrollments for these courses
  const { data: enrollments, error: enrollErr } = await db
    .schema("phase2")
    .from("enrollments")
    .select("id, course_id, bundle_id, bundles(bundle_name)")
    .eq("user_id", phase2UserId)
    .eq("status", "active")
    .in("course_id", deduped);

  if (enrollErr) {
    console.error("validateUpgradeRequest enrollment error:", enrollErr.message);
    return { success: false, error: "Failed to validate enrollment." };
  }

  // Build courseId → best enrollment map
  const enrollMap = new Map<
    string,
    { enrollmentId: string; bundleName: string | null }
  >();
  for (const row of (enrollments ?? []) as any[]) {
    const courseId = String(row.course_id);
    const bundleName: string | null =
      Array.isArray(row.bundles)
        ? (row.bundles[0]?.bundle_name ?? null)
        : (row.bundles?.bundle_name ?? null);
    const existing = enrollMap.get(courseId);
    if (!existing || compareTier(tierFromBundle(bundleName)) > compareTier(tierFromBundle(existing.bundleName))) {
      enrollMap.set(courseId, { enrollmentId: String(row.id), bundleName });
    }
  }

  // Reject courses that aren't enrolled or are already on Pro/Premium
  const missingOrIneligible: string[] = [];
  for (const courseId of deduped) {
    const enrollment = enrollMap.get(courseId);
    if (!enrollment) { missingOrIneligible.push(courseId); continue; }
    const tier = tierFromBundle(enrollment.bundleName);
    if (tier === "Pro" || tier === "Premium") missingOrIneligible.push(courseId);
  }

  if (missingOrIneligible.length > 0) {
    return {
      success: false,
      error:
        `One or more selected courses are not eligible for a Pro upgrade: ` +
        missingOrIneligible.join(", "),
    };
  }

  // Fetch course titles
  const { data: courses, error: courseErr } = await db
    .from("maincourses")
    .select("id, title")
    .in("id", deduped);

  if (courseErr) return { success: false, error: "Failed to fetch course details." };

  const courseTitleMap = new Map<string, string>(
    ((courses ?? []) as any[]).map((c) => [String(c.id), c.title ?? "Untitled Course"]),
  );

  for (const courseId of deduped) {
    if (!courseTitleMap.has(courseId)) {
      return { success: false, error: `Course not found: ${courseId}` };
    }
  }

  // Resolve the Pro bundle id from phase2.bundles
  const { data: proBundle } = await db
    .schema("phase2")
    .from("bundles")
    .select("id")
    .ilike("bundle_name", "%pro%")
    .not("bundle_name", "ilike", "%premium%")
    .limit(1)
    .maybeSingle();

  const proBundleId: string | null = (proBundle as any)?.id ?? null;
  if (!proBundleId) {
    console.error("validateUpgradeRequest: no Pro bundle found in phase2.bundles");
    return {
      success: false,
      error: "Pro plan configuration is missing. Please contact support.",
    };
  }

  // Build validated line items with server-authoritative prices
  let totalPaise = 0;
  const selectedCourses: ValidatedUpgradeRequest["selectedCourses"] = [];
  for (const courseId of deduped) {
    const priceAmount = getProPricePaise(courseId);
    totalPaise += priceAmount;
    selectedCourses.push({
      courseId,
      courseTitle:         courseTitleMap.get(courseId)!,
      priceAmount,
      currentEnrollmentId: enrollMap.get(courseId)!.enrollmentId,
      proBundleId,
    });
  }

  return {
    success: true,
    data: { authUserId: user.id, phase2UserId, selectedCourses, totalPaise },
  };
}
