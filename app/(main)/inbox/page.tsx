"use client";

import React, { useEffect, useState } from "react";
import { useLoading } from "@/app/context/LoadingContext";
import { supabase } from "@/app/lib/supabase";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/app/components/UserAvatar";
import { useSecurityGatedData } from "@/app/hooks/useSecurityGatedData";
import { UpgradeRequired } from "@/app/components/UpgradeRequired";
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
  ArrowUpRight,
  Copy,
  Check
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
  const [generatingMeetId, setGeneratingMeetId] = useState<string | null>(null);
  const [savingManualId, setSavingManualId] = useState<string | null>(null);
  const [manualLinks, setManualLinks] = useState<{ [id: string]: string }>({});
  const [sessionFeedback, setSessionFeedback] = useState<{ [id: string]: { type: "success" | "error"; text: string } }>({});
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const { isLoading: isTierLoading, canAccess } = useSecurityGatedData();

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

  const handleGenerateMeetLink = async (sessionId: string) => {
    setGeneratingMeetId(sessionId);
    setSessionFeedback((prev) => ({ ...prev, [sessionId]: { type: "success", text: "" } }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/mentor-planner/generate-meet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ eventId: sessionId }),
      });

      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) {
        throw new Error(result?.error || "Failed to generate Meet link via Cal.com.");
      }

      const generatedUrl = result.meetUrl || result.results?.[0]?.meetingUrl;
      if (generatedUrl) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, meet_link: generatedUrl } : s))
        );
      }

      setSessionFeedback((prev) => ({
        ...prev,
        [sessionId]: { type: "success", text: "Google Meet link generated successfully!" },
      }));
    } catch (err: any) {
      console.error("Error generating meet link in inbox:", err);
      setSessionFeedback((prev) => ({
        ...prev,
        [sessionId]: { type: "error", text: err.message || "Failed to generate meet link." },
      }));
    } finally {
      setGeneratingMeetId(null);
    }
  };

  const handleSaveManualLink = async (sessionId: string) => {
    const link = (manualLinks[sessionId] || "").trim();
    if (!link) return;

    setSavingManualId(sessionId);
    setSessionFeedback((prev) => ({ ...prev, [sessionId]: { type: "success", text: "" } }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/mentor-planner/generate-meet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ eventId: sessionId, meetLink: link }),
      });

      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) {
        throw new Error(result?.error || "Failed to save meeting link.");
      }

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, meet_link: link } : s))
      );
      setSessionFeedback((prev) => ({
        ...prev,
        [sessionId]: { type: "success", text: "Meeting link saved successfully!" },
      }));
      setManualLinks((prev) => ({ ...prev, [sessionId]: "" }));
    } catch (err: any) {
      console.error("Error saving manual meet link:", err);
      setSessionFeedback((prev) => ({
        ...prev,
        [sessionId]: { type: "error", text: err.message || "Failed to save meeting link." },
      }));
    } finally {
      setSavingManualId(null);
    }
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

        {!isTierLoading && !canAccess("Mentorship") ? (
          <div className="py-6">
            <UpgradeRequired
              title="Inbox Locked"
              description="Your inbox for 1-on-1 mentor sessions and video meetings is available to Pro and Premium tier members. Upgrade today to book sessions with instructors and join calls right from here."
              requiredTier="Pro"
            />
          </div>
        ) : (
        <>
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

                            <div className="space-y-2">
                              {sessionFeedback[session.id]?.text && (
                                <div className={`p-2.5 rounded-xl text-[11px] font-semibold border ${
                                  sessionFeedback[session.id].type === "success"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : "bg-red-50 text-red-800 border-red-200"
                                }`}>
                                  {sessionFeedback[session.id].text}
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2.5">
                                <Button
                                  onClick={() => handleGenerateMeetLink(session.id)}
                                  disabled={generatingMeetId === session.id}
                                  className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5"
                                >
                                  {generatingMeetId === session.id ? (
                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating Link...</>
                                  ) : (
                                    <><Video size={13} /> Generate Google Meet Link</>
                                  )}
                                </Button>

                                <Button
                                  onClick={() => toggleSetupPanel(session.id)}
                                  variant="outline"
                                  className="px-3.5 py-2 border-amber-200 bg-white hover:bg-amber-50 text-amber-800 text-[11px] font-bold rounded-xl flex items-center gap-1"
                                >
                                  {expandedSetupId === session.id ? (
                                    <>Hide Setup Instructions <ChevronUp size={12} /></>
                                  ) : (
                                    <>Setup Checklist <ChevronDown size={12} /></>
                                  )}
                                </Button>

                                <Button
                                  onClick={() => window.location.href = "/profile"}
                                  variant="ghost"
                                  className="px-3 py-2 text-slate-600 hover:text-slate-900 text-[11px] font-bold rounded-xl"
                                >
                                  Profile Settings
                                </Button>
                              </div>

                              {/* Manual Link Input */}
                              <div className="pt-2 border-t border-amber-200/60 space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                                  Or enter / paste Google Meet link manually:
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="url"
                                    value={manualLinks[session.id] || ""}
                                    onChange={(e) =>
                                      setManualLinks((prev) => ({ ...prev, [session.id]: e.target.value }))
                                    }
                                    placeholder="https://meet.google.com/abc-defg-hij"
                                    className="flex-1 bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand-primary font-mono"
                                  />
                                  <Button
                                    type="button"
                                    disabled={!manualLinks[session.id]?.trim() || savingManualId === session.id}
                                    onClick={() => handleSaveManualLink(session.id)}
                                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs h-auto rounded-xl font-bold shrink-0"
                                  >
                                    {savingManualId === session.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Link"}
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Collapsible Setup Steps */}
                            {expandedSetupId === session.id && (
                              <div className="pt-3 border-t border-amber-200/70 text-[11px] text-gray-700 space-y-3 leading-relaxed bg-white/70 p-3.5 rounded-xl border border-amber-100">
                                <p className="font-bold text-gray-900">
                                  Mentor Onboarding Checklist (One-Time Setup):
                                </p>
                                <ol className="list-decimal pl-4 space-y-2">
                                  <li>
                                    <strong>Sign Up:</strong> Create an account on{" "}
                                    <a href="https://cal.com" target="_blank" rel="noopener noreferrer" className="text-brand-primary underline font-semibold">
                                      cal.com
                                    </a>.
                                  </li>
                                  <li>
                                    <strong>Connect Calendar:</strong> Go to Settings → Integrations → Google Calendar and click Connect.
                                  </li>
                                  <li>
                                    <strong>Set Event Location:</strong> Under Events, open your event type and set Location to Google Meet <span className="text-amber-700 font-bold">(crucial!)</span>.
                                  </li>
                                  <li>
                                    <strong>Copy Event ID:</strong> Copy the number at the end of the URL (e.g., cal.com/event-types/7425761 → <code className="bg-white border px-1 py-0.5 rounded font-mono font-bold text-brand-primary">7425761</code>).
                                  </li>
                                  <li>
                                    <strong>Add Webhook in Cal.com:</strong>
                                    <div className="mt-1.5 bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1.5">
                                      <p>5.1. Go to Settings → Webhooks → New Webhook.</p>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-mono text-[10px] truncate text-slate-800">
                                          5.2. URL: https://learning-portal-sable.vercel.app/api/webhooks/calcom
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText("https://learning-portal-sable.vercel.app/api/webhooks/calcom");
                                            setCopiedWebhook(true);
                                            setTimeout(() => setCopiedWebhook(false), 2000);
                                          }}
                                          className="shrink-0 flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-white border border-slate-200 rounded hover:bg-slate-100"
                                        >
                                          {copiedWebhook ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                                          <span>{copiedWebhook ? "Copied" : "Copy"}</span>
                                        </button>
                                      </div>
                                      <p>5.3. Check Booking Created, Rescheduled, Cancelled → Save.</p>
                                    </div>
                                  </li>
                                  <li>
                                    <strong>Save in Portal:</strong> Go to Profile (
                                    <a href="/profile" className="text-brand-primary underline font-bold">
                                      /profile
                                    </a>
                                    ) in your portal, paste the Event Type ID, and click Save Changes.
                                  </li>
                                </ol>
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
        </>
        )}

      </div>
    </div>
  );
}
