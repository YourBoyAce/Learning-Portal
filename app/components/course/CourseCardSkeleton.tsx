import { Skeleton } from "@/components/ui/skeleton";

interface CourseCardSkeletonProps {
  variant?: "user" | "admin";
}

/**
 * Mirrors the dimensions and layout of CourseCard so there's
 * no layout shift when real cards load in.
 */
export default function CourseCardSkeleton({ variant = "user" }: CourseCardSkeletonProps) {
  return (
    <div className="h-full min-h-[370px] flex flex-col w-full shadow-sm rounded-xl bg-white border border-gray-100 overflow-hidden">
      {/* Thumbnail — 16/9 aspect ratio */}
      <Skeleton className="w-full aspect-[16/9] rounded-none" />

      {/* Body */}
      <div className="flex-1 flex flex-col px-6 pt-4 pb-5 gap-3">
        {/* Category badge + title row */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full shrink-0" />
        </div>

        {/* Description lines */}
        <div className="space-y-2 mb-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        {variant === "user" ? (
          <>
            {/* Progress label row */}
            <div className="mt-auto flex items-center justify-between mb-1">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-8" />
            </div>

            {/* Progress bar */}
            <Skeleton className="h-2 w-full rounded-full" />

            {/* Status text */}
            <Skeleton className="h-3 w-28" />
          </>
        ) : (
          <div className="mt-auto border-t border-gray-100 pt-4">
            {/* Batch Name & Schedule Badges */}
            <div className="flex items-center justify-between gap-2.5 mb-3 min-h-7">
              <Skeleton className="h-5 w-1/2" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>

            {/* Assigned Mentors */}
            <div className="mb-4">
              <Skeleton className="h-3 w-24 mb-1.5" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-24 rounded-md" />
                <Skeleton className="h-6 w-24 rounded-md" />
              </div>
            </div>

            {/* Edit / Delete Buttons */}
            <div className="flex gap-2">
              <Skeleton className="h-8 flex-1 rounded-lg" />
              <Skeleton className="h-8 flex-1 rounded-lg" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
