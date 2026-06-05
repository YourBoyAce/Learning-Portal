"use client";

import { forwardRef } from "react";

interface CertificateProps {
  userName: string;
  courseName: string;
  completedDate: string;
}

const Certificate = forwardRef<HTMLDivElement, CertificateProps>(
  ({ userName, courseName, completedDate }, ref) => {
    return (
      <div
        ref={ref}
        // Fixed aspect ratio container
        className="relative w-[1200px] h-[850px] bg-white overflow-hidden shadow-2xl flex flex-col"
        style={{
          background:
            "linear-gradient(135deg, #ffffff 0%, #f8fbff 40%, #e7f1ff 100%)",
        }}
      >
        {/* --- BACKGROUND GRAPHICS (z-0) --- */}

        {/* TOP RIGHT STARS */}
        <img
          src="/images/star-large.svg"
          alt=""
          width={400}
          height={400}
          className="absolute -top-24 -right-24 opacity-60 pointer-events-none z-0"
        />
        <img
          src="/images/star-small.svg"
          alt=""
          width={100}
          height={100}
          className="absolute top-[240px] right-[150px] opacity-70 pointer-events-none z-0"
        />
        <img
          src="/images/star-small.svg"
          alt=""
          width={80}
          height={80}
          className="absolute top-[280px] right-[10px] rotate-90 opacity-60 pointer-events-none z-0"
        />

        {/* BOTTOM LEFT STAR - Pushed further out to avoid footer text */}
        <img
          src="/images/star-large.svg"
          alt=""
          width={450}
          height={450}
          className="absolute -bottom-12 -left-52 rotate-180 opacity-40 pointer-events-none z-0"
        />

        {/* --- FOREGROUND CONTENT (z-10) --- */}

        {/* LOGO - Absolute top left */}
        <div className="absolute top-12 left-16 z-10">
          <img
            src="/images/logo.svg"
            alt="Auto-Mate"
            width={200}
            height={60}
            className="object-contain"
          />
        </div>

        {/* MAIN TEXT - Flex centered to prevent vertical overlaps */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-32 pt-20 z-10">
          
          <h1 className="text-[64px] font-black text-brand-heading tracking-tight mb-2">
            Certificate
          </h1>

          <p className="text-[20px] font-semibold text-gray-600 tracking-[0.2em]  mb-8">
            Of Achievement In
          </p>

          <h2 className="text-[48px] font-bold text-brand-alt leading-tight max-w-[900px] mb-12">
            {courseName}
          </h2>

          <p className="text-[22px] font-semibold text-gray-600 mb-6">
            This Certificate is proudly presented to
          </p>

          <h2 className="text-[56px] font-bold text-gray-800 border-b-[3px] border-gray-200 pb-3 mb-10 min-w-[600px]">
            {userName}
          </h2>

          <p className="max-w-[900px] text-[22px] leading-relaxed text-gray-800 text-left  font-medium">
            Awarded in recognition of dedicated completion and demonstrated commitment to learning
            
             and skill development. This credential marks a meaningful step forward<br />in professional growth and readiness for future challenges.
            
          </p>

        </div>

        {/* FOOTER - Anchored to the bottom */}
        <div className="w-full flex justify-between px-32 pb-16 z-10">
          
          {/* DATE */}
          <div className="text-center flex flex-col items-center">
            <p className="text-[20px] font-bold text-gray-800 h-[30px] flex items-end">
              {completedDate}
            </p>
            <div className="w-[220px] h-[2px] bg-gray-300 mt-2 mb-2" />
            <p className="text-[14px] text-gray-500 font-bold uppercase tracking-widest">
              Date Issued
            </p>
          </div>

          {/* SIGNATURE */}
          <div className="text-center flex flex-col items-center">
            <div className="h-[30px] w-[220px]" />
            <div className="w-[220px] h-[2px] bg-gray-300 mt-2 mb-2" />
            <p className="text-[14px] text-gray-500 font-bold uppercase tracking-widest">
              Authorized Signature
            </p>
          </div>
          
        </div>

      </div>
    );
  }
);

Certificate.displayName = "Certificate";

export default Certificate;