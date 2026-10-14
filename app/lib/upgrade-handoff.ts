"use client";

import { supabase } from "@/app/lib/supabase";

export interface InitiateUpgradeOptions {
  targetTier?: "Starter" | "Pro" | "Premium";
  courseSlug?: string;
  courseIds?: (string | number)[];
  userEmail?: string;
  userName?: string;
  userPhone?: string;
}

/**
 * Initiates the Pro/Premium upgrade flow matching the landing site handoff
 * architecture used across the learning portal.
 */
export async function initiateUpgradeFlow({
  targetTier = "Pro",
  courseSlug,
  courseIds,
  userEmail,
  userName,
  userPhone,
}: InitiateUpgradeOptions = {}): Promise<{ success: boolean; redirectUrl?: string; error?: string }> {
  const landingUrl = (process.env.NEXT_PUBLIC_LANDING_SITE_URL ?? "").replace(/\/$/, "");
  const useLandingHandoff = Boolean(landingUrl);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "/login?next=/upgrade?mode=upgrade";
    return { success: false, error: "Not logged in" };
  }

  // Resolve user info if not passed
  let email = userEmail || session.user?.email || "";
  let name = userName || session.user?.user_metadata?.full_name || "";
  let phone = userPhone || session.user?.user_metadata?.phone || "";

  if (!name || !phone) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!name) name = profile?.full_name || "";
      if (!phone) phone = profile?.phone || "";
    } catch (e) {
      // Ignore profile resolution errors
    }
  }

  // Fallback URL (used if landing site is not configured, or if handoff fails)
  const fallbackUrl = (() => {
    const params = new URLSearchParams();
    if (courseSlug) params.set("course", courseSlug);
    params.set("planName", targetTier);
    if (email) params.set("email", email);
    if (name) params.set("name", name);
    if (phone) params.set("phone", phone);

    if (landingUrl) {
      return `${landingUrl}/payment?${params.toString()}`;
    }
    return `/upgrade?${params.toString()}`;
  })();

  if (!useLandingHandoff) {
    window.location.href = fallbackUrl;
    return { success: true, redirectUrl: fallbackUrl };
  }

  try {
    const res = await fetch("/api/upgrade/request-handoff", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courseSlug,
        courseIds,
        targetTier,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.redirectUrl) {
      console.warn("[initiateUpgradeFlow] handoff API failed, falling back to direct checkout:", data?.error);
      window.location.href = fallbackUrl;
      return { success: true, redirectUrl: fallbackUrl };
    }

    // Navigate to landing site checkout in the same tab
    window.location.href = data.redirectUrl;
    return { success: true, redirectUrl: data.redirectUrl };
  } catch (err: any) {
    console.error("[initiateUpgradeFlow] error:", err);
    window.location.href = fallbackUrl;
    return { success: true, redirectUrl: fallbackUrl };
  }
}
