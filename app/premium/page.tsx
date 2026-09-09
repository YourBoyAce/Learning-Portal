"use client";

import React, { useState, useEffect } from "react";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import { ArrowRight, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { ICONS } from "@/app/styles/icons";
import Link from "next/link";

export default function PremiumPage() {
  const [loading, setLoading] = useState(true);

  // Simulate loading to match other pages' feel
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* Header Section styled exactly like Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pt-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-brand-primary uppercase tracking-[0.2em] bg-brand-primary/10 px-3 py-1.5 rounded-md">
                Premium Tier
              </span>
            </div>
            <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>
              Premium Dashboard
            </h1>
            <p className="text-gray-500 text-lg leading-relaxed">
              Welcome to your exclusive premium dashboard. Access live sessions, manage your inbox, and plan your schedule all in one place.
            </p>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse h-[320px]">
                <div className="flex justify-between mb-4">
                  <div className="h-4 bg-gray-100 rounded w-1/4" />
                </div>
                <div className="h-6 bg-gray-100 rounded-md w-3/4 mb-3" />
                <div className="h-4 bg-gray-100 rounded-md w-full mb-2" />
                <div className="h-4 bg-gray-100 rounded-md w-5/6" />
                <div className="mt-8 flex justify-center py-6">
                  <div className="w-16 h-16 bg-gray-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Feature Grid - Replicating User Dashboard Widget Style */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Live Sessions */}
            <div className="bg-surface-accent rounded-2xl p-5 border border-brand-primary/20 shadow-sm relative overflow-hidden transition-all hover:shadow-md flex flex-col group min-h-[320px]">
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-xs font-bold text-brand-primary uppercase tracking-[0.2em]">
                  Live Sessions
                </span>
              </div>
              <h2 className={`${TYPOGRAPHY_CLASSES.SUBHEADING} mb-2 relative z-10`}>
                Live Sessions
              </h2>
              <p className="text-sm text-gray-600 mb-4 relative z-10">
                Attend exclusive live sessions, interact with instructors in real-time, and catch up on recorded streams.
              </p>
              <div className="flex-1 flex items-center justify-center relative z-10 py-4">
                <div className="w-16 h-16 bg-surface-subtle rounded-xl flex items-center justify-center border border-brand-primary/10 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <Image src={ICONS.GLOBELIGHT} alt="Webinars" width={28} height={28} className="text-brand-primary opacity-80" />
                </div>
              </div>
              <div className="pt-4 border-t border-brand-primary/10 mt-auto relative z-10">
                <Link href="/premium/webinars">
                  <Button className="w-full justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors">
                    Live Sessions
                    <ArrowRight className="w-4 h-4 ml-2 opacity-70 group-hover:translate-x-1 transition-all" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Inbox */}
            <div className="bg-surface-accent rounded-2xl p-5 border border-brand-primary/20 shadow-sm relative overflow-hidden transition-all hover:shadow-md flex flex-col group min-h-[320px]">
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-xs font-bold text-brand-primary uppercase tracking-[0.2em]">
                  Messages
                </span>
              </div>
              <h2 className={`${TYPOGRAPHY_CLASSES.SUBHEADING} mb-2 relative z-10`}>
                Inbox
              </h2>
              <p className="text-sm text-gray-600 mb-4 relative z-10">
                Check your direct messages, connection requests, and important notifications from mentors and peers.
              </p>
              <div className="flex-1 flex items-center justify-center relative z-10 py-4">
                <div className="w-16 h-16 bg-surface-subtle rounded-xl flex items-center justify-center border border-brand-primary/10 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <Image src={ICONS.BATCHLIGHT} alt="Inbox" width={28} height={28} className="text-brand-primary opacity-80" />
                </div>
              </div>
              <div className="pt-4 border-t border-brand-primary/10 mt-auto relative z-10">
                <Link href="/premium/inbox">
                  <Button className="w-full justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors">
                    Open Inbox
                    <ArrowRight className="w-4 h-4 ml-2 opacity-70 group-hover:translate-x-1 transition-all" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Calendar */}
            <div className="bg-surface-accent rounded-2xl p-5 border border-brand-primary/20 shadow-sm relative overflow-hidden transition-all hover:shadow-md flex flex-col group min-h-[320px]">
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-xs font-bold text-brand-primary uppercase tracking-[0.2em]">
                  Schedule
                </span>
              </div>
              <h2 className={`${TYPOGRAPHY_CLASSES.SUBHEADING} mb-2 relative z-10`}>
                Calendar
              </h2>
              <p className="text-sm text-gray-600 mb-4 relative z-10">
                Plan your learning schedule. View upcoming deadlines, mentor sessions, and scheduled webinars.
              </p>
              <div className="flex-1 flex items-center justify-center relative z-10 py-4">
                <div className="w-16 h-16 bg-surface-subtle rounded-xl flex items-center justify-center border border-brand-primary/10 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <Image src={ICONS.CALENDAR} alt="Calendar" width={28} height={28} className="text-brand-primary opacity-80" />
                </div>
              </div>
              <div className="pt-4 border-t border-brand-primary/10 mt-auto relative z-10">
                <Link href="/premium/calendar">
                  <Button className="w-full justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors">
                    View Calendar
                    <ArrowRight className="w-4 h-4 ml-2 opacity-70 group-hover:translate-x-1 transition-all" />
                  </Button>
                </Link>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
