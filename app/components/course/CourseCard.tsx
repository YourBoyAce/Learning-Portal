"use client";

import { CheckCircle, Pencil, Trash2, PlayCircle } from "lucide-react";

type CourseCardProps = {
  id: string | number;
  title: string;
  description?: string;
  thumbnail?: string;
  category?: string;
  duration?: string;

  progressPercentage?: number;
  showProgress?: boolean;

  variant?: "compact" | "detailed" | "admin";

  createdAt?: string;

  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085";

export default function CourseCard({
  title,
  description,
  thumbnail,
  category,
  duration,

  progressPercentage = 0,
  showProgress = false,

  variant = "compact",

  createdAt,

  onClick,
  onEdit,
  onDelete,
}: CourseCardProps) {
  const isAdmin = variant === "admin";
  const isDetailed = variant === "detailed";

  /*
    =========================================================
    ADMIN VARIANT
    =========================================================
  */

  if (isAdmin) {
    return (
      <div
        onClick={onClick}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-gray-200 transition-all duration-300 group flex flex-col overflow-hidden relative cursor-pointer"
      >
        {/* Header */}
        <div className="h-36 bg-gradient-to-br from-[#2283FF] to-[#2563eb] relative overflow-hidden">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
          )}

          {/* Status Badge */}
          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow-sm border border-white/10">
              <CheckCircle className="w-3 h-3" />
              Active
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 flex flex-col">
          <h4 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-[#2283FF] transition-colors leading-tight">
            {title}
          </h4>

          <p className="text-sm text-gray-500 line-clamp-2 mb-6 flex-1">
            {description || "No description available."}
          </p>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between mt-auto">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              {createdAt
                ? new Date(createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Recently Added"}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#2283FF] hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit Course"
              >
                <Pencil className="w-4 h-4" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Course"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /*
    =========================================================
    DETAILED VARIANT (MY LEARNING)
    =========================================================
  */

  if (isDetailed) {
    return (
      <div
        onClick={onClick}
        className="group bg-white rounded-[1rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-[#2283FF]/8 transition-all duration-500 overflow-hidden flex flex-col cursor-pointer"
      >
        {/* Thumbnail */}
        <div className="relative w-full h-48 sm:h-64 overflow-hidden">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={title}
              className="w-full h-full object-contain p-2 transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#2283FF] via-[#1a6fdb] to-[#0f172a]" />
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          {/* Play Button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/30 shadow-2xl group-hover:scale-110 transition-transform duration-300">
              <PlayCircle
                className="text-white"
                size={32}
                strokeWidth={1.5}
              />
            </div>
          </div>

          {/* Category Badge */}
          {category && (
            <span className="absolute top-4 left-4 bg-white/15 backdrop-blur-xl text-white text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-full border border-white/20">
              {category}
            </span>
          )}

          {/* Duration Badge */}
          {duration && (
            <span className="absolute top-4 right-4 bg-black/50 backdrop-blur-xl text-white text-[10px] font-bold px-3 py-1.5 rounded-full border border-white/10">
              {duration}
            </span>
          )}

          {/* Progress Circle */}
          {showProgress && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-xl border border-white/20 flex items-center justify-center">
                <span className="text-white text-[11px] font-black">
                  {progressPercentage}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col p-6 pt-5">
          <h3 className="text-xl font-bold text-[#0f172a] group-hover:text-[#2283FF] transition-colors leading-snug mb-2">
            {title}
          </h3>

          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-6">
            {description}
          </p>

          {/* Progress */}
          {showProgress && (
            <div className="mt-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Progress
                </span>

                <span className="text-xs font-black text-[#2283FF]">
                  {progressPercentage}%
                </span>
              </div>

              <div className="w-full bg-gray-50 rounded-full h-2.5 overflow-hidden border border-gray-100 p-0.5">
                <div
                  className="bg-gradient-to-r from-[#2283FF] via-[#2c6cb0] to-[#2283FF] bg-[length:200%_auto] animate-gradient-shift h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${progressPercentage}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /*
    =========================================================
    COMPACT VARIANT (DASHBOARD)
    =========================================================
  */

  return (
    <div
      onClick={onClick}
      className="group bg-white border border-gray-100 rounded-[2.5rem] p-6 flex flex-col md:flex-row gap-8 hover:shadow-2xl hover:shadow-[#2283FF]/10 transition-all duration-500 cursor-pointer relative overflow-hidden"
    >
      {/* Decorative Blur */}
      <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-[#2283FF]/5 rounded-full blur-3xl group-hover:bg-[#2283FF]/10 transition-colors" />

      {/* Thumbnail */}
      <div className="w-full md:w-48 h-40 rounded-[2rem] overflow-hidden shrink-0 shadow-xl shadow-black/5 relative group-hover:scale-[1.02] transition-transform duration-500">
        <img
          src={thumbnail || PLACEHOLDER_IMAGE}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          alt={title}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between py-2">
        <div>
          {/* Category */}
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 bg-[#2283FF]/5 text-[#2283FF] text-[10px] font-black rounded-full uppercase tracking-widest border border-[#2283FF]/10">
              {category || "General Curriculum"}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight group-hover:text-[#2283FF] transition-colors">
            {title}
          </h3>

          {/* Description */}
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed line-clamp-2 mt-2">
            {description ||
              "Master these concepts with our structured learning path."}
          </p>
        </div>

        {/* Progress */}
        {showProgress && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-[#2283FF]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>

                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Progress
                </span>
              </div>

              <span className="text-xs font-black text-[#2283FF]">
                {progressPercentage}%
              </span>
            </div>

            <div className="w-full bg-gray-50 rounded-full h-2.5 overflow-hidden border border-gray-100 p-0.5">
              <div
                className="bg-gradient-to-r from-[#2283FF] via-[#2c6cb0] to-[#2283FF] bg-[length:200%_auto] animate-gradient-shift h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${progressPercentage}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}