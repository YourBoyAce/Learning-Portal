"use client";

import React, { useEffect, useState } from "react";
import { useLoading } from "@/app/context/LoadingContext";
import { supabase } from "@/app/lib/supabase";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/app/components/UserAvatar";
import {
  Calendar,
  Video,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Mail,
  ExternalLink,
  Loader2,
  Sparkles,
  Inbox,
  ArrowUpRight
} from "lucide-react";

interface Session {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  meet_link: string | null;
  duration: number;
  // Student View
  mentorName?: string;
  mentorEmail?: string;
  // Mentor View
  studentName?: string;
  studentEmail?: string;
}

export default function InboxPage() {
  const { setLoading: setGlobalLoading } = useLoading();
  const [loading, setLoading] = useState(true);
  const [isMentor, setIsMentor] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expandedSetupId, setExpandedSetupId] = useState<string | null>(null);

  useEffect(() => {
    setGlobalLoading(loading);
    return () => setGlobalLoading(false);
  }, [loading, setGlobalLoading]);

  const loadInbox = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/mentor-planner/inbox", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setIsMentor(data.isMentor);
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Failed to load inbox data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, []);

  // Split sessions into upcoming and past
  const now = new Date();
  const upcomingSessions = sessions.filter((s) => {
    const sessionTime = new Date(`${s.event_date}T${s.event_time}`);
    return sessionTime >= now;
  });

  const pastSessions = sessions.filter((s) => {
    const sessionTime = new Date(`${s.event_date}T${s.event_time}`);
    return sessionTime < now;
  });

  const toggleSetupPanel = (id: string) => {
    setExpandedSetupId(expandedSetupId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="border-b border-gray-100 pb-6 text-left flex items-center justify-between">
          <div>
            <h1 className={`${TYPOGRAPHY_CLASSES.MAIN_HEADING} flex items-center gap-2.5`}>
              <Inbox className="w-7 h-7 text-brand-primary" />
              Inbox
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              View your accepted 1-on-1 sessions, launch video meetings, and configure integrations.
            </p>
          </div>
        </div>

        {/* Upcoming Sessions Section */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest text-left">
            Upcoming Sessions ({upcomingSessions.length})
          </h2>

          {upcomingSessions.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center space-y-4">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-gray-400">
                <Calendar size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-gray-800">No upcoming meetings</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  {isMentor 
                    ? "As soon as you accept a scholar's connect request, it will appear here." 
                    : "Schedule a session with one of your cohort mentors to get started."
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingSessions.map((session) => (
                <div 
                  key={session.id} 
                  className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all text-left space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* User profile / meeting details */}
                    <div className="flex items-start gap-4">
                      <UserAvatar
                        name={isMentor ? (session.studentName || "") : (session.mentorName || "")}
                        email={isMentor ? (session.studentEmail || "") : (session.mentorEmail || "")}
                        size={48}
                      />
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                          {isMentor ? "Scholar Booking" : "Mentor Sync"}
                        </span>
                        <h3 className="font-bold text-gray-900 text-[15px] leading-snug">
                          {session.title}
                        </h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5 font-medium">
                          {isMentor ? (
                            <>
                              <Mail size={12} /> {session.studentName} ({session.studentEmail})
                            </>
                          ) : (
                            <>
                              <Mail size={12} /> {session.mentorName} ({session.mentorEmail})
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Quick date / time info */}
                    <div className="flex flex-wrap gap-3 sm:flex-col sm:items-end text-xs text-gray-500 font-semibold shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-gray-400" />
                        {new Date(session.event_date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-gray-400" />
                        {session.event_time.slice(0, 5)} ({session.duration} min)
                      </div>
                    </div>
                  </div>

                  {/* Topic description */}
                  {session.description && (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-gray-600 leading-relaxed">
                      <p className="font-bold text-gray-700 mb-1">Session Topic:</p>
                      <p className="whitespace-pre-wrap">
                        {session.description.split("---")[0].trim()}
                      </p>
                    </div>
                  )}

                  {/* Action buttons & Integration Prompts */}
                  <div className="pt-4 border-t border-gray-50 flex flex-col gap-4">
                    {session.meet_link ? (
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <p className="text-[11px] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Google Meet link generated
                        </p>
                        <Button
                          onClick={() => window.open(session.meet_link!, "_blank")}
                          className="px-6 py-2.5 rounded-xl text-xs font-bold bg-brand-primary text-white flex items-center gap-1.5"
                        >
                          {isMentor ? "Start Call" : "Join Call"}
                          <ArrowUpRight size={14} />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {isMentor ? (
                          <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 space-y-3">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold text-amber-800">
                                  Meet link not yet generated
                                </h4>
                                <p className="text-[11px] text-amber-700 leading-relaxed">
                                  Please complete your Cal.com integration setup to automatically unlock Google Meet conferencing.
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <Button
                                onClick={() => toggleSetupPanel(session.id)}
                                variant="outline"
                                className="px-4 py-1.5 border-amber-200 bg-white hover:bg-amber-50 text-amber-800 text-[11px] font-bold rounded-xl flex items-center gap-1"
                              >
                                {expandedSetupId === session.id ? (
                                  <>Hide Instructions <ChevronUp size={12} /></>
                                ) : (
                                  <>View Setup Steps <ChevronDown size={12} /></>
                                )}
                              </Button>
                              <Button
                                onClick={() => window.location.href = "/profile"}
                                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-xl"
                              >
                                Go to Profile
                              </Button>
                            </div>

                            {/* Collapsible Setup Steps */}
                            {expandedSetupId === session.id && (
                              <div className="pt-3 border-t border-amber-100 text-[11px] text-amber-800/90 space-y-2 leading-relaxed">
                                <p className="font-bold">Step-by-step Setup:</p>
                                <ol className="list-decimal pl-4 space-y-1.5">
                                  <li>Create a free account at <a href="https://cal.com" target="_blank" rel="noopener noreferrer" className="underline font-bold">cal.com</a></li>
                                  <li>Navigate to <b>Settings → Integrations</b> and connect Google Calendar.</li>
                                  <li>Create an Event Type named <b>"1-on-1 Session"</b> (matching your session duration).</li>
                                  <li>Copy the Event Type ID from your browser URL (e.g. <code>cal.com/event-types/123456</code>).</li>
                                  <li>Go to your <b>Profile page</b> in this portal and paste the Event Type ID.</li>
                                </ol>
                                <p className="text-[9px] text-amber-600/95 font-semibold">
                                  💡 Once saved, this portal will automatically retry creating the Cal.com booking.
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                            <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />
                            <span className="text-[11px] text-slate-500 font-semibold">
                              Your mentor is setting up the meeting link. You will be notified when it is ready.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Sessions Section */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest text-left">
            Past Sessions ({pastSessions.length})
          </h2>

          {pastSessions.length === 0 ? (
            <p className="text-xs text-gray-400 text-left italic">No past sessions recorded.</p>
          ) : (
            <div className="space-y-3 opacity-60">
              {pastSessions.map((session) => (
                <div 
                  key={session.id} 
                  className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={isMentor ? (session.studentName || "") : (session.mentorName || "")}
                      email={isMentor ? (session.studentEmail || "") : (session.mentorEmail || "")}
                      size={36}
                    />
                    <div>
                      <h3 className="font-bold text-gray-700 text-sm">{session.title}</h3>
                      <p className="text-[10px] text-gray-400 font-medium">
                        {isMentor ? session.studentName : session.mentorName} • {session.duration} min
                      </p>
                    </div>
                  </div>

                  <div className="text-[10px] font-bold text-gray-400 flex gap-4 shrink-0">
                    <span>
                      {new Date(session.event_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span>{session.event_time.slice(0, 5)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
