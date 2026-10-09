"use client";

import React, { useState, useEffect } from "react";
import { Lock, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/app/lib/supabase";

interface UpgradeRequiredProps {
  title?: string;
  description?: string;
  requiredTier?: "Starter" | "Pro" | "Premium";
  courseSlug?: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  compact?: boolean;
}

export function UpgradeRequired({
  title = "Premium Feature Locked",
  description = "This advanced learning tool is reserved for members of higher tiers. Upgrade today to unlock full curriculum access, live cohort sessions, interactive quizzes, and more.",
  requiredTier = "Pro",
  courseSlug,
  userEmail: propEmail,
  userName: propName,
  userPhone: propPhone,
  compact = false,
}: UpgradeRequiredProps) {
  const [email, setEmail]   = useState(propEmail || "");
  const [name, setName]     = useState(propName || "");
  const [phone, setPhone]   = useState(propPhone || "");
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");

  // Keep state in sync if props change
  useEffect(() => {
    if (propEmail) setEmail(propEmail);
    if (propName)  setName(propName);
    if (propPhone) setPhone(propPhone);
  }, [propEmail, propName, propPhone]);

  useEffect(() => {
    async function fetchUser() {
      if (propEmail && propName && propPhone) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!propEmail) setEmail(user.email || "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .single();
      if (!propName)  setName(profile?.full_name  || user.user_metadata?.full_name || "");
      if (!propPhone) setPhone(profile?.phone      || user.user_metadata?.phone     || "");
    }
    fetchUser();
  }, [propEmail, propName, propPhone]);

  // Whether the landing-site handoff path is enabled
  const landingUrl =
    (process.env.NEXT_PUBLIC_LANDING_SITE_URL ?? "").replace(/\/$/, "");
  const useLandingHandoff = Boolean(landingUrl);

  // Internal fallback URL (used when landing site is not configured, or as a
  // backup if the handoff request fails - e.g. when buying for the first time).
  const fallbackUrl = (() => {
    const params = new URLSearchParams();
    if (courseSlug) params.set("course", courseSlug);
    params.set("planName", requiredTier);
    if (email) params.set("email", email);
    if (name) params.set("name", name);
    if (phone) params.set("phone", phone);
    
    if (landingUrl) {
      return `${landingUrl}/payment?${params.toString()}`;
    }
    
    // Fallback if no landing URL
    return `/upgrade?${params.toString()}`;
  })();

  const handleUpgradeClick = async () => {
    setError("");

    if (!useLandingHandoff) {
      // No landing site configured — use internal /upgrade page
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Not logged in — redirect to login then back to upgrade
        window.location.href = "/login?next=/upgrade?mode=upgrade";
        return;
      }

      const res = await fetch("/api/upgrade/request-handoff", {
        method:  "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ courseSlug, targetTier: requiredTier }),
      });
      const data = await res.json();

      if (!res.ok || !data.redirectUrl) {
        console.error("[UpgradeRequired] handoff failed:", data.error);
        // Graceful fallback to internal upgrade page
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
        return;
      }

      // Redirect to landing-site checkout in the same tab
      window.location.href = data.redirectUrl;
    } catch (err) {
      console.error("[UpgradeRequired] handoff error:", err);
      setError("Could not start the upgrade. Please try again.");
      // Still fall back so the user is not stuck
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`relative overflow-hidden border border-gray-100 bg-white text-center transition-all duration-300 hover:shadow-xl mx-auto ${compact ? "rounded-xl p-6 shadow-sm w-full h-full flex flex-col justify-center items-center" : "rounded-3xl p-6 sm:p-12 max-w-xl my-8 shadow-lg"}`}>
      {/* Decorative gradients */}
      <div className="absolute -left-16 -top-16 h-28 w-32 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute -right-16 -bottom-16 h-32 w-32 rounded-full bg-purple-500/10 blur-3xl" />

      {/* Lock icon */}
      <div className="relative mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 text-brand-primary border border-blue-100/50 shadow-inner">
        <Lock className="h-5 w-5 text-brand-heading animate-pulse" />
        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white shadow-md">
          <Sparkles className="h-3 w-3" />
        </div>
      </div>

      {/* Content */}
      <h3 className="mb-3 font-sans text-md font-bold tracking-tight text-gray-900 sm:text-xl">
        {title}
      </h3>

      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 tracking-wider">
        Requires {requiredTier} Tier
      </div>

      {description && (
        <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-gray-500 font-medium">
          {description}
        </p>
      )}

      {error && (
        <p className="mb-4 text-xs text-red-500">{error}</p>
      )}

      {/* Action button — calls request-handoff when landing site is configured */}
      <Button
        onClick={handleUpgradeClick}
        disabled={busy}
        className="w-[50%] sm:w-auto px-6 py-4 rounded-2xl bg-gradient-to-r from-brand-heading to-brand-primary hover:from-brand-heading-hover hover:to-brand-primary/95 text-white font-bold tracking-wide shadow-md shadow-blue-900/10 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting upgrade…
          </>
        ) : (
          <>
            Upgrade My Plan <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
