"use client";

/**
 * /upgrade/success
 *
 * Reached after a successful Razorpay payment + server-side verification.
 *
 * Unlike the old Stripe flow (which polled for async webhook activation),
 * the Razorpay flow synchronously verifies and activates Pro inside
 * /api/checkout/verify-payment before the browser navigates here.
 * So in the normal path, Pro is already active when this page loads.
 *
 * We do a single quick tier check on mount and immediately show either:
 *   "activated"  — Supabase already shows Pro (normal case)
 *   "pending"    — activation hasn't landed yet (webhook-only path / race)
 *   "partial"    — ?partial=1 was set by the upgrade page (some courses failed)
 *
 * Query params
 *   ?payment_id=<razorpay_payment_id>   shown as the reference for support
 *   ?partial=1                           set when some courses failed activation
 */

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { getUserTier } from "@/app/actions/tier";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

type ActivationState = "checking" | "activated" | "partial" | "pending";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS        = 10; // 30 s max — activation should already be done

export default function UpgradeSuccessPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const paymentId    = searchParams.get("payment_id") ?? "";
  const isPartial    = searchParams.get("partial") === "1";

  const [state, setState]   = useState<ActivationState>(isPartial ? "partial" : "checking");
  const pollCount           = useRef(0);
  const intervalRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Partial activation: don't poll — show the partial state immediately.
    if (isPartial) return;

    intervalRef.current = setInterval(async () => {
      pollCount.current += 1;

      if (pollCount.current > MAX_POLLS) {
        clearInterval(intervalRef.current!);
        setState("pending");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          clearInterval(intervalRef.current!);
          router.replace("/login");
          return;
        }

        // Refresh the JWT so getCourseUserTier picks up the latest DB state
        const { data: refreshed } = await supabase.auth.refreshSession();
        const token = refreshed.session?.access_token ?? session.access_token;

        const tier = await getUserTier(token);
        if (tier === "Pro" || tier === "Premium") {
          clearInterval(intervalRef.current!);
          setState("activated");
        }
      } catch {
        // Ignore transient errors; keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPartial, router]);

  // ── "checking" splash (brief spinner before first poll result) ────────────
  if (state === "checking") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-brand-primary" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Confirming your upgrade…</h1>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Verifying your payment and activating Pro access. This takes just a moment.
          </p>
        </div>
      </div>
    );
  }

  // ── Fully activated ────────────────────────────────────────────────────────
  if (state === "activated") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">You're on Pro!</h1>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Your selected courses have been upgraded to the Pro plan.
            Labs, Quizzes, and Mentorship are now unlocked.
          </p>
          {paymentId && (
            <p className="mt-3 text-xs text-gray-400">
              Payment reference:{" "}
              <span className="font-mono text-gray-500">{paymentId}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => router.push("/courses")}
            className="rounded-2xl bg-gradient-to-r from-brand-heading to-brand-primary px-8 py-5 font-bold text-white"
          >
            Go to my courses
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="rounded-2xl px-8 py-5"
          >
            Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ── Partial activation (some courses failed) ──────────────────────────────
  if (state === "partial") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <AlertCircle className="h-10 w-10 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Payment successful — partial activation
          </h1>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Your payment was received, but one or more courses could not be
            upgraded automatically. Our team will activate the remaining courses
            shortly. Please contact support if this isn't resolved within 24 hours.
          </p>
          {paymentId && (
            <p className="mt-3 text-xs text-gray-400">
              Payment reference:{" "}
              <span className="font-mono text-gray-500">{paymentId}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => router.push("/courses")}
            className="rounded-2xl bg-gradient-to-r from-brand-heading to-brand-primary px-8 py-5 font-bold text-white"
          >
            Go to my courses
          </Button>
        </div>
      </div>
    );
  }

  // ── Pending (webhook delayed or race with verify-payment) ─────────────────
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <AlertCircle className="h-10 w-10 text-amber-600" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Payment successful — activation pending
        </h1>
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          Your payment was received but Pro access hasn't shown up yet. This is
          usually resolved within a few minutes. Please refresh your courses page
          or contact support if the issue persists.
        </p>
        {paymentId && (
          <p className="mt-3 text-xs text-gray-400">
            Payment reference:{" "}
            <span className="font-mono text-gray-500">{paymentId}</span>
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          onClick={() => router.push("/courses")}
          className="rounded-2xl bg-gradient-to-r from-brand-heading to-brand-primary px-8 py-5 font-bold text-white"
        >
          Go to my courses
        </Button>
        <Button
          variant="outline"
          onClick={() => { setState("checking"); pollCount.current = 0; }}
          className="rounded-2xl px-8 py-5"
        >
          Check again
        </Button>
      </div>
    </div>
  );
}
