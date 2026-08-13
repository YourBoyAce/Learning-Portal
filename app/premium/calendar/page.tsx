"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Users,
} from "lucide-react";

interface PremiumCalendarEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
}

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function PremiumCalendarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<PremiumCalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("calendar_events")
          .select("id, title, description, event_date, event_time, tag")
          .eq("user_id", session.user.id)
          .eq("event_type", "webinar")
          .like("tag", "%status:accepted%")
          .order("event_date", { ascending: true })
          .order("event_time", { ascending: true });

        if (error) throw error;

        setEvents((data || []) as PremiumCalendarEvent[]);
      } catch (error) {
        console.error("Failed to load premium calendar webinars:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadEvents();
  }, [router]);

  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const monthCells = useMemo(() => {
    const firstDay = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1,
    );
    const lastDay = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0,
    );
    const startDay = new Date(firstDay);
    startDay.setDate(firstDay.getDate() - firstDay.getDay());

    const cells: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i += 1) {
      const cellDate = new Date(startDay);
      cellDate.setDate(startDay.getDate() + i);
      cells.push({
        date: cellDate,
        inMonth: cellDate.getMonth() === currentMonth.getMonth(),
      });
    }

    return cells;
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, PremiumCalendarEvent[]>>(
      (acc, event) => {
        const key = event.event_date;
        acc[key] = acc[key] ? [...acc[key], event] : [event];
        return acc;
      },
      {},
    );
  }, [events]);

  const statusLabel = (event: PremiumCalendarEvent) => {
    const tag = (event as any)?.tag || "";
    return tag.includes("status:accepted")
      ? "Accepted"
      : tag.includes("status:declined")
        ? "Declined"
        : "Pending";
  };

  const handleMonthShift = (direction: number) => {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + direction,
        1,
      ),
    );
  };

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="border-b border-gray-100 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
              <CalendarDays className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-md">
              Premium Calendar
            </span>
          </div>
          <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>Calendar</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Your accepted premium webinar invitations appear on the monthly
            calendar.
          </p>
        </div>

        {loading ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center text-sm text-gray-500">
            Loading your accepted webinars...
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-[28px] shadow-sm overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary">
                  Monthly view
                </p>
                <h2 className="text-2xl font-bold text-gray-900 mt-2">
                  {monthLabel}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMonthShift(-1)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-brand-primary hover:text-brand-primary"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth(
                      new Date(
                        new Date().getFullYear(),
                        new Date().getMonth(),
                        1,
                      ),
                    )
                  }
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-primary hover:text-brand-primary"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleMonthShift(1)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-brand-primary hover:text-brand-primary"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
              {WEEK_DAYS.map((day) => (
                <div
                  key={day}
                  className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthCells.map(({ date, inMonth }, index) => {
                const dateKey = date.toISOString().split("T")[0];
                const dayEvents = eventsByDate[dateKey] || [];
                const isToday =
                  date.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={`${dateKey}-${index}`}
                    className={`min-h-[130px] border-b border-r border-gray-100 p-2 ${
                      inMonth ? "bg-white" : "bg-gray-50/60 text-gray-400"
                    } ${isToday ? "ring-1 ring-inset ring-brand-primary/60" : ""}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                          isToday
                            ? "bg-brand-primary text-white"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"
                        >
                          <div className="truncate">{event.title}</div>
                          <div className="mt-0.5 flex items-center justify-between gap-1 text-[9px] opacity-90">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-2.5 w-2.5" />
                              {event.event_time.slice(0, 5)}
                            </span>
                            <span>Accepted</span>
                          </div>
                        </div>
                      ))}

                      {dayEvents.length > 2 && (
                        <div className="text-[9px] font-medium text-gray-500">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {events.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">
                No webinar invites yet for this month.
              </div>
            )}

            {events.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50/40 p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Users className="h-4 w-4 text-brand-primary" />
                  Webinar schedule
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                          Accepted
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {new Date(event.event_date).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-gray-900">
                        {event.title}
                      </h3>

                      {event.description && (
                        <p className="mt-2 text-xs leading-relaxed text-gray-600 whitespace-pre-wrap">
                          {event.description}
                        </p>
                      )}

                      <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        {event.event_time.slice(0, 5)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
