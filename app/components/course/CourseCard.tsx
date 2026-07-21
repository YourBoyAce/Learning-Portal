"use client";

import Image from "next/image";

import { ICONS } from "@/app/styles/icons";
import { PLACEHOLDER_IMAGE } from "@/lib/utils";

type ScheduleType = "weekday" | "weekend";
type CourseStatus = "active" | "upcoming";

type CourseCardProps = {
  id: string | number;
  title: string;
  description?: string;
  thumbnail?: string;
  category?: string;
  duration?: string;
  progressPercentage?: number;
  showProgress?: boolean;
  variant?: "user" | "admin";
  courseStatus?: CourseStatus;
  batchName?: string | null;
  batchScheduleTypes?: ScheduleType[];
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isCompleted?: boolean;
  onCertificateClick?: () => void;
};


function ScheduleBadge({ type }: { type: ScheduleType }) {
  const isWeekend = type === "weekend";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border leading-none ${
        isWeekend
          ? "bg-purple-50 text-purple-800 border-purple-100"
          : "bg-amber-50 text-amber-900 border-amber-100"
      }`}
    >
      {isWeekend ? "Weekend" : "Weekday"}
    </span>
  );
}

function CourseStatusBadge({ status }: { status: CourseStatus }) {
  const isUpcoming = status === "upcoming";

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap shrink-0 ${
        isUpcoming
          ? "bg-amber-50 text-amber-800 border border-amber-100"
          : "bg-brand-primary/10 text-brand-primary border border-brand-primary/15"
      }`}
    >
      {isUpcoming ? "Upcoming" : "Active"}
    </span>
  );
}

export default function CourseCard({
  title,
  description,
  thumbnail,
  category,
  progressPercentage = 0,
  showProgress = false,
  variant = "user",
  courseStatus,
  batchName,
  batchScheduleTypes = [],
  onClick,
  onEdit,
  onDelete,
  isCompleted = false,
  onCertificateClick,
}: CourseCardProps) {
  const isAdmin = variant === "admin";

  const showScheduleInTitle =
    isAdmin && batchName === undefined && batchScheduleTypes.length > 0;
  const showScheduleInFooter =
    batchName !== undefined && batchScheduleTypes.length > 0;

  const scheduleBadges = (
    <div className="flex items-center gap-1.5 shrink-0">
      {batchScheduleTypes.map((type) => (
        <ScheduleBadge key={type} type={type} />
      ))}
    </div>
  );

  const contentBlock = (
    <>
      <div className="flex items-center justify-between gap-2.5 mb-2">
        <h3 className="font-bold text-lg text-copy-navy leading-snug line-clamp-2 flex-1 min-w-0">
          {title}
        </h3>
        {isAdmin && courseStatus ? (
          <CourseStatusBadge status={courseStatus} />
        ) : showScheduleInTitle ? (
          scheduleBadges
        ) : (
          !isAdmin &&
          category && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap bg-brand-primary/10 text-brand-primary">
              {category}
            </span>
          )
        )}
      </div>
      <p
        className={`line-clamp-2 mb-4 ${
          isAdmin
            ? "text-sm font-medium text-gray-600 leading-relaxed"
            : "card-description"
        }`}
      >
        {description ||
          (isAdmin
            ? "No description available."
            : "Master these concepts with our structured learning path.")}
      </p>
    </>
  );

  const adminFooter = (
    <div className="mt-auto border-t border-gray-100 pt-4">
      {batchName !== undefined && (
        <div className="flex items-center gap-2.5 mb-3 min-h-7">
          <p className="text-base font-bold text-gray-950 truncate min-w-0 flex-1 leading-tight">
            {batchName || "No batch assigned"}
          </p>
          {showScheduleInFooter && scheduleBadges}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          className="flex-1 py-1 rounded-lg bg-brand-primary/10 text-brand-primary text-sm font-medium hover:bg-brand-primary/15 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="flex-1 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );

  const userFooter = showProgress && (
    <>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 tracking-wide">
          Progress
        </span>
        <span className="text-xs font-bold text-copy-navy">{progressPercentage}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full mb-2">
        <div
          className="h-2 rounded-full transition-all"
          style={{
            width: `${progressPercentage}%`,
            background:
              "linear-gradient(to right, var(--color-primary), var(--color-success))",
          }}
        />
      </div>
      <span className="text-xs text-gray-400 mt-auto">
        {progressPercentage === 0
          ? "Start Learning"
          : progressPercentage < 90
            ? "Last accessed recently"
            : "Nearing Completion"}
      </span>
      {isCompleted && onCertificateClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCertificateClick();
          }}
          className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-heading hover:bg-brand-primary/15 transition-colors"
        >
          <Image src={ICONS.CHAMPION} alt="Certificate" width={14} height={14} />
          Download Certificate
        </button>
      )}
    </>
  );

  return (
    <div
      onClick={onClick}
      className="h-full min-h-[370px] flex items-stretch w-full shadow-sm hover:shadow-md transition-shadow duration-300 rounded-xl bg-white border border-gray-100 cursor-pointer"
    >
      <div className="flex flex-col w-full h-full rounded-xl overflow-hidden">
        <div className="relative w-full aspect-[16/9] overflow-hidden">
          <img
            src={thumbnail || PLACEHOLDER_IMAGE}
            alt={title}
            className="w-full h-full object-cover object-center"
          />
        </div>

        <div className="flex-1 flex flex-col px-6 pt-4 pb-5">
          {contentBlock}
          {isAdmin ? adminFooter : userFooter}
        </div>
      </div>
    </div>
  );
}
