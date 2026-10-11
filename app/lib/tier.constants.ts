export type UserTier = "Starter" | "Pro" | "Premium" | null;

export type Feature =
  | "Videos"
  | "Chat"
  | "Ratings"
  | "Labs"
  | "Quizzes"
  | "Webinars"
  | "Mentorship";

export const TIER_HIERARCHY: Record<NonNullable<UserTier>, number> = {
  Starter: 1,
  Pro: 2,
  Premium: 3,
};

export const TIER_FEATURES: Record<NonNullable<UserTier>, Feature[]> = {
  Starter: ["Videos", "Chat", "Ratings", "Labs", "Quizzes"],
  Pro: ["Videos", "Chat", "Ratings", "Labs", "Quizzes", "Mentorship"],
  Premium: [
    "Videos",
    "Chat",
    "Ratings",
    "Labs",
    "Quizzes",
    "Webinars",
    "Mentorship",
  ],
};

export function normalizeTier(tier: UserTier): number {
  if (!tier) return 0;
  return TIER_HIERARCHY[tier] ?? 0;
}
