import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the dimensions and layout of CourseCard so there's
 * no layout shift when real cards load in.
 */
export default function CourseCardSkeleton() {
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

        {/* Progress label row */}
        <div className="mt-auto flex items-center justify-between mb-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-8" />
        </div>

        {/* Progress bar */}
        <Skeleton className="h-2 w-full rounded-full" />

        {/* Status text */}
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}
