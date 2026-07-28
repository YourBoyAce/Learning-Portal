"use client";

import { useEffect, useState } from "react";
import { useLoading } from "@/app/context/LoadingContext";
import { supabase } from "@/app/lib/supabase";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import Image from "next/image";
import { Video, CalendarClock, Users, ExternalLink, Radio } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSecurityGatedData } from "@/app/hooks/useSecurityGatedData";
import { UpgradeRequired } from "@/app/components/UpgradeRequired";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Webinar {
  id: number | string;
  title: string;
  subtitle: string;
  description: string;
  event_date: string;
  icon: string;
  status: "streaming" | "link" | string;
  link_text: string;
  attendees_count: number;
  batch_id: string | number | null;
  batchName?: string;
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function WebinarCardSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col gap-4 min-h-[220px]">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <Skeleton className="h-10 w-full rounded-xl mt-auto" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LiveWebinarsPage() {
  const { setLoading: setGlobalLoading } = useLoading();
  const [loading, setLoading] = useState(true);
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const { isLoading: isTierLoading, canAccess } = useSecurityGatedData();

  const isCurrentlyLoading = loading || isTierLoading;

  useEffect(() => {
    setGlobalLoading(isCurrentlyLoading);
    return () => setGlobalLoading(false);
  }, [isCurrentlyLoading, setGlobalLoading]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        // 1. Get authenticated user
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;

        const userEmail = session.user.email?.trim().toLowerCase() || "";

        // 2. Fetch all webinars
        const { data: webinarRows, error } = await supabase
          .from("webinars")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // 3. Map to Webinar interface (no batch filtering for now)
        const mapped: Webinar[] = (webinarRows || []).map((w: any) => ({
          id: w.id,
          title: w.title,
          subtitle: w.subtitle || "",
          description: w.description || "",
          event_date: w.event_date || "",
          icon: w.icon || "📋",
          status: w.status || "streaming",
          link_text: w.link_text || "",
          attendees_count: w.attendees_count || 0,
          batch_id: null,
          batchName: undefined,
        }));

        setWebinars(mapped);
      } catch (err) {
        console.error("Error loading webinars:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div>
            <h1 className={`${TYPOGRAPHY_CLASSES.MAIN_HEADING} flex items-center gap-2`}>
              <Image src={ICONS.GLOBE} alt="Webinars" width={28} height={28} />
              Live Webinars
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Exclusive live knowledge sessions curated for your learning cohort.
            </p>
          </div>

          {/* Count badge */}
          {!loading && canAccess("Webinars") && (
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
              <Radio size={14} className="text-brand-primary" />
              <span className="text-sm font-bold text-brand-heading">
                {webinars.length} Session{webinars.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        {!isTierLoading && !canAccess("Webinars") ? (
          <div className="py-6">
            <UpgradeRequired
              title="Cohort Webinars Gated"
              description="Live cohort webinars are exclusively available to Premium members. Upgrade your plan to participate in live Q&A sessions, cohort discussions, and interactive workshops."
              requiredTier="Premium"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Loading skeletons */}
            {loading &&
              [0, 1, 2].map((i) => <WebinarCardSkeleton key={i} />)}

            {/* Webinar cards */}
            {!loading &&
              webinars.map((webinar) => (
                <div
                  key={webinar.id}
                  className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-gray-200 transition-all group min-h-[220px]"
                >
                  <div className="space-y-4">
                    {/* Icon row + batch badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-brand-primary transition-all">
                        <Video
                          size={18}
                          className="text-brand-primary group-hover:text-white transition-colors"
                        />
                      </div>
                      {webinar.batchName ? (
                        <span className="text-[9px] font-bold text-gray-400 bg-gray-50 border border-gray-100 rounded-md px-2 py-0.5 uppercase tracking-wider">
                          {webinar.batchName}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-brand-primary/70 bg-brand-primary/5 border border-brand-primary/10 rounded-md px-2 py-0.5 uppercase tracking-wider">
                          All Batches
                        </span>
                      )}
                    </div>

                    {/* Title & subtitle */}
                    <div>
                      <h3 className="font-bold text-gray-900 leading-snug text-base group-hover:text-brand-primary transition-colors line-clamp-1">
                        {webinar.title}
                      </h3>
                      {webinar.subtitle && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {webinar.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    {webinar.description && (
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 bg-gray-50 p-3 rounded-2xl border border-gray-50">
                        {webinar.description}
                      </p>
                    )}

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-bold uppercase tracking-wider">
                      {webinar.event_date && (
                        <span className="flex items-center gap-1">
                          <CalendarClock size={12} />
                          {webinar.event_date}
                        </span>
                      )}
                      {webinar.attendees_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {webinar.attendees_count} attending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="pt-4 border-t border-gray-50 mt-4">
                    {webinar.status === "link" && webinar.link_text ? (
                      <a
                        href={webinar.link_text}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all bg-brand-primary hover:bg-brand-primary/90 text-white"
                      >
                        <ExternalLink size={15} />
                        Join Session
                      </a>
                    ) : (
                      <div className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold bg-emerald-50 border border-emerald-100 text-emerald-700">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        Live Streaming
                      </div>
                    )}
                  </div>
                </div>
              ))}

            {/* Empty state */}
            {!loading && webinars.length === 0 && (
              <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center px-4 max-w-lg mx-auto">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8 text-brand-primary" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  No Webinars Scheduled
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
                  Once your instructors schedule a live session and assign it to your batch, it will appear here automatically.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
