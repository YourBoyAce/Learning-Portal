import type { MentionablePerson } from "@/app/actions/community-chat";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolves mentioned user IDs from message content against mentionable people.
 * Matches @Full Name patterns (longest names first to avoid partial matches).
 */
export function resolveMentionedUserIds(
  content: string,
  people: MentionablePerson[],
): string[] {
  const mentioned: string[] = [];
  const sorted = [...people].sort(
    (a, b) => b.full_name.length - a.full_name.length,
  );

  for (const person of sorted) {
    const pattern = new RegExp(
      `@${escapeRegExp(person.full_name)}(?:\\s|$|[.,!?])`,
      "i",
    );
    if (pattern.test(content)) {
      mentioned.push(person.id);
    }
  }

  return Array.from(new Set(mentioned));
}
