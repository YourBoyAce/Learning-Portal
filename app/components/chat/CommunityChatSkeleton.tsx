import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the layout of MessageBubble.
 * isOwn=true  → right-aligned (current user)
 * isOwn=false → left-aligned (other user)
 */
function MessageBubbleSkeleton({ isOwn }: { isOwn: boolean }) {
  return (
    <div
      className={`flex items-start gap-2.5 ${
        isOwn ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar circle */}
      <Skeleton className="w-7 h-7 rounded-full shrink-0 mt-0.5" />

      <div
        className={`flex flex-col gap-1.5 max-w-[78%] ${
          isOwn ? "items-end" : "items-start"
        }`}
      >
        {/* Name label */}
        <Skeleton className="h-3 w-20" />

        {/* Message bubble — varied widths for realism */}
        <Skeleton
          className={`h-9 rounded-2xl ${
            isOwn ? "w-48 rounded-tr-sm" : "w-56 rounded-tl-sm"
          }`}
        />
      </div>
    </div>
  );
}

/**
 * Full chat skeleton: shows one "other user" bubble and one
 * "current user" bubble, mirroring the real chat layout.
 */
export default function CommunityChatSkeleton() {
  return (
    <div className="flex-1 flex flex-col px-4 py-3 space-y-4 overflow-hidden">
      {/* Other user message (left-aligned) */}
      <MessageBubbleSkeleton isOwn={false} />

      {/* Current user message (right-aligned) */}
      <MessageBubbleSkeleton isOwn={true} />
    </div>
  );
}
