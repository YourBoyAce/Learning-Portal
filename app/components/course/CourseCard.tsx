"use client";

import Image from "next/image";

import { ICONS } from "@/app/styles/icons";



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



  createdAt?: string;



  onClick?: () => void;

  onEdit?: () => void;

  onDelete?: () => void;

  isCompleted?: boolean;

  onCertificateClick?: () => void;

};



const PLACEHOLDER_IMAGE =

  "https://images.unsplash.com/photo-1498050108023-c5249f4df085";



export default function CourseCard({

  title,

  description,

  thumbnail,

  category,

  progressPercentage = 0,

  showProgress = false,



  variant = "user",



  createdAt,



  onClick,

  onEdit,

  onDelete,

  isCompleted = false,

  onCertificateClick,

}: CourseCardProps) {

  const isAdmin = variant === "admin";



  // Shared content block

  const contentBlock = (

    <>

      <div className="flex items-start justify-between gap-3 mb-2">

        <h3 className="font-bold text-lg text-copy-navy leading-snug line-clamp-2 flex-1">

          {title}

        </h3>

        {!isAdmin && category && (

          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap bg-brand-primary/10 text-brand-primary">

            {category}

          </span>

        )}

      </div>

      <p className="card-description line-clamp-2 mb-4">

        {description || (isAdmin ? "No description available." : "Master these concepts with our structured learning path.")}

      </p>

    </>

  );



  // Admin footer

  const adminFooter = (

    <div className="mt-auto border-t border-gray-100 pt-4">

      <div className="flex items-center justify-between mb-2">

        <span className="text-xs text-gray-400">

          {createdAt

            ? new Date(createdAt).toLocaleDateString("en-US", {

              month: "short",

              day: "numeric",

              year: "numeric",

            })

            : "Recently Added"}

        </span>

        <span className="px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-semibold">

          Active

        </span>

      </div>

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



  // User footer (progress section)

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

            background: "linear-gradient(to right, var(--color-primary), var(--color-success))",

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

        {/* Thumbnail */}

        <div className="relative w-full aspect-[16/9] overflow-hidden">

          <img

            src={thumbnail || PLACEHOLDER_IMAGE}

            alt={title}

            className="w-full h-full object-cover object-center"

          />

        </div>



        {/* Content */}

        <div className="flex-1 flex flex-col px-6 pt-4 pb-5">

          {/* Shared content block */}

          {contentBlock}



          {/* Variant-specific footer */}

          {isAdmin ? adminFooter : userFooter}

        </div>

      </div>

    </div>

  );

}