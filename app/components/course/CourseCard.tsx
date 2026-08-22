"use client";

import Image from "next/image";

import { ICONS } from "@/app/styles/icons";
import { PLACEHOLDER_IMAGE } from "@/lib/utils";

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
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isCompleted?: boolean;
  onCertificateClick?: () => void;
  assignedMentors?: { full_name: string }[];
  whatsappLink?: string | null;
};



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
  onClick,
  onEdit,
  onDelete,
  isCompleted = false,
  onCertificateClick,
  assignedMentors,
  whatsappLink,
}: CourseCardProps) {
  const isAdmin = variant === "admin";

  const contentBlock = (
    <>
      <div className="flex items-center justify-between gap-2.5 mb-2">
        <h3 className="font-bold text-lg text-copy-navy leading-snug line-clamp-2 flex-1 min-w-0">
          {title}
        </h3>
        {isAdmin && courseStatus ? (
          <CourseStatusBadge status={courseStatus} />
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
        </div>
      )}

      {courseStatus === "active" && (
        <div className="mb-4">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">Assigned Mentors</p>
          {assignedMentors && assignedMentors.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              {assignedMentors.map((mentor, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-md px-2 py-1">
                  <div className="w-4 h-4 rounded-full bg-brand-primary/10 flex items-center justify-center text-[8px] font-bold text-brand-primary">
                    {mentor.full_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-gray-700 truncate max-w-[100px]">{mentor.full_name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No mentors assigned</p>
          )}
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
      {whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-3.5 h-3.5 fill-green-600 shrink-0"
            aria-hidden="true"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.103 1.523 5.828L.057 23.077a.75.75 0 0 0 .921.899l5.444-1.434A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.497-5.24-1.367l-.374-.215-3.893 1.026 1.05-3.794-.235-.386A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
          </svg>
          Join WhatsApp Community
        </a>
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
