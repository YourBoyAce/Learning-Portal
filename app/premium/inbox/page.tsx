"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import {
  Calendar,
  CheckCircle2,
  Clock3,
  Mail,
  Sparkles,
  XCircle,
} from "lucide-react";

interface WebinarInvite {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  tag: string;
  status: "pending" | "accepted" | "declined";
}

export default function PremiumInboxPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<WebinarInvite[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadInvites = async () => {
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
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map((row: any) => {
        const tag = row.tag || "";
        let status: WebinarInvite["status"] = "pending";

        if (tag.includes("status:accepted")) status = "accepted";
        else if (tag.includes("status:declined")) status = "declined";

        return {
          id: row.id,
          title: row.title || "Live webinar invitation",
          description: row.description || "",
          event_date: row.event_date || "",
          event_time: row.event_time || "09:00:00",
          tag,
          status,
        };
      });

      setInvites(mapped.filter((invite) => invite.status !== "declined"));
    } catch (error) {
      console.error("Failed to load premium webinar invites:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInvites();
  }, [router]);

  const handleInviteAction = async (
    eventId: string,
    action: "accept" | "decline",
  ) => {
    try {
      setProcessingId(eventId);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/premium/webinar-rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ eventId, action }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to update invite.");

      await loadInvites();
    } catch (error) {
      console.error("Invite action failed:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingInvites = invites.filter(
    (invite) => invite.status === "pending",
  );
  const acceptedInvites = invites.filter(
    (invite) => invite.status === "accepted",
  );

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="border-b border-gray-100 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
              <Mail className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-md">
              Premium Inbox
            </span>
          </div>
          <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>Inbox</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Your premium webinar invites and live session updates appear here.
          </p>
        </div>

        {loading ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center text-sm text-gray-500">
            Loading your premium invites...
          </div>
        ) : invites.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center space-y-4">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-gray-400">
              <Calendar size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-800">
                No active webinar invites
              </h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                New premium webinar invitations from the admin will show here as
                soon as they are sent.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {pendingInvites.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-500">
                  Pending invites
                </h2>
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-brand-primary font-bold text-[11px] uppercase tracking-[0.18em]">
                          <Sparkles className="w-3.5 h-3.5" />
                          Premium invite
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">
                          {invite.title}
                        </h2>
                        {invite.description && (
                          <p className="text-sm text-gray-600 leading-relaxed max-w-2xl whitespace-pre-wrap">
                            {invite.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(invite.event_date).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="w-3.5 h-3.5" />
                            {invite.event_time.slice(0, 5)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 lg:justify-end">
                        <Button
                          variant="outline"
                          onClick={() =>
                            handleInviteAction(invite.id, "decline")
                          }
                          disabled={processingId === invite.id}
                          className="gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Decline
                        </Button>
                        <Button
                          onClick={() =>
                            handleInviteAction(invite.id, "accept")
                          }
                          disabled={processingId === invite.id}
                          className="gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {processingId === invite.id
                            ? "Updating..."
                            : "Accept"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {acceptedInvites.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-500">
                  Accepted sessions
                </h2>
                {acceptedInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-emerald-600 font-bold text-[11px] uppercase tracking-[0.18em]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Accepted
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">
                          {invite.title}
                        </h2>
                        {invite.description && (
                          <p className="text-sm text-gray-600 leading-relaxed max-w-2xl whitespace-pre-wrap">
                            {invite.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(invite.event_date).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="w-3.5 h-3.5" />
                            {invite.event_time.slice(0, 5)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
