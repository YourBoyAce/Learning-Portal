"use client";

/**
 * /upgrade/cancel — shown when the user closes the Razorpay payment modal
 * without completing payment (ondismiss callback navigates here when needed,
 * or the user can land here via a manual back-navigation).
 *
 * No access changes are made.  The user's existing plan is preserved.
 */

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function UpgradeCancelPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <XCircle className="h-10 w-10 text-gray-400" />
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Payment cancelled</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          You haven't been charged. Your current plan is unchanged.
          Come back anytime to upgrade to Pro.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          onClick={() => router.push("/upgrade")}
          className="rounded-2xl bg-gradient-to-r from-brand-heading to-brand-primary px-8 py-5 font-bold text-white"
        >
          Try again
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/courses")}
          className="rounded-2xl px-8 py-5"
        >
          Go to my courses
        </Button>
      </div>
    </div>
  );
}
