"use client";

import { useEffect, useState } from "react";
import { useLoading } from "@/app/context/LoadingContext";
import { supabase } from "@/app/lib/supabase";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import {
  formatLiveSessionSlot,
  isLiveSessionPast,
} from "@/app/lib/live-session-helpers";
import Image from "next/image";
import { Video, CalendarClock, Users, ExternalLink, Radio, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSecurityGatedData } from "@/app/hooks/useSecurityGatedData";
import { UpgradeRequired } from "@/app/components/UpgradeRequired";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveSession {
  id: number | string;
  title: string;
  subtitle: string;
  description: string;
  event_date: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  status: "streaming" | "link" | string;
  link_text: string;
  attendees_count: number;
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function LiveSessionCardSkeleton() {
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

// ─── Live Session Card ────────────────────────────────────────────────────────

function LiveSessionCard({ session, past }: { session: LiveSession; past: boolean }) {
  const formattedSlot = formatLiveSessionSlot({
    eventDate: session.event_date,
    date: session.date,
    startTime: session.start_time,
    endTime: session.end_time,
  });

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
        {/* Icon row + Pro badge */}
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
          {!past && (
            <span className="text-[9px] font-bold text-brand-primary/80 bg-brand-primary/5 border border-brand-primary/10 rounded-md px-2 py-0.5 uppercase tracking-wider">
              Pro Live Session
            </span>
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
            {session.title}
          </h3>
          {session.subtitle && (
            <p className={`text-xs mt-0.5 truncate ${past ? "text-gray-400" : "text-gray-500"}`}>
              {session.subtitle}
            </p>
          )}
        </div>

        {/* Description */}
        {session.description && (
          <p
            className={`text-xs leading-relaxed line-clamp-2 p-3 rounded-2xl border ${past
                ? "text-gray-400 bg-gray-100/50 border-gray-100"
                : "text-gray-500 bg-gray-50 border-gray-50"
              }`}
          >
            {session.description}
          </p>
        )}

        {/* Meta row */}
        <div
          className={`flex flex-wrap items-center gap-3 text-xs font-bold tracking-wide ${past ? "text-gray-300" : "text-gray-500"
            }`}
        >
          <span className="flex items-center gap-1.5">
            <CalendarClock size={13} className={past ? "text-gray-300" : "text-brand-primary"} />
            {formattedSlot}
          </span>
          {session.attendees_count > 0 && (
            <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-gray-400">
              <Users size={12} />
              {session.attendees_count} members
            </span>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="pt-4 border-t border-gray-100 mt-4">
        {past ? (
          <div className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold bg-gray-100 border border-gray-100 text-gray-400 cursor-not-allowed select-none">
            <Clock size={14} />
            This session has ended
          </div>
        ) : session.link_text ? (
          <a
            href={session.link_text}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all bg-brand-primary hover:bg-brand-primary/90 text-white"
          >
            <ExternalLink size={15} />
            Join Live Session
          </a>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold bg-emerald-50 border border-emerald-100 text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Scheduled
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LiveSessionsPage() {
  const { setLoading: setGlobalLoading } = useLoading();
  const [loading, setLoading] = useState(true);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const { isLoading: isTierLoading, canAccess } = useSecurityGatedData();

  const isCurrentlyLoading = loading || isTierLoading;

  useEffect(() => {
    setGlobalLoading(isCurrentlyLoading);
    return () => setGlobalLoading(false);
  }, [isCurrentlyLoading, setGlobalLoading]);

  useEffect(() => {
    const load = async () => {
      if (isTierLoading) return;
      if (!canAccess("LiveSessions")) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch("/api/live-sessions", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load live sessions.");
        }

        setLiveSessions(data?.sessions || []);
      } catch (err) {
        console.error("Error loading live sessions:", err);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isTierLoading, canAccess]);

  const upcomingSessions = liveSessions.filter(
    (s) =>
      !isLiveSessionPast({
        eventDate: s.event_date,
        date: s.date,
        startTime: s.start_time,
        durationMinutes: s.duration_minutes,
      }),
  );
  const pastSessions = liveSessions.filter((s) =>
    isLiveSessionPast({
      eventDate: s.event_date,
      date: s.date,
      startTime: s.start_time,
      durationMinutes: s.duration_minutes,
    }),
  );

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div>
            <h1 className={`${TYPOGRAPHY_CLASSES.MAIN_HEADING} flex items-center gap-2`}>
              <Image src={ICONS.GLOBE} alt="Live Sessions" width={28} height={28} />
              Live Sessions
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Exclusive live Zoom sessions assigned to your Pro account.
            </p>
          </div>

          {!loading && canAccess("LiveSessions") && (
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
              <Radio size={14} className="text-brand-primary" />
              <span className="text-sm font-bold text-brand-heading">
                {liveSessions.length} Session{liveSessions.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        {!isTierLoading && !canAccess("LiveSessions") ? (
          <div className="py-6">
            <UpgradeRequired
              title="Live Sessions Locked"
              description="Live Sessions are exclusively available to Pro plan members. Upgrade to the Pro plan to join scheduled live Zoom sessions with instructors."
              requiredTier="Pro"
            />
          </div>
        ) : (
          <div className="space-y-10">

            {/* Loading skeletons */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[0, 1, 2].map((i) => <LiveSessionCardSkeleton key={i} />)}
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
                      {upcomingSessions.length}
                    </span>
                  </div>

                  {upcomingSessions.length === 0 ? (
                    <div className="py-16 bg-white rounded-3xl border border-dashed border-gray-200 text-center px-4">
                      <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Video className="w-7 h-7 text-brand-primary" />
                      </div>
                      <h3 className="text-base font-bold text-gray-900 mb-1">
                        No Upcoming Live Sessions
                      </h3>
                      <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
                        Live sessions assigned to you by an administrator will appear here automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {upcomingSessions.map((s) => (
                        <LiveSessionCard key={s.id} session={s} past={false} />
                      ))}
                    </div>
                  )}
                </section>

                {/* ── Past ── */}
                {pastSessions.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-gray-400" />
                      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Past Sessions
                      </h2>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
                        {pastSessions.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pastSessions.map((s) => (
                        <LiveSessionCard key={s.id} session={s} past={true} />
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
