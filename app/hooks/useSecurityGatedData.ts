"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/app/lib/supabase";

export type UserTier = "Starter" | "Pro" | "Premium" | null;

export type Feature = "Videos" | "Chat" | "Ratings" | "Labs" | "Quizzes" | "Webinars";

const TIER_FEATURES: Record<NonNullable<UserTier>, Feature[]> = {
  Starter: ["Videos", "Chat", "Ratings"],
  Pro: ["Videos", "Chat", "Ratings", "Labs", "Quizzes"],
  Premium: ["Videos", "Chat", "Ratings", "Labs", "Quizzes", "Webinars"],
};

export function useSecurityGatedData() {
  const [tier, setTier] = useState<UserTier>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchUserTier() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (mounted) setIsLoading(false);
          return;
        }

        // Specifically grant Premium access to demouser@gmail.com and user@example.com for feature testing
        if (session.user.email === "demouser@gmail.com" || session.user.email === "user@example.com") {
          if (mounted) {
            setTier("Premium");
            setIsLoading(false);
          }
          return;
        }

        // Query the profiles table to see if user has instructor or admin role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (profile?.role?.toLowerCase() === "instructor" || profile?.role?.toLowerCase() === "admin") {
          if (mounted) {
            setTier("Premium");
            setIsLoading(false);
          }
          return;
        }

        // Query the phase2 schema for active enrollments
        const { data: enrollment, error } = await supabase
          .schema("phase2")
          .from("enrollments")
          .select("*, bundles(bundle_name)")
          .eq("user_id", session.user.id)
          .eq("status", "active")
          .single();

        if (error || !enrollment) {
          console.warn("Could not fetch tier from phase-2.enrollments", error);
          if (mounted) setIsLoading(false);
          return;
        }

        // Assuming bundle_name is directly on the bundle object
        const bundleName = (enrollment.bundles as any)?.bundle_name || "Starter"; // Fallback to Starter
        
        let resolvedTier: UserTier = "Starter";
        if (typeof bundleName === "string") {
          const lowerName = bundleName.toLowerCase();
          if (lowerName.includes("premium")) resolvedTier = "Premium";
          else if (lowerName.includes("pro")) resolvedTier = "Pro";
        }

        if (mounted) {
          setTier(resolvedTier);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error evaluating user tier:", err);
        if (mounted) setIsLoading(false);
      }
    }

    fetchUserTier();

    return () => {
      mounted = false;
    };
  }, []);

  const canAccess = useCallback(
    (feature: Feature): boolean => {
      if (!tier) return false; // Default to locked if tier is not yet loaded or user is invalid
      return TIER_FEATURES[tier].includes(feature);
    },
    [tier]
  );

  const fetchGatedData = useCallback(
    async (tableName: string, requiredFeature: Feature, queryBuilder?: (q: any) => any) => {
      if (!tier || !canAccess(requiredFeature)) {
        // Return empty or throw access denied
        return { data: null, error: new Error("Access Denied: Your current tier does not permit accessing this content.") };
      }

      try {
        let query = supabase.from(tableName).select("*");
        if (queryBuilder) {
          query = queryBuilder(query);
        }
        
        const { data, error } = await query;
        return { data, error };
      } catch (error) {
        return { data: null, error };
      }
    },
    [tier, canAccess]
  );

  return { tier, isLoading, canAccess, fetchGatedData };
}
