"use client";

import { useEffect, useState } from "react";
import { useLoading } from "@/app/context/LoadingContext";
import { supabase } from "@/app/lib/supabase";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import Image from "next/image";
import { Video, CalendarClock, Users, ExternalLink, Radio, Clock } from "lucide-react";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPast(webinar: Webinar): boolean {
  if (!webinar.event_date) return false;
  const eventDate = new Date(webinar.event_date);
  if (isNaN(eventDate.getTime())) return false;
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return eventDate <= twoHoursAgo;
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

// ─── Webinar Card ─────────────────────────────────────────────────────────────

function WebinarCard({ webinar, past }: { webinar: Webinar; past: boolean }) {
  return (
    <div
      className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all min-h-[220px] ${past
          ? "bg-gray-50 border border-gray-100 shadow-none opacity-75"
          : "bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 group"
        }`}
    >
      {/* Ended overlay badge */}
      {past && (
        <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 bg-gray-200/80 rounded-lg border border-gray-200">
          <Clock size={10} className="text-gray-400" />
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
            Session Ended
          </span>
        </div>
      )}

      <div className="space-y-4">
        {/* Icon row + batch badge */}
        <div className="flex items-start justify-between gap-2">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${past
                ? "bg-gray-100"
                : "bg-blue-50 group-hover:bg-brand-primary"
              }`}
          >
            <Video
              size={18}
              className={
                past
                  ? "text-gray-400"
                  : "text-brand-primary group-hover:text-white transition-colors"
              }
            />
          </div>
          {/* Batch badge — only on upcoming */}
          {!past && (
            webinar.batchName ? (
              <span className="text-[9px] font-bold text-gray-400 bg-gray-50 border border-gray-100 rounded-md px-2 py-0.5 uppercase tracking-wider">
                {webinar.batchName}
              </span>
            ) : (
              <span className="text-[9px] font-bold text-brand-primary/70 bg-brand-primary/5 border border-brand-primary/10 rounded-md px-2 py-0.5 uppercase tracking-wider">
                All Batches
              </span>
            )
          )}
        </div>

        {/* Title & subtitle */}
        <div>
          <h3
            className={`font-bold leading-snug text-base line-clamp-1 ${past
                ? "text-gray-400"
                : "text-gray-900 group-hover:text-brand-primary transition-colors"
              }`}
          >
            {webinar.title}
          </h3>
          {webinar.subtitle && (
            <p className={`text-xs mt-0.5 truncate ${past ? "text-gray-400" : "text-gray-500"}`}>
              {webinar.subtitle}
            </p>
          )}
        </div>

        {/* Description */}
        {webinar.description && (
          <p
            className={`text-xs leading-relaxed line-clamp-2 p-3 rounded-2xl border ${past
                ? "text-gray-400 bg-gray-100/50 border-gray-100"
                : "text-gray-500 bg-gray-50 border-gray-50"
              }`}
          >
            {webinar.description}
          </p>
        )}

        {/* Meta row */}
        <div
          className={`flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wider ${past ? "text-gray-300" : "text-gray-400"
            }`}
        >
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
      <div className="pt-4 border-t border-gray-100 mt-4">
        {past ? (
          /* Greyed-out disabled button — mirrors expired mentor connect */
          <div className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold bg-gray-100 border border-gray-100 text-gray-400 cursor-not-allowed select-none">
            <Clock size={14} />
            This session has ended
          </div>
        ) : webinar.status === "link" && webinar.link_text ? (
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
    if (!isTierLoading && !canAccess("Webinars")) {
      const landingBase = (process.env.NEXT_PUBLIC_LANDING_SITE_URL || "").trim().replace(/\/$/, "");
      const landingLiveSessionsUrl =
        process.env.NEXT_PUBLIC_LANDING_LIVE_SESSION_URL?.trim() ||
        (landingBase ? `${landingBase}/payment?planName=Premium` : "/upgrade");
      window.location.href = landingLiveSessionsUrl;
    }
  }, [isTierLoading, canAccess]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: webinarRows, error } = await supabase
          .from("webinars")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

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

  const upcomingWebinars = webinars.filter((w) => !isPast(w));
  const pastWebinars = webinars.filter((w) => isPast(w));

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div>
            <h1 className={`${TYPOGRAPHY_CLASSES.MAIN_HEADING} flex items-center gap-2`}>
              <Image src={ICONS.GLOBE} alt="Webinars" width={28} height={28} />
              Live Sessions
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Exclusive live knowledge sessions curated for your learning cohort.
            </p>
          </div>

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
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
            <p className="text-gray-600 font-medium text-sm">
              Redirecting to Live Sessions Plan…
            </p>
          </div>
        ) : (
          <div className="space-y-10">

            {/* Loading skeletons */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[0, 1, 2].map((i) => <WebinarCardSkeleton key={i} />)}
              </div>
            )}

            {!loading && (
              <>
                {/* ── Upcoming ── */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary" />
                    </span>
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Upcoming Sessions
                    </h2>
                    <span className="text-[10px] font-bold text-brand-primary bg-brand-primary/5 border border-brand-primary/10 rounded px-1.5 py-0.5">
                      {upcomingWebinars.length}
                    </span>
                  </div>

                  {upcomingWebinars.length === 0 ? (
                    <div className="py-16 bg-white rounded-3xl border border-dashed border-gray-200 text-center px-4">
                      <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Video className="w-7 h-7 text-brand-primary" />
                      </div>
                      <h3 className="text-base font-bold text-gray-900 mb-1">
                        No Upcoming Webinars
                      </h3>
                      <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
                        Once your instructors schedule a live session, it will appear here automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {upcomingWebinars.map((w) => (
                        <WebinarCard key={w.id} webinar={w} past={false} />
                      ))}
                    </div>
                  )}
                </section>

                {/* ── Past ── */}
                {pastWebinars.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-gray-400" />
                      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Past Sessions
                      </h2>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
                        {pastWebinars.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pastWebinars.map((w) => (
                        <WebinarCard key={w.id} webinar={w} past={true} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
