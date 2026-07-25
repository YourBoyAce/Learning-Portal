"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import {
  CalendarDays,
  Clock,
  Mail,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TYPOGRAPHY_CLASSES = {
  MAIN_HEADING: "text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight",
};

interface InviteRequest {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  studentName: string;
  studentEmail: string;
  duration: number;
}

export default function InvitesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>("user");
  const [invites, setInvites] = useState<InviteRequest[]>([]);
  const [actioningState, setActioningState] = useState<{ id: string; action: "accept" | "decline" } | null>(null);
  const [pageMessage, setPageMessage] = useState<{ type: "success" | "error" | ""; text: string }>({
    type: "",
    text: "",
  });

  useEffect(() => {
    async function initPage() {
      try {
        setLoading(true);
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push("/auth");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        const role = profile?.role || "user";
        setCurrentUserRole(role);

        if (role !== "instructor" && role !== "admin") {
          // If student, they don't have access to this invites RSVP dashboard
          router.push("/mentor-planner");
          return;
        }

        // Fetch pending invites
        await loadInvites(user.id);
      } catch (err) {
        console.error("Error loading invites page:", err);
      } finally {
        setLoading(false);
      }
    }

    initPage();
  }, [router, supabase]);

  async function loadInvites(userId: string) {
    try {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, title, description, event_date, event_time, tag")
        .eq("user_id", userId)
        .like("tag", "%status:pending%");

      if (error) throw error;

      if (data) {
        const formatted: InviteRequest[] = data.map((e: any) => {
          // Parse student info from description and tag
          let studentName = "Student";
          let studentEmail = "";
          let duration = 60;
          let cleanDescription = e.description || "No topic specified";

          if (e.tag) {
            const durMatch = e.tag.match(/dur:(\d+)/);
            if (durMatch) duration = parseInt(durMatch[1], 10) || 60;
          }

          if (e.description) {
            const reqMatch = e.description.match(/Requested by:\s*([^(]+)\s*\(([^)]+)\)/);
            if (reqMatch) {
              studentName = reqMatch[1].trim();
              studentEmail = reqMatch[2].trim();
            }

            if (e.description.includes("---")) {
              cleanDescription = e.description.split("---")[0].trim();
            }
          }

          return {
            id: e.id,
            title: e.title,
            description: cleanDescription,
            event_date: e.event_date,
            event_time: e.event_time,
            studentName,
            studentEmail,
            duration,
          };
        });

        setInvites(formatted);
      }
    } catch (err) {
      console.error("Error loading pending invites:", err);
    }
  }

  const handleRSVP = async (eventId: string, action: "accept" | "decline") => {
    setActioningState({ id: eventId, action });
    setPageMessage({ type: "", text: "" });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No authentication token found. Please sign in again.");

      const res = await fetch("/api/mentor-planner/rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ eventId, action }),
      });

      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || "Failed to submit RSVP response.");

      setPageMessage({
        type: "success",
        text: action === "accept" ? "Invitation accepted! slot has been added to your planner." : "Invitation declined successfully.",
      });

      // Reload
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await loadInvites(user.id);
      }
    } catch (err: any) {
      console.error("Error submitting RSVP:", err);
      setPageMessage({ type: "error", text: err.message || "Failed to process RSVP." });
    } finally {
      setActioningState(null);
      setTimeout(() => {
        setPageMessage({ type: "", text: "" });
      }, 4000);
    }
  };

  // Calculate meeting end time
  const getEndTime = (startTime: string, durMin: number) => {
    if (!startTime) return "";
    const [hours, minutes] = startTime.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0);
    const newDate = new Date(date.getTime() + durMin * 60000);
    return `${String(newDate.getHours()).padStart(2, "0")}:${String(newDate.getMinutes()).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-surface-page">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6 text-left">
          <div>
            <h1 className={`${TYPOGRAPHY_CLASSES.MAIN_HEADING} flex items-center gap-2.5`}>
              <CalendarDays className="w-7 h-7 text-brand-primary" />
              RSVP Invites
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Respond to study connect requests submitted by scholars in your assigned batches.
            </p>
          </div>

          {invites.length > 0 && (
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-100 rounded-xl shadow-sm">
              <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
              <span className="text-xs font-bold text-purple-700">
                {invites.length} Pending Request{invites.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {pageMessage.text && (
          <div className={`text-xs px-4 py-3 rounded-xl font-semibold flex items-center gap-2 border text-left shadow-sm ${
            pageMessage.type === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-150"
              : "bg-red-50 text-red-700 border-red-150"
          }`}>
            <AlertCircle size={15} />
            <span>{pageMessage.text}</span>
          </div>
        )}

        {/* Requests List */}
        <div className="space-y-4">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-6 hover:shadow-md hover:border-gray-200 transition-all text-left relative overflow-hidden"
            >
              <div className="space-y-4 flex-1">
                {/* User avatar + name */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-bold">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 leading-snug text-sm">
                      {invite.studentName}
                    </h3>
                    {invite.studentEmail && (
                      <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-1 mt-0.5">
                        <Mail size={10} /> {invite.studentEmail}
                      </p>
                    )}
                  </div>
                </div>

                {/* Timing details */}
                <div className="grid grid-cols-2 gap-4 max-w-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                    <CalendarDays size={14} className="text-gray-400" />
                    <span>{invite.event_date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                    <Clock size={14} className="text-gray-400" />
                    <span>
                      {invite.event_time.slice(0, 5)} — {getEndTime(invite.event_time, invite.duration)} ({invite.duration}m)
                    </span>
                  </div>
                </div>

                {/* Description / Topic */}
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Topic / Challenge Details</p>
                  <p className="text-xs text-gray-600 leading-relaxed bg-gray-50/60 p-3 rounded-xl border border-gray-50/80">
                    {invite.description}
                  </p>
                </div>
              </div>

              {/* RSVP Action Buttons */}
              <div className="flex sm:flex-row md:flex-col gap-2.5 self-end md:self-center shrink-0 w-full sm:w-auto">
                <Button
                  onClick={() => handleRSVP(invite.id, "accept")}
                  disabled={actioningState !== null}
                  className="flex-1 md:w-32 bg-emerald-600 hover:bg-emerald-600/95 text-white flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  {actioningState?.id === invite.id && actioningState?.action === "accept" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={14} /> Accept
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleRSVP(invite.id, "decline")}
                  disabled={actioningState !== null}
                  variant="outline"
                  className="flex-1 md:w-32 border-red-200 hover:border-red-300 text-red-600 hover:text-red-700 bg-red-50/40 hover:bg-red-50 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  {actioningState?.id === invite.id && actioningState?.action === "decline" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <XCircle size={14} /> Decline
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {!loading && invites.length === 0 && (
            <div className="py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center px-4 max-w-md mx-auto">
              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarDays className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                No Pending Invites
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
                When students schedule slots, their connect requests will appear here for you to accept or decline.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
