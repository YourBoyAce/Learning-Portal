"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/app/lib/supabase";

export type UserTier = "Starter" | "Pro" | "Premium" | null;

export type Feature = "Videos" | "Chat" | "Ratings" | "Labs" | "Quizzes" | "Webinars" | "Mentorship";

const TIER_FEATURES: Record<NonNullable<UserTier>, Feature[]> = {
  Starter: ["Videos", "Chat", "Ratings"],
  Pro: ["Videos", "Chat", "Ratings", "Labs", "Quizzes", "Mentorship"],
  Premium: ["Videos", "Chat", "Ratings", "Labs", "Quizzes", "Webinars", "Mentorship"],
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
        if (session.user.email === "demouser@gmail.com" || session.user.email === "user@example.com" || session.user.email === "premium@gmail.com") {
          if (mounted) {
            setTier("Premium");
            setIsLoading(false);
          }
          return;
        }

        // Query the profiles table to see if user has instructor or admin role
        
        if (!session) {
          if (mounted) setIsLoading(false);
          return;
        }

        // Call the secure server action to bypass RLS on bundles
        const { getUserTier } = await import('@/app/actions/tier');
        const resolvedTier = await getUserTier(session.access_token);
        
        if (mounted && resolvedTier) {
          setTier(resolvedTier);
        }

        if (mounted) {
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

/**
 * Course-aware permission hook.
 *
 * When `courseId` is provided the tier is resolved strictly for that course
 * (one course = one plan). Buying Course B on Pro does NOT upgrade Course A.
 *
 * When `courseId` is omitted the hook falls back to the global max-tier lookup
 * (same behaviour as the legacy `useSecurityGatedData` hook) — suitable for
 * pages without a course context (dashboard, profile, etc.).
 */
export function useCoursePermissions(courseId?: string) {
  const [tier, setTier] = useState<UserTier>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchTier() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (mounted) setIsLoading(false);
          return;
        }

        // Demo/test override — always Premium regardless of course
        const demoEmails = ["demouser@gmail.com", "user@example.com", "premium@gmail.com"];
        if (demoEmails.includes(session.user.email ?? "")) {
          if (mounted) {
            setTier("Premium");
            setIsLoading(false);
          }
          return;
        }

        let resolvedTier: UserTier;

        if (courseId) {
          // Course-specific tier: scoped to (user, course) pair
          const { getCourseUserTier } = await import('@/app/actions/tier');
          resolvedTier = await getCourseUserTier(session.access_token, courseId);
        } else {
          // Global fallback: highest tier across all enrollments
          const { getUserTier } = await import('@/app/actions/tier');
          resolvedTier = await getUserTier(session.access_token);
        }

        if (mounted) {
          setTier(resolvedTier);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error evaluating course permissions:", err);
        if (mounted) setIsLoading(false);
      }
    }

    fetchTier();

    return () => {
      mounted = false;
    };
  // Re-run if courseId changes (e.g., user navigates between courses)
  }, [courseId]);

  const canAccess = useCallback(
    (feature: Feature): boolean => {
      if (!tier) return false;
      return TIER_FEATURES[tier].includes(feature);
    },
    [tier],
  );

  return { tier, isLoading, canAccess };
}
