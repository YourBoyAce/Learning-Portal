"use client";

import React from "react";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpgradeRequiredProps {
  title?: string;
  description?: string;
  requiredTier?: "Starter" | "Pro" | "Premium";
}

export function UpgradeRequired({
  title = "Premium Feature Locked",
  description = "This advanced learning tool is reserved for members of higher tiers. Upgrade today to unlock full curriculum access, live cohort sessions, interactive quizzes, and more.",
  requiredTier = "Pro",
}: UpgradeRequiredProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:p-12 max-w-xl mx-auto my-8">
      {/* Decorative gradients */}
      <div className="absolute -left-16 -top-16 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute -right-16 -bottom-16 h-32 w-32 rounded-full bg-purple-500/10 blur-3xl" />

      {/* Lock Icon Section */}
      <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 text-brand-primary border border-blue-100/50 shadow-inner">
        <Lock className="h-9 w-9 text-brand-heading animate-pulse" />
        <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white shadow-md">
          <Sparkles className="h-3 w-3" />
        </div>
      </div>

      {/* Content */}
      <h3 className="mb-3 font-sans text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
        {title}
      </h3>
      
      {/* Required Tier Badge */}
      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 uppercase tracking-wider">
        Requires {requiredTier} Tier
      </div>

      <p className="mx-auto mb-8 max-w-sm text-sm leading-relaxed text-gray-500 font-medium">
        {description}
      </p>

      {/* Action Button */}
      <Button
        asChild
        className="w-full sm:w-auto px-8 py-6 rounded-2xl bg-gradient-to-r from-brand-heading to-brand-primary hover:from-brand-heading-hover hover:to-brand-primary/95 text-white font-bold tracking-wide shadow-md shadow-blue-900/10 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
      >
        <a href="http://localhost:3000/plans" target="_blank" rel="noopener noreferrer">
          Upgrade My Plan <ArrowRight className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}
