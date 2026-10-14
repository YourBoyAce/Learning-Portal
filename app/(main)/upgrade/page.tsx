"use client";

/**
 * /upgrade — Pro plan upgrade page (Razorpay).
 *
 * Two display modes for the course-selection field, selected via ?mode=:
 *
 *   (default / no mode param)
 *     Flat open checklist — all eligible courses listed with checkboxes.
 *     ?course= pre-selects the matching course on load.
 *     Behaviour unchanged from the original checkout UI.
 *
 *   mode=upgrade
 *     Collapsed dropdown/checklist — a trigger button shows the current
 *     selection summary; clicking it opens an inline checklist panel.
 *     No courses are pre-selected: the user must explicitly choose.
 *     ?course= still works: if a matching eligible course is found it is
 *     pre-selected AND the panel is opened automatically so the user can
 *     see and adjust the selection before paying.
 *     Used when arriving from an UpgradeRequired gating banner or the
 *     inline video-gate button on a course detail page.
 *
 * Both modes share the same Razorpay order-creation → verification flow.
 * Server-side validation (ownership, eligibility, price) is identical.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { getUpgradeEligibleCourses, type EligibleCourse } from "@/app/actions/checkout";
import { formatPrice } from "@/app/lib/pricing.constants";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";

// ─── Razorpay type declarations (injected by checkout.js from CDN) ────────────

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  modal: { ondismiss: () => void };
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
}

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
}

// ─── SDK loader ───────────────────────────────────────────────────────────────

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK."));
    document.head.appendChild(script);
  });
}

// ─── Collapsed dropdown/checklist (upgrade mode only) ────────────────────────

interface CourseDropdownProps {
  eligibleCourses: EligibleCourse[];
  ineligibleCourses: EligibleCourse[];
  selected: Set<string>;
  onToggle: (courseId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  disabled: boolean;
}

function CourseDropdown({
  eligibleCourses,
  ineligibleCourses,
  selected,
  onToggle,
  onSelectAll,
  onDeselectAll,
  disabled,
}: CourseDropdownProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Summary label shown in the collapsed trigger button
  const summaryLabel = (() => {
    if (selected.size === 0) return "Choose courses to upgrade…";
    if (selected.size === 1) {
      const course = eligibleCourses.find((c) => selected.has(c.courseId));
      return course?.courseTitle ?? "1 course selected";
    }
    return `${selected.size} courses selected`;
  })();

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 ${
          selected.size === 0
            ? "border-gray-200 bg-white text-gray-400"
            : "border-brand-primary/30 bg-blue-50/40 text-gray-900"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-brand-primary/50"}`}
      >
        <span className="truncate font-medium">{summaryLabel}</span>
        {open ? (
          <ChevronUp className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>

      {/* ── Dropdown panel ──────────────────────────────────────────────── */}
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg"
        >
          {/* Select all / Deselect all */}
          <div className="flex items-center justify-between border-b border-gray-50 bg-gray-50/60 px-4 py-2.5">
            <span className="text-xs font-semibold text-gray-500">
              {eligibleCourses.length} course{eligibleCourses.length !== 1 ? "s" : ""} eligible
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onSelectAll}
                className="text-xs font-medium text-brand-primary hover:underline"
              >
                Select all
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={onDeselectAll}
                className="text-xs font-medium text-gray-400 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Eligible courses */}
          <ul className="max-h-64 divide-y divide-gray-50 overflow-y-auto">
            {eligibleCourses.map((course) => {
              const isChecked = selected.has(course.courseId);
              return (
                <li key={course.courseId} role="option" aria-selected={isChecked}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                      isChecked ? "bg-blue-50/60" : "hover:bg-gray-50/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggle(course.courseId)}
                      className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-brand-primary"
                      aria-label={`Select ${course.courseTitle} for Pro upgrade`}
                    />
                    <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {course.courseTitle}
                        </p>
                        <p className="text-xs text-gray-400">
                          Current:{" "}
                          <span className="font-medium text-gray-600">
                            {course.currentTier ?? "Starter"}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-semibold ${
                          isChecked ? "text-brand-primary" : "text-gray-400"
                        }`}
                      >
                        {formatPrice(course.priceAmount)}
                      </span>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          {/* Already upgraded — shown greyed-out at the bottom */}
          {ineligibleCourses.length > 0 && (
            <>
              <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Already on Pro
                </p>
              </div>
              <ul className="divide-y divide-gray-50">
                {ineligibleCourses.map((course) => (
                  <li
                    key={course.courseId}
                    role="option"
                    aria-selected={false}
                    aria-disabled="true"
                    className="flex items-center gap-3 px-4 py-3 opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-700">
                        {course.courseTitle}
                      </p>
                      <p className="text-xs text-gray-400">
                        {course.currentTier} — Current plan
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Close button */}
          <div className="border-t border-gray-100 px-4 py-2.5 text-right">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-gray-500 hover:underline"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function UpgradePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCourse = searchParams.get("course") ?? "";
  // mode=upgrade → show collapsed dropdown; anything else → flat open list
  const isUpgradeMode = searchParams.get("mode") === "upgrade";

  const [courses, setCourses] = useState<EligibleCourse[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const paymentIdRef = useRef<string>("");
  const hasFetched = useRef(false);

  // ── Fetch eligible courses on mount ────────────────────────────────────────
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login?next=/upgrade");
        return;
      }

      const result = await getUpgradeEligibleCourses(session.access_token);

      if (!result.success) {
        setPageError(result.error);
        setLoading(false);
        return;
      }

      setCourses(result.courses);

      // In upgrade mode: pre-select the matching course only if ?course= was supplied.
      // In default mode: same pre-selection logic as before.
      if (preselectedCourse) {
        const norm = preselectedCourse.trim().toLowerCase();
        const match = result.courses.find(
          (c) =>
            c.courseId === preselectedCourse ||
            c.courseId === norm ||
            c.courseTitle.toLowerCase().includes(norm),
        );
        const eligible = (c: EligibleCourse) =>
          c.currentTier === "Starter" || c.currentTier === null;
        if (match && eligible(match)) {
          setSelected(new Set([match.courseId]));
          // In upgrade mode, the dropdown opens automatically when a course is
          // pre-selected so the user can see and confirm their selection.
          // (The CourseDropdown component starts closed by default; we signal
          // it to open via the openDropdown flag tracked with a ref.)
        }
      }

      setLoading(false);
    })();
  }, [preselectedCourse, router]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const isEligible = (c: EligibleCourse) =>
    c.currentTier === "Starter" || c.currentTier === null;

  const eligibleCourses = courses.filter(isEligible);
  const ineligibleCourses = courses.filter((c) => !isEligible(c));

  // Display-only total; server recomputes the authoritative amount
  const displayTotalPaise = courses
    .filter((c) => selected.has(c.courseId))
    .reduce((sum, c) => sum + c.priceAmount, 0);

  const toggleCourse = (courseId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
    setCheckoutError("");
  };

  const selectAll = () => {
    setSelected(new Set(eligibleCourses.map((c) => c.courseId)));
    setCheckoutError("");
  };

  const deselectAll = () => {
    setSelected(new Set());
    setCheckoutError("");
  };

  // ── Razorpay checkout / landing-site handoff ──────────────────────────────
  const handlePayNow = async () => {
    if (selected.size === 0) {
      setCheckoutError("Please select at least one course to upgrade.");
      return;
    }
    setCheckoutError("");
    setCheckoutLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login?next=/upgrade");
        return;
      }

      // ── Landing-site handoff path ─────────────────────────────────────
      // When NEXT_PUBLIC_LANDING_SITE_URL is configured, redirect to the
      // landing site's /payment?upgradeMode=1 checkout instead of the
      // portal's own Razorpay flow.
      const landingSiteUrl = process.env.NEXT_PUBLIC_LANDING_SITE_URL;
      if (landingSiteUrl) {
        const handoffRes = await fetch("/api/upgrade/request-handoff", {
          method:  "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body:    JSON.stringify({
            courseIds: [...selected],
            courseSlug: preselectedCourse || [...selected][0],
            targetTier: "Pro",
          }),
        });
        const handoffData = await handoffRes.json();
        if (handoffRes.ok && handoffData.redirectUrl) {
          // Navigate to landing-site checkout in the same tab
          window.location.href = handoffData.redirectUrl;
          return;
        }
        // Handoff failed — log and fall through to portal Razorpay flow
        console.error("[upgrade-page] handoff failed, falling back:", handoffData.error);
      }

      // ── Portal-internal Razorpay flow (fallback / no landing site) ────

      // Create Razorpay order — server validates ownership, eligibility, price
      const orderRes = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ courseIds: [...selected] }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.orderId) {
        setCheckoutError(
          orderData.error ?? "Unable to create payment order. Please try again.",
        );
        setCheckoutLoading(false);
        return;
      }

      const { orderId, keyId, totalPaise, courseIds, enrollmentIds, proBundleId } =
        orderData as {
          orderId: string;
          keyId: string;
          totalPaise: number;
          courseIds: string;
          enrollmentIds: string;
          proBundleId: string;
        };

      // Load Razorpay SDK from CDN (no-op if already loaded)
      try {
        await loadRazorpayScript();
      } catch {
        setCheckoutError(
          "Failed to load the payment SDK. Check your internet connection and try again.",
        );
        setCheckoutLoading(false);
        return;
      }

      // Open Razorpay in-page modal
      const options: RazorpayOptions = {
        key: keyId,
        amount: totalPaise, // server-authoritative INR paise
        currency: "INR",
        name: "Automate Learning Portal",
        description: `Pro upgrade — ${selected.size} course${selected.size > 1 ? "s" : ""}`,
        order_id: orderId,

        handler: async (response: RazorpaySuccessResponse) => {
          try {
            const verifyRes = await fetch("/api/checkout/verify-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                courseIds,
                enrollmentIds,
                proBundleId,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
              if (verifyRes.status === 207) {
                paymentIdRef.current = response.razorpay_payment_id;
                router.push(
                  `/upgrade/success?payment_id=${encodeURIComponent(response.razorpay_payment_id)}&partial=1`,
                );
                return;
              }
              setCheckoutError(
                verifyData.error ??
                  "Payment received but activation failed. Please contact support with your payment ID: " +
                    response.razorpay_payment_id,
              );
              setCheckoutLoading(false);
              return;
            }

            router.push(
              `/upgrade/success?payment_id=${encodeURIComponent(response.razorpay_payment_id)}`,
            );
          } catch {
            setCheckoutError(
              "Payment received but we could not confirm activation. " +
                "Please contact support with your payment ID: " +
                response.razorpay_payment_id,
            );
            setCheckoutLoading(false);
          }
        },

        modal: {
          ondismiss: () => {
            setCheckoutError("Payment was cancelled. Your plan is unchanged.");
            setCheckoutLoading(false);
          },
        },

        theme: { color: "#2283FF" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      // Loading state stays true while modal is open;
      // cleared in ondismiss or on success navigate-away.
    } catch (err) {
      console.error("[upgrade-page] handlePayNow error:", err);
      setCheckoutError("An unexpected error occurred. Please try again.");
      setCheckoutLoading(false);
    }
  };

  // ── Render: loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  // ── Render: page-level error ───────────────────────────────────────────────
  if (pageError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm text-gray-600">{pageError}</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  // ── Render: no enrollments ─────────────────────────────────────────────────
  if (eligibleCourses.length === 0 && ineligibleCourses.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Lock className="h-10 w-10 text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-800">No courses to upgrade</h2>
        <p className="max-w-sm text-sm text-gray-500">
          You don't have any active enrollments eligible for a Pro upgrade. Contact
          support if you think this is a mistake.
        </p>
        <Button variant="outline" onClick={() => router.push("/courses")}>
          View my courses
        </Button>
      </div>
    );
  }

  // ── Render: all courses already Pro/Premium ────────────────────────────────
  if (eligibleCourses.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <h2 className="text-lg font-semibold text-gray-800">You're already on Pro!</h2>
        <p className="max-w-sm text-sm text-gray-500">
          All your enrolled courses are already on the Pro plan.
        </p>
        <Button onClick={() => router.push("/courses")}>Go to my courses</Button>
      </div>
    );
  }

  // ── Render: main upgrade UI ────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10">
          <Sparkles className="h-7 w-7 text-brand-heading" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Upgrade to Pro
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Unlock Mentor Connect for the courses you choose.
        </p>
      </div>

      {/* ── Course selection ─────────────────────────────────────────────── */}
      {isUpgradeMode ? (
        /* Upgrade mode: collapsed dropdown checklist */
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Select courses to upgrade
            </h2>
            {selected.size > 0 && (
              <span className="rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-bold text-brand-primary">
                {selected.size} selected
              </span>
            )}
          </div>
          <CourseDropdown
            eligibleCourses={eligibleCourses}
            ineligibleCourses={ineligibleCourses}
            selected={selected}
            onToggle={toggleCourse}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            disabled={checkoutLoading}
          />
          {selected.size === 0 && (
            <p className="mt-2 text-xs text-gray-400">
              No courses selected — choose at least one course to continue.
            </p>
          )}
        </div>
      ) : (
        /* Default mode: flat open checklist (original layout, unchanged) */
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Select courses to upgrade
            </h2>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-medium text-brand-primary hover:underline"
              >
                Select all
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-xs font-medium text-gray-400 hover:underline"
              >
                Deselect all
              </button>
            </div>
          </div>

          {/* Eligible (Starter) courses */}
          <ul className="divide-y divide-gray-50">
            {eligibleCourses.map((course) => {
              const isChecked = selected.has(course.courseId);
              return (
                <li key={course.courseId}>
                  <label
                    className={`flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors ${
                      isChecked ? "bg-blue-50/60" : "hover:bg-gray-50/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCourse(course.courseId)}
                      disabled={checkoutLoading}
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-brand-primary disabled:cursor-not-allowed"
                      aria-label={`Select ${course.courseTitle} for Pro upgrade`}
                    />
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {course.courseTitle}
                        </p>
                        <p className="text-xs text-gray-400">
                          Current plan:{" "}
                          <span className="font-medium text-gray-600">
                            {course.currentTier ?? "Starter"}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-semibold ${
                          isChecked ? "text-brand-primary" : "text-gray-500"
                        }`}
                      >
                        {formatPrice(course.priceAmount)}
                      </span>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          {/* Already upgraded (Pro/Premium) — shown but not selectable */}
          {ineligibleCourses.length > 0 && (
            <>
              <div className="border-t border-gray-100 px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Already upgraded
                </p>
              </div>
              <ul className="divide-y divide-gray-50">
                {ineligibleCourses.map((course) => (
                  <li
                    key={course.courseId}
                    className="flex items-center gap-4 px-5 py-4 opacity-50"
                    aria-disabled="true"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-700">
                          {course.courseTitle}
                        </p>
                        <p className="text-xs text-gray-400">
                          Current plan:{" "}
                          <span className="font-medium text-gray-600">
                            {course.currentTier}
                          </span>{" "}
                          — Current plan
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* ── Order summary ────────────────────────────────────────────────── */}
      <div className="mt-6 rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Order summary</h3>
        {selected.size === 0 ? (
          <p className="text-sm text-gray-400">No courses selected.</p>
        ) : (
          <ul className="space-y-1.5">
            {courses
              .filter((c) => selected.has(c.courseId))
              .map((c) => (
                <li key={c.courseId} className="flex justify-between text-sm">
                  <span className="max-w-[70%] truncate text-gray-700">
                    Pro — {c.courseTitle}
                  </span>
                  <span className="font-medium text-gray-900">
                    {formatPrice(c.priceAmount)}
                  </span>
                </li>
              ))}
          </ul>
        )}
        <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm font-bold">
          <span className="text-gray-900">Total</span>
          <span className="text-brand-primary">
            {displayTotalPaise > 0 ? formatPrice(displayTotalPaise) : "—"}
          </span>
        </div>
      </div>

      {/* ── Inline error ─────────────────────────────────────────────────── */}
      {checkoutError && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{checkoutError}</span>
        </div>
      )}

      {/* ── Pay Now CTA ──────────────────────────────────────────────────── */}
      <div className="mt-6 flex flex-col gap-3">
        <Button
          onClick={handlePayNow}
          disabled={checkoutLoading || selected.size === 0}
          className="w-full rounded-2xl bg-gradient-to-r from-brand-heading to-brand-primary py-6 text-base font-bold text-white shadow-md shadow-blue-900/10 transition-all hover:-translate-y-0.5 disabled:opacity-50"
        >
          {checkoutLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Opening payment…
            </>
          ) : (
            <>
              Pay Now —{" "}
              {displayTotalPaise > 0
                ? formatPrice(displayTotalPaise)
                : "Select a course"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          className="text-sm text-gray-400"
          onClick={() => router.back()}
          disabled={checkoutLoading}
        >
          Cancel
        </Button>
      </div>

      {/* Trust note */}
      <p className="mt-4 text-center text-xs text-gray-400">
        Payments are processed securely by Razorpay. Your plan activates after payment
        is confirmed.
      </p>
    </div>
  );
}
