"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLoading } from "@/app/context/LoadingContext";
import { supabase, resolveUserName } from "@/app/lib/supabase";
import { useSecurityGatedData } from "@/app/hooks/useSecurityGatedData";
import { UpgradeRequired } from "@/app/components/UpgradeRequired";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import UserAvatar from "@/app/components/UserAvatar";
import { getPremiumMentors } from "@/app/actions/get-premium-mentors";
import { Button } from "@/components/ui/button";
import Cal, { getCalApi } from "@calcom/embed-react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Trash2,
  X,
  Mail,
  Sparkles,
  Lock,
  CalendarDays,
  Grid,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Video
} from "lucide-react";

// Types
interface Mentor {
  id: string;
  full_name: string;
  email?: string;
  role: string;
  cal_link: string;
  mentor_bio: string;
  mentor_expertise: string[];
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  event_date: string; // YYYY-MM-DD
  event_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS (inferred or customized)
  event_type: "video" | "course" | "session" | "webinar";
  tag: string; // Used to store specific labels like "Blocked" or "Connect"
  meet_link?: string | null;
}

export default function MentorConnectPage() {
  const formatLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const dateVal = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${dateVal}`;
  };

  const { setLoading: setGlobalLoading } = useLoading();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [currentUserPhone, setCurrentUserPhone] = useState<string>("");

  // Student view states
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const { isLoading: isTierLoading, canAccess } = useSecurityGatedData();
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [isCalModalOpen, setIsCalModalOpen] = useState(false);

  // Mentor view states
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"workweek" | "week">("workweek");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Add Event Form State
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formDuration, setFormDuration] = useState("60"); // in minutes
  const [formType, setFormType] = useState<"blocked" | "connect" | "webinar">("blocked");
  const [formDescription, setFormDescription] = useState("");
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | ""; text: string }>({
    type: "",
    text: "",
  });

  // Custom Student Connect Request form states
  const [requestDate, setRequestDate] = useState("");
  const [requestTime, setRequestTime] = useState("09:00");
  const [requestDuration, setRequestDuration] = useState("60");
  const [requestTopic, setRequestTopic] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isGeneratingMeet, setIsGeneratingMeet] = useState(false);
  const [manualMeetLink, setManualMeetLink] = useState("");
  const [isSavingManualMeet, setIsSavingManualMeet] = useState(false);
  const [meetActionFeedback, setMeetActionFeedback] = useState<{ type: "success" | "error" | ""; text: string }>({
    type: "",
    text: "",
  });
  const [requestMessage, setRequestMessage] = useState<{ type: "success" | "error" | ""; text: string }>({
    type: "",
    text: "",
  });

  // Availability settings
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]); // Monday to Friday (1-5) by default
  const [workingStart, setWorkingStart] = useState<string>("09:00");
  const [workingEnd, setWorkingEnd] = useState<string>("21:00"); // 9 PM
  const [isAvailPanelOpen, setIsAvailPanelOpen] = useState(false);

  // Loader state
  const isCurrentlyLoading = loading || isTierLoading;

  useEffect(() => {
    try {
      const storedDays = localStorage.getItem("mentor_working_days");
      const storedStart = localStorage.getItem("mentor_working_start");
      const storedEnd = localStorage.getItem("mentor_working_end");

      if (storedDays) setWorkingDays(JSON.parse(storedDays));
      if (storedStart) setWorkingStart(storedStart);
      if (storedEnd) setWorkingEnd(storedEnd);
    } catch (e) {
      console.error("Failed to load availability settings:", e);
    }
  }, []);

  const handleSaveAvailability = (days: number[], start: string, end: string) => {
    setWorkingDays(days);
    setWorkingStart(start);
    setWorkingEnd(end);
    try {
      localStorage.setItem("mentor_working_days", JSON.stringify(days));
      localStorage.setItem("mentor_working_start", start);
      localStorage.setItem("mentor_working_end", end);
    } catch (e) {
      console.error("Failed to save availability settings:", e);
    }
  };

  useEffect(() => {
    setGlobalLoading(isCurrentlyLoading);
    return () => setGlobalLoading(false);
  }, [isCurrentlyLoading, setGlobalLoading]);

  // Load user role and initial details
  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;

        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, full_name, phone")
          .eq("id", user.id)
          .single();

        const role = profile?.role || "user";
        setCurrentUserRole(role);
        const resolvedName = await resolveUserName(supabase, user.id, user.email);
        setCurrentUserName(resolvedName);
        if (profile?.phone) setCurrentUserPhone(profile.phone);

        if (role === "instructor" || role === "admin") {
          await loadCalendarEvents(user.id);
        } else {
          await loadMentors();
        }
      } catch (err) {
        console.error("Error loading user state:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  // Fetch mentors for Student View based on their premium courses
  async function loadMentors() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMentors([]);
        return;
      }

      const { mentors: premiumMentors, error } = await getPremiumMentors(session.access_token);

      if (error) {
        throw new Error(error);
      }

      setMentors(premiumMentors || []);
    } catch (err) {
      console.error("Error loading mentors:", err);
      setMentors([]);
    }
  }

  // Fetch Calendar Events for Mentor View
  async function loadCalendarEvents(userId: string) {
    try {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, title, description, event_date, event_time, event_type, tag, meet_link")
        .or(`user_id.eq.${userId},description.ilike.%Student ID: ${userId}%`);

      if (error) {
        // Fallback to high fidelity mock data if DB table or query fails
        console.warn("DB calendar query failed. Loading local mock schedule.", error);
        loadMockEvents();
        return;
      }

      if (data) {
        const activeEvents = data.filter((e: any) => !e.tag || !e.tag.includes("status:pending"));
        console.log("Planner loaded active events:", activeEvents);
        const formattedEvents: CalendarEvent[] = activeEvents.map((e: any) => {
          // Parse tag to calculate end_time or fall back to 1 hour
          let durationMin = 60;
          if (e.tag) {
            const match = e.tag.match(/dur:(\d+)/);
            if (match) {
              durationMin = parseInt(match[1], 10) || 60;
            } else if (e.tag.startsWith("dur:")) {
              durationMin = parseInt(e.tag.replace("dur:", ""), 10) || 60;
            }
          }
          const endTimeStr = addMinutesToTimeString(e.event_time, durationMin);

          return {
            id: e.id,
            title: e.title,
            description: e.description || "",
            event_date: e.event_date,
            event_time: e.event_time,
            end_time: endTimeStr,
            event_type: e.event_type,
            tag: e.tag || "",
            meet_link: e.meet_link,
          };
        });
        setEvents(formattedEvents);
      }
    } catch (err) {
      console.error("Error loading calendar events:", err);
      loadMockEvents();
    }
  }

  // Fallback high-fidelity mock events representing MS Teams timeline
  function loadMockEvents() {
    const today = new Date();
    const formatDateStr = (d: Date) => formatLocalDateStr(d);

    const getDayOffset = (dayOfWeekIndex: number) => {
      const currentDay = today.getDay(); // Sun = 0, Mon = 1, etc.
      const distance = dayOfWeekIndex - (currentDay === 0 ? 7 : currentDay); // adjust Sunday
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + distance);
      return formatDateStr(targetDate);
    };

    const mock: CalendarEvent[] = [
      {
        id: "mock-1",
        title: "1-on-1 Student Connect",
        description: "Study sync with demo scholar on frontend components.",
        event_date: getDayOffset(1), // Monday
        event_time: "10:00:00",
        end_time: "11:00:00",
        event_type: "session",
        tag: "Connect",
      },
      {
        id: "mock-2",
        title: "Blocked Time - Focus block",
        description: "Reserved for curriculum development and content recording.",
        event_date: getDayOffset(1), // Monday
        event_time: "14:00:00",
        end_time: "16:30:00",
        event_type: "session",
        tag: "Blocked",
      },
      {
        id: "mock-3",
        title: "Webinar: Intro to Next.js",
        description: "Weekly live cohort webinar regarding Next.js routes and loaders.",
        event_date: getDayOffset(2), // Tuesday
        event_time: "11:00:00",
        end_time: "12:30:00",
        event_type: "webinar",
        tag: "Webinar",
      },
      {
        id: "mock-4",
        title: "Blocked Time - Private",
        description: "Out of office - external meetings.",
        event_date: getDayOffset(3), // Wednesday
        event_time: "09:00:00",
        end_time: "10:30:00",
        event_type: "session",
        tag: "Blocked",
      },
      {
        id: "mock-5",
        title: "1-on-1 Student Connect",
        description: "Mock interview and review of Capstone architectures.",
        event_date: getDayOffset(4), // Thursday
        event_time: "15:00:00",
        end_time: "16:00:00",
        event_type: "session",
        tag: "Connect",
      },
      {
        id: "mock-6",
        title: "Weekly Instructor Sync",
        description: "Platform curriculum alignment sync.",
        event_date: getDayOffset(5), // Friday
        event_time: "11:00:00",
        end_time: "12:00:00",
        event_type: "session",
        tag: "Connect",
      },
    ];
    setEvents(mock);
  }

  // Time String Helpers
  function addMinutesToTimeString(timeStr: string, mins: number): string {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0);
    const newDate = new Date(date.getTime() + mins * 60000);
    return `${String(newDate.getHours()).padStart(2, "0")}:${String(newDate.getMinutes()).padStart(2, "0")}:00`;
  }

  // Initialize Cal.com styling parameters for student view
  useEffect(() => {
    (async function () {
      try {
        const cal = await getCalApi();
        cal("ui", {
          theme: "light",
          styles: { branding: { brandColor: "#0f172a" } },
          hideEventTypeDetails: false,
          layout: "month_view",
        });
      } catch (e) {
        console.error("Failed to initialize Cal.com Embed API:", e);
      }
    })();
  }, []);

  // Open booking embed modal for students
  const handleOpenBooking = (mentor: Mentor) => {
    setSelectedMentor(mentor);
    setIsCalModalOpen(true);
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMentor || !currentUserId) return;

    setIsSubmittingRequest(true);
    setRequestMessage({ type: "", text: "" });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Authentication token not found. Please log in again.");

      const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Calcutta";
      const res = await fetch("/api/mentor-planner/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mentorId: selectedMentor.id,
          date: requestDate,
          time: requestTime,
          duration: requestDuration,
          topic: requestTopic,
          timeZone: clientTz,
        }),
      });

      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || "Failed to submit request.");

      setRequestMessage({ type: "success", text: "Your booking request was sent to the mentor! You will be notified when they RSVP." });
      setRequestDate("");
      setRequestTopic("");
      setTimeout(() => {
        setIsCalModalOpen(false);
        setRequestMessage({ type: "", text: "" });
      }, 1200);
    } catch (err: any) {
      console.error("Error submitting connect request:", err);
      setRequestMessage({ type: "error", text: err.message || "Failed to send request." });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // --- MS Teams Weekly Scheduler Helpers ---

  // Get Monday date of the current date week
  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setDate(diff));
  };

  const startOfWeek = getStartOfWeek(currentDate);

  // Generate days based on workweek (Mon-Fri) or fullweek (Mon-Sun)
  const getDaysArray = () => {
    const daysCount = viewMode === "workweek" ? 5 : 7;
    const arr = [];
    for (let i = 0; i < daysCount; i++) {
      const nextDay = new Date(startOfWeek);
      nextDay.setDate(startOfWeek.getDate() + i);
      arr.push(nextDay);
    }
    return arr;
  };

  const days = getDaysArray();

  // Navigation handlers
  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleGoToday = () => {
    setCurrentDate(new Date());
  };

  // Format date headers (e.g. "Mon 20")
  const formatDateHeader = (d: Date) => {
    const daysNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      name: daysNames[d.getDay()],
      num: d.getDate(),
      fullStr: formatLocalDateStr(d),
      isToday: new Date().toDateString() === d.toDateString(),
    };
  };

  // Generate schedule hours list (9:00 to 21:00)
  const hours = Array.from({ length: 13 }, (_, i) => 9 + i); // 9, 10, 11 ... 21

  // Calculate top offset and height for events based on timeslots
  const calculateEventPosition = (event: CalendarEvent) => {
    const [startHour, startMin] = event.event_time.split(":").map(Number);
    const [endHour, endMin] = event.end_time.split(":").map(Number);

    const startDecimal = startHour + startMin / 60;
    const endDecimal = endHour + endMin / 60;

    const startHourOffset = 9; // Grid starts at 9:00 AM
    const rowHeight = 70; // 70px per hour row

    const top = (startDecimal - startHourOffset) * rowHeight;
    const height = Math.max((endDecimal - startDecimal) * rowHeight, 35); // minimum height 35px

    return { top, height };
  };

  // Click handler on empty time grids
  const handleCellClick = (dateStr: string, hour: number) => {
    setFormDate(dateStr);
    setFormStartTime(`${String(hour).padStart(2, "0")}:00`);
    setFormTitle("");
    setFormDescription("");
    setFormDuration("60");
    setFormType("blocked");
    setMessage({ type: "", text: "" });
    setIsAddModalOpen(true);
  };

  // Save new schedule event/block
  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;

    setIsSubmittingEvent(true);
    setMessage({ type: "", text: "" });

    const calculatedEndTime = addMinutesToTimeString(`${formStartTime}:00`, parseInt(formDuration, 10));

    // To respect Supabase check constraints, type must be 'session' or 'webinar'
    const dbType = formType === "webinar" ? "webinar" : "session";
    // We store the specific sub-type (Blocked/Connect) in the tag metadata column
    const dbTag = formType === "blocked" ? "Blocked" : formType === "connect" ? "Connect" : "Webinar";
    const finalTag = `dur:${formDuration}|${dbTag}`;

    const newDbEvent = {
      user_id: currentUserId,
      title: formTitle.trim(),
      description: formDescription.trim(),
      event_date: formDate,
      event_time: `${formStartTime}:00`,
      event_type: dbType,
      tag: finalTag,
    };

    try {
      const { data, error } = await supabase
        .from("calendar_events")
        .insert([newDbEvent])
        .select();

      if (error) throw error;

      // Reload scheduling grid from DB
      await loadCalendarEvents(currentUserId);
      setIsAddModalOpen(false);
    } catch (err) {
      console.error("Failed to insert event to database. Falling back to local state updates.", err);
      // Fallback state logic
      const localMockEvent: CalendarEvent = {
        id: `local-${Date.now()}`,
        title: formTitle.trim() || (formType === "blocked" ? "Blocked Time" : "Office Hours"),
        description: formDescription.trim(),
        event_date: formDate,
        event_time: `${formStartTime}:00`,
        end_time: calculatedEndTime,
        event_type: dbType,
        tag: dbTag,
      };
      setEvents((prev) => [...prev, localMockEvent]);
      setIsAddModalOpen(false);
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  // Delete event handler
  const handleDeleteEvent = async (eventToDelete: CalendarEvent) => {
    if (!currentUserId) return;

    try {
      if (eventToDelete.id.startsWith("mock-") || eventToDelete.id.startsWith("local-")) {
        // Remove locally if mock
        setEvents((prev) => prev.filter((e) => e.id !== eventToDelete.id));
        setIsDetailsModalOpen(false);
        return;
      }

      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventToDelete.id);

      if (error) throw error;

      await loadCalendarEvents(currentUserId);
      setIsDetailsModalOpen(false);
    } catch (err) {
      console.error("Failed to delete event:", err);
      // Fallback local remove
      setEvents((prev) => prev.filter((e) => e.id !== eventToDelete.id));
      setIsDetailsModalOpen(false);
    }
  };

  // Generate meet link on-demand for accepted sessions missing a meet_link
  const handleGenerateMeet = async (targetEventId?: string) => {
    const idToGenerate = targetEventId || selectedEvent?.id;
    setIsGeneratingMeet(true);
    setMeetActionFeedback({ type: "", text: "" });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/mentor-planner/generate-meet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          eventId: idToGenerate,
        }),
      });

      const result = await res.json().catch(() => null);

      if (!res.ok || !result?.success) {
        throw new Error(result?.error || "Failed to generate meet link via Cal.com.");
      }

      const generatedUrl = result.meetUrl || (result.results?.[0]?.meetingUrl);

      if (currentUserId) {
        await loadCalendarEvents(currentUserId);
      }

      if (idToGenerate && generatedUrl) {
        setSelectedEvent((prev) => (prev && prev.id === idToGenerate ? { ...prev, meet_link: generatedUrl } : prev));
        setEvents((prev) =>
          prev.map((e) => (e.id === idToGenerate ? { ...e, meet_link: generatedUrl } : e))
        );
      }

      setMeetActionFeedback({
        type: "success",
        text: "Google Meet link generated successfully!",
      });
    } catch (err: any) {
      console.error("Failed to generate meet link:", err);
      setMeetActionFeedback({
        type: "error",
        text: err.message || "Failed to generate meet link.",
      });
    } finally {
      setIsGeneratingMeet(false);
    }
  };

  const handleSaveManualMeetLink = async () => {
    if (!selectedEvent || !manualMeetLink.trim()) return;
    setIsSavingManualMeet(true);
    setMeetActionFeedback({ type: "", text: "" });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/mentor-planner/generate-meet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          meetLink: manualMeetLink.trim(),
        }),
      });

      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) {
        throw new Error(result?.error || "Failed to save meeting link.");
      }

      const savedUrl = manualMeetLink.trim();
      setSelectedEvent((prev) => (prev ? { ...prev, meet_link: savedUrl } : null));
      setEvents((prev) =>
        prev.map((e) => (e.id === selectedEvent.id ? { ...e, meet_link: savedUrl } : e))
      );
      setMeetActionFeedback({
        type: "success",
        text: "Meeting link saved successfully!",
      });
      setManualMeetLink("");
    } catch (err: any) {
      console.error("Failed to save manual meet link:", err);
      setMeetActionFeedback({
        type: "error",
        text: err.message || "Failed to save meeting link.",
      });
    } finally {
      setIsSavingManualMeet(false);
    }
  };

  // Helper date text range formatter (e.g. "July 20 - July 26, 2026")
  const getWeekRangeLabel = () => {
    const endOfWeekDate = new Date(startOfWeek);
    endOfWeekDate.setDate(startOfWeek.getDate() + (viewMode === "workweek" ? 4 : 6));

    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const startStr = startOfWeek.toLocaleDateString("en-US", options);
    const endStr = endOfWeekDate.toLocaleDateString("en-US", { ...options, year: "numeric" });

    return `${startStr} — ${endStr}`;
  };

  // Render Loader
  if (isCurrentlyLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-surface-page">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  // --- MENTOR / ADMIN PLANNER VIEW (Microsoft Teams style) ---
  if (currentUserRole === "instructor" || currentUserRole === "admin") {
    return (
      <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 font-sans text-gray-900">
        <div className="max-w-[1400px] mx-auto space-y-6">
          
          {/* Header Dashboard section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 text-left">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-6 h-6 text-brand-primary" />
                Teams Calendar Planner
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Configure your week timeline layout, schedule connect availability, and manage blocked slots.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setIsAvailPanelOpen(!isAvailPanelOpen)}
                variant="outline"
                className="rounded-xl px-4 py-2 border-slate-205 text-slate-700 font-bold text-xs flex items-center gap-1.5 hover:bg-slate-50"
              >
                <Clock size={15} /> Availability Settings
              </Button>
              <Button
                onClick={() => {
                  setFormDate(new Date().toISOString().split("T")[0]);
                  setFormStartTime("09:00");
                  setFormTitle("");
                  setFormDescription("");
                  setFormDuration("60");
                  setFormType("blocked");
                  setMessage({ type: "", text: "" });
                  setIsAddModalOpen(true);
                }}
                className="rounded-xl px-4 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Plus size={15} /> New Slot
              </Button>
            </div>
          </div>

          {/* Availability Settings Card Panel */}
          {isAvailPanelOpen && (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm text-left space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-brand-primary" />
                  <h3 className="text-sm font-extrabold text-slate-900">Custom Weekly Availability</h3>
                </div>
                <button
                  onClick={() => setIsAvailPanelOpen(false)}
                  className="p-1 hover:bg-slate-50 rounded-full text-slate-400"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                {/* Days checkboxes */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Available Days</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { val: 1, label: "Mon" },
                      { val: 2, label: "Tue" },
                      { val: 3, label: "Wed" },
                      { val: 4, label: "Thu" },
                      { val: 5, label: "Fri" },
                      { val: 6, label: "Sat" },
                      { val: 0, label: "Sun" },
                    ].map((d) => {
                      const isChecked = workingDays.includes(d.val);
                      return (
                        <button
                          key={d.val}
                          type="button"
                          onClick={() => {
                            const newDays = isChecked
                              ? workingDays.filter((val) => val !== d.val)
                              : [...workingDays, d.val];
                            handleSaveAvailability(newDays, workingStart, workingEnd);
                          }}
                          className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                            isChecked
                              ? "bg-brand-primary text-white border-transparent"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-100"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Working hours selects */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Start Time</label>
                    <select
                      value={workingStart}
                      onChange={(e) => handleSaveAvailability(workingDays, e.target.value, workingEnd)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs text-slate-855 focus:outline-none focus:border-brand-primary cursor-pointer font-semibold"
                    >
                      {Array.from({ length: 12 }, (_, i) => 8 + i).map((h) => {
                        const str = `${String(h).padStart(2, "0")}:00`;
                        return <option key={str} value={str}>{h === 12 ? "12:00 PM" : h > 12 ? `${h-12}:00 PM` : `${h}:00 AM`}</option>;
                      })}
                    </select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">End Time</label>
                    <select
                      value={workingEnd}
                      onChange={(e) => handleSaveAvailability(workingDays, workingStart, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs text-slate-855 focus:outline-none focus:border-brand-primary cursor-pointer font-semibold"
                    >
                      {Array.from({ length: 13 }, (_, i) => 9 + i).map((h) => {
                        const str = `${String(h).padStart(2, "0")}:00`;
                        return <option key={str} value={str}>{h === 12 ? "12:00 PM" : h > 12 ? `${h-12}:00 PM` : `${h}:00 AM`}</option>;
                      })}
                    </select>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Configuring availability marks the selected weekdays and hours as active. All times outside this window will be greyed out as blocked.
              </p>
            </div>
          )}

          {/* Teams Toolbar */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 text-left">
            
            {/* Week navigation */}
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoToday}
                className="text-xs font-semibold px-3 py-1.5 border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Today
              </Button>
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden shrink-0">
                <button
                  onClick={handlePrevWeek}
                  className="p-2 hover:bg-slate-50 border-r border-slate-200 text-slate-600 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleNextWeek}
                  className="p-2 hover:bg-slate-50 text-slate-600 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <h2 className="text-sm font-bold text-slate-800 ml-2">
                {getWeekRangeLabel()}
              </h2>
            </div>

            {/* View toggles & Legends */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Legend Indicators */}
              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500 mr-2">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-300"></span>
                  <span>Blocked</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300"></span>
                  <span>Office Connect</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-indigo-100 border border-indigo-300"></span>
                  <span>Webinars</span>
                </div>
              </div>

              {/* View options */}
              <div className="bg-slate-100/70 p-0.5 rounded-lg flex border border-slate-200/50">
                <button
                  onClick={() => setViewMode("workweek")}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-md transition-all ${
                    viewMode === "workweek"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Work week
                </button>
                <button
                  onClick={() => setViewMode("week")}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-md transition-all ${
                    viewMode === "week"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Week
                </button>
              </div>
            </div>

          </div>

          {/* Teams Planner Schedule Grid */}
          <div className="bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            
            {/* Week day headers */}
            <div className="grid border-b border-slate-100 bg-slate-50/50" style={{
              gridTemplateColumns: `60px repeat(${days.length}, 1fr)`
            }}>
              {/* Time axis spacing */}
              <div className="border-r border-slate-100 h-12"></div>
              {days.map((day, idx) => {
                const header = formatDateHeader(day);
                return (
                  <div
                    key={idx}
                    className={`px-2 py-3 text-center flex flex-col justify-center items-center border-r border-slate-100 last:border-r-0 relative ${
                      header.isToday ? "bg-blue-50/20" : ""
                    }`}
                  >
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${
                      header.isToday ? "text-brand-primary" : "text-slate-400"
                    }`}>
                      {header.name}
                    </span>
                    <span className={`text-base font-extrabold mt-0.5 flex items-center justify-center w-7 h-7 rounded-full ${
                      header.isToday ? "bg-brand-primary text-white" : "text-slate-800"
                    }`}>
                      {header.num}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Grid Hours and Events Area */}
            <div className="relative overflow-y-auto max-h-[75vh] light-scrollbar flex" style={{ height: `${hours.length * 70}px` }}>
              
              {/* Hour time headers along left column */}
              <div className="w-[60px] bg-slate-50/30 border-r border-slate-100 shrink-0 text-right select-none relative">
                {hours.map((hour, idx) => (
                  <div
                    key={hour}
                    className="text-[10px] font-bold text-slate-400 pr-2 absolute w-full text-right"
                    style={{ top: `${idx * 70}px`, transform: "translateY(-50%)" }}
                  >
                    {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </div>
                ))}
              </div>

              {/* Day slots grid area */}
              <div className="flex-1 grid relative" style={{
                gridTemplateColumns: `repeat(${days.length}, 1fr)`
              }}>
                
                {/* Horizontal row lines */}
                {hours.map((_, idx) => (
                  <div
                    key={idx}
                    className="absolute left-0 right-0 border-t border-slate-100 pointer-events-none"
                    style={{ top: `${idx * 70}px` }}
                  />
                ))}

                {days.map((day, dayIdx) => {
                  const dayStr = formatLocalDateStr(day);
                  
                  // Filter events for this specific day
                  const dayEvents = events.filter((e) => e.event_date === dayStr);
                  console.log("Planner render day:", dayStr, "matched events:", dayEvents);

                  return (
                    <div
                      key={dayIdx}
                      className="border-r border-slate-100 last:border-0 relative h-full group"
                    >
                      {/* Grid cells clickable per hour */}
                      {hours.map((hour, hourIdx) => {
                        const dayOfWeek = day.getDay();
                        const isWorkingDay = workingDays.includes(dayOfWeek);
                        
                        const [startHour] = workingStart.split(":").map(Number);
                        const [endHour] = workingEnd.split(":").map(Number);
                        const isWorkingHour = hour >= startHour && hour < endHour;
                        
                        const isUnavailable = !isWorkingDay || !isWorkingHour;

                        return (
                          <div
                            key={hour}
                            onClick={() => !isUnavailable && handleCellClick(dayStr, hour)}
                            className={`absolute w-full h-[70px] transition-colors border-t border-slate-100/50 ${
                              isUnavailable
                                ? "bg-stripe-pattern cursor-not-allowed select-none flex items-center justify-center"
                                : "hover:bg-slate-50/60 cursor-crosshair"
                            }`}
                            style={{
                              top: `${hourIdx * 70}px`,
                            }}
                          >
                            {isUnavailable && (
                              <span className="text-[9px] font-bold text-slate-400/80 tracking-wider uppercase">
                                Blocked
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {/* Render absolute positioned events */}
                      {dayEvents.map((event) => {
                        const { top, height } = calculateEventPosition(event);
                        // Hide if completely outside grid range (9 AM - 9 PM, which is top from 0 to 13 * 70)
                        if (top + height < 0 || top > 13 * 70) return null;

                        const isBlocked = event.tag.includes("Blocked") || event.tag === "Blocked";
                        const isWebinar = event.event_type === "webinar" || event.tag.includes("Webinar");
                        
                        // Clamp visual parameters to fit in the container cleanly
                        const clampedTop = Math.max(0, top);
                        const clampedHeight = Math.min(height, 13 * 70 - clampedTop);
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(event);
                              setManualMeetLink("");
                              setMeetActionFeedback({ type: "", text: "" });
                              setIsDetailsModalOpen(true);
                            }}
                            className={`absolute left-1 right-1 rounded-xl border overflow-hidden shadow-sm flex hover:shadow transition-all text-left cursor-pointer z-10 ${
                              height < 45 ? "p-1 px-2.5 flex-row items-center justify-between gap-2" : "p-2 flex-col justify-between"
                            } ${
                              isBlocked
                                ? "bg-slate-150 border-slate-300 text-slate-700 bg-stripe-pattern"
                                : isWebinar
                                  ? "bg-indigo-50 border-indigo-200 hover:border-indigo-300 text-indigo-900"
                                  : "bg-emerald-50 border-emerald-200 hover:border-emerald-300 text-emerald-900"
                            }`}
                            style={{
                              top: `${clampedTop}px`,
                              height: `${clampedHeight}px`,
                            }}
                          >
                            <div className={height < 45 ? "flex-1 min-w-0" : "space-y-1.5"}>
                              <h4 className={`font-extrabold leading-snug truncate ${
                                height < 45 ? "text-[10px]" : "text-[11px] line-clamp-2"
                              }`}>
                                {event.title}
                              </h4>
                              {height >= 45 && event.description && (
                                <p className="text-[10px] text-slate-500 line-clamp-1 leading-normal">
                                  {event.description}
                                </p>
                              )}
                            </div>
                            
                            {height >= 45 ? (
                              <div className="flex items-center gap-1 text-[9px] font-bold mt-1 text-slate-400">
                                <Clock size={9} />
                                <span>
                                  {event.event_time.slice(0, 5)} - {event.end_time.slice(0, 5)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-500 shrink-0 bg-white/70 px-1.5 py-0.5 rounded border border-slate-200/50">
                                {event.event_time.slice(0, 5)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

              </div>

            </div>

          </div>

        </div>

        {/* --- ADD SCHEDULE BLOCK MODAL --- */}
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 text-left">
              
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Schedule Slot</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Define blocked places of time or connects.</p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:bg-slate-150 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateEventSubmit} className="p-6 space-y-4">
                
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Title / Label</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Blocked - Study review"
                    className="w-full bg-slate-50 border border-slate-100 focus:border-brand-primary focus:bg-white focus:outline-none rounded-xl px-4 py-2.5 text-xs text-slate-800 font-medium transition-all"
                  />
                </div>

                {/* Event Type */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Slot Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormType("blocked");
                        setFormTitle("Blocked Time - Focus Block");
                      }}
                      className={`py-2 px-3 rounded-xl border text-[11px] font-bold text-center transition-all ${
                        formType === "blocked"
                          ? "bg-slate-900 text-white border-transparent"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-100"
                      }`}
                    >
                      Blocked Block
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormType("connect");
                        setFormTitle("1-on-1 Student Connect");
                      }}
                      className={`py-2 px-3 rounded-xl border text-[11px] font-bold text-center transition-all ${
                        formType === "connect"
                          ? "bg-slate-900 text-white border-transparent"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-100"
                      }`}
                    >
                      Office Hours
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormType("webinar");
                        setFormTitle("Live Cohort Webinar");
                      }}
                      className={`py-2 px-3 rounded-xl border text-[11px] font-bold text-center transition-all ${
                        formType === "webinar"
                          ? "bg-slate-900 text-white border-transparent"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-100"
                      }`}
                    >
                      Live Webinar
                    </button>
                  </div>
                </div>

                {/* Time & Duration row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Start Time</label>
                    <input
                      type="time"
                      required
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Duration (min)</label>
                    <select
                      value={formDuration}
                      onChange={(e) => setFormDuration(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-primary cursor-pointer"
                    >
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="90">1.5 hours</option>
                      <option value="120">2 hours</option>
                      <option value="180">3 hours</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Notes / Notes</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    placeholder="Short description..."
                    className="w-full bg-slate-50 border border-slate-100 focus:border-brand-primary focus:bg-white focus:outline-none rounded-xl px-4 py-3 text-xs text-slate-650 leading-relaxed resize-none"
                  />
                </div>

                {/* Create submit action */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmittingEvent}
                    className="w-full py-3 rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold transition-all justify-center"
                  >
                    {isSubmittingEvent ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding Slot...
                      </>
                    ) : (
                      "Add Schedule Slot"
                    )}
                  </Button>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* --- EVENT DETAILS & DELETE MODAL --- */}
        {isDetailsModalOpen && selectedEvent && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100 text-left">
              
              {/* Modal header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-800">Event Details</h3>
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="p-1 text-slate-400 hover:bg-slate-150 rounded-full"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                    selectedEvent.tag.includes("Blocked")
                      ? "bg-slate-150 text-slate-600 border-slate-200"
                      : selectedEvent.event_type === "webinar"
                        ? "bg-indigo-50 text-indigo-600 border-indigo-150"
                        : "bg-emerald-50 text-emerald-600 border-emerald-150"
                  }`}>
                    {selectedEvent.tag.includes("Blocked") ? "Blocked Block" : selectedEvent.event_type === "webinar" ? "Cohort Webinar" : "Office Hours"}
                  </span>
                  <h4 className="text-base font-extrabold text-slate-900 mt-1.5">{selectedEvent.title}</h4>
                </div>

                <div className="space-y-2 border-y border-slate-50 py-3 text-xs text-slate-500 font-semibold space-y-2">
                  <div className="flex items-center gap-2">
                    <CalendarIcon size={14} className="text-slate-400" />
                    <span>Date: {selectedEvent.event_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    <span>Time: {selectedEvent.event_time.slice(0, 5)} — {selectedEvent.end_time.slice(0, 5)}</span>
                  </div>
                </div>

                {selectedEvent.description && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Description</p>
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {selectedEvent.description}
                    </p>
                  </div>
                )}

                {/* Meet Link generation/join details */}
                {selectedEvent.tag.includes("status:accepted") && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Meeting Link</p>
                    {selectedEvent.meet_link ? (
                      <div className="space-y-2">
                        <Button
                          onClick={() => window.open(selectedEvent.meet_link!, "_blank")}
                          className="w-full py-2.5 rounded-xl text-xs font-bold bg-brand-primary text-white flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Video size={14} /> Join Meeting
                        </Button>
                        <p className="text-[10px] text-slate-400 break-all text-center">
                          {selectedEvent.meet_link}
                        </p>
                      </div>
                    ) : (
                      currentUserRole?.toLowerCase() === "instructor" || currentUserRole?.toLowerCase() === "admin" ? (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2.5 text-[11px] text-amber-900 leading-relaxed">
                          <div className="flex gap-1.5 items-start">
                            <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="font-bold">Meet link not yet generated</p>
                          </div>
                          <p className="text-[10px] text-amber-700">
                            A Google Meet link has not been generated for this session yet.
                          </p>

                          {meetActionFeedback.text && (
                            <div className={`p-2 rounded-lg text-[10px] font-semibold border ${
                              meetActionFeedback.type === "success"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-red-50 text-red-800 border-red-200"
                            }`}>
                              {meetActionFeedback.text}
                            </div>
                          )}

                          <Button
                            onClick={() => handleGenerateMeet(selectedEvent.id)}
                            disabled={isGeneratingMeet || isSavingManualMeet}
                            className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white text-[11px] py-2 h-auto rounded-lg font-bold flex items-center justify-center gap-1.5"
                          >
                            {isGeneratingMeet ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating via Cal.com...</>
                            ) : (
                              <><Video size={13} /> Generate Google Meet Link</>
                            )}
                          </Button>

                          {/* Manual fallback input */}
                          <div className="pt-2 border-t border-amber-200/60 space-y-1.5">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-amber-800 block">
                              Or Enter / Paste Google Meet Link Manually:
                            </label>
                            <div className="flex gap-1.5">
                              <input
                                type="url"
                                value={manualMeetLink}
                                onChange={(e) => setManualMeetLink(e.target.value)}
                                placeholder="https://meet.google.com/abc-defg-hij"
                                className="flex-1 bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-800 focus:outline-none focus:border-brand-primary font-mono"
                              />
                              <Button
                                type="button"
                                disabled={!manualMeetLink.trim() || isSavingManualMeet}
                                onClick={handleSaveManualMeetLink}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[10px] h-auto rounded-lg font-bold shrink-0"
                              >
                                {isSavingManualMeet ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                              </Button>
                            </div>
                          </div>

                          <Button
                            onClick={() => window.location.href = "/profile"}
                            variant="outline"
                            className="w-full text-slate-600 border-slate-200 text-[10px] py-1.5 h-auto rounded-lg font-semibold bg-white"
                          >
                            Cal.com Profile Settings
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex gap-2 items-center text-[11px] text-slate-500 font-semibold">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />
                          <span>Waiting for mentor to generate Google Meet link.</span>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 flex gap-3">
                  <Button
                    onClick={() => handleDeleteEvent(selectedEvent)}
                    variant="destructive"
                    className="w-full justify-center py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    <Trash2 size={14} /> Remove Time Slot
                  </Button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    );
  }

  // --- STANDARD SCHOLAR / STUDENT VIEW (Mentor connect cards directory) ---
  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6 text-left">
          <div>
            <h1 className={`${TYPOGRAPHY_CLASSES.MAIN_HEADING} flex items-center gap-2.5`}>
              <CalendarIcon className="w-7 h-7 text-brand-primary" />
              Mentor Connect
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Connect 1-on-1 with cohort instructors and industry experts to unblock learning.
            </p>
          </div>

          {!isCurrentlyLoading && (
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-gray-700">
                {mentors.length} Mentor{mentors.length !== 1 ? "s" : ""} Available
              </span>
            </div>
          )}
        </div>

        {/* Content Section */}
        {!isTierLoading && !canAccess("Mentorship") && (
          <div className="mb-6">
            <UpgradeRequired 
              title="1-on-1 Mentorship Locked" 
              description="1-on-1 mentor booking sessions are exclusively available to Pro and Premium tier members. Upgrade today to schedule live sessions with your assigned instructors." 
              requiredTier="Pro" 
              userEmail={currentUserEmail}
              userName={currentUserName}
              userPhone={currentUserPhone}
              compact={true}
            />
          </div>
        )}

        {/* Mentors Grid */}
        {mentors.length === 0 ? (
          <div className="py-16 px-4 bg-white border border-gray-100 rounded-3xl text-center shadow-sm max-w-3xl mx-auto my-8">
            <div className="mx-auto w-16 h-16 bg-blue-50 text-brand-primary rounded-full flex items-center justify-center mb-4">
              <CalendarDays className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Mentors Assigned</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              There are no mentors currently assigned to your courses. If you believe this is a mistake, please reach out to support.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mentors.map((mentor) => (
              <div
                key={mentor.id}
                className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-gray-200 transition-all group min-h-[340px] text-left relative overflow-hidden"
              >
                <div className="space-y-5">
                  {/* Header: Avatar + Role Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <UserAvatar
                      name={mentor.full_name}
                      email={mentor.email || ""}
                      size={60}
                      textSize="text-xl"
                    />
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      mentor.role === "Lead Mentor"
                        ? "bg-purple-50 text-purple-700 border-purple-100"
                        : "bg-blue-50 text-blue-700 border-blue-100"
                    }`}>
                      {mentor.role}
                    </span>
                  </div>

                  {/* Profile Information */}
                  <div>
                    <h3 className="font-bold text-gray-900 leading-snug text-base group-hover:text-brand-primary transition-colors">
                      {mentor.full_name}
                    </h3>
                    {mentor.email && (
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5 truncate flex items-center gap-1">
                        <Mail size={10} /> {mentor.email}
                      </p>
                    )}
                  </div>

                  {/* Bio */}
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 bg-gray-50 p-3 rounded-2xl border border-gray-50">
                    {mentor.mentor_bio}
                  </p>

                  {/* Expertise Tags */}
                  {mentor.mentor_expertise.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {mentor.mentor_expertise.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] font-bold text-gray-500 bg-gray-100/70 border border-gray-100 rounded px-1.5 py-0.5"
                        >
                          {tag}
                        </span>
                      ))}
                      {mentor.mentor_expertise.length > 3 && (
                        <span className="text-[9px] font-bold text-brand-primary bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
                          +{mentor.mentor_expertise.length - 3} More
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* CTA button */}
                <div className="pt-5 border-t border-gray-50 mt-5">
                  {canAccess("Mentorship") ? (
                    <Button
                      onClick={() => handleOpenBooking(mentor)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all bg-brand-primary hover:bg-brand-primary/95 text-white"
                    >
                      <CalendarIcon size={14} />
                      Schedule 1-on-1
                    </Button>
                  ) : (
                    <Button
                      onClick={() => router.push("/upgrade")}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                    >
                      <Lock size={14} />
                      Upgrade to Schedule
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Calendar Modal */}
      {isCalModalOpen && selectedMentor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-100">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 text-left">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Request Connect with {selectedMentor.full_name}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Propose a date and time for your 1-on-1 connect.
                </p>
              </div>
              <button
                onClick={() => setIsCalModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleRequestSubmit} className="p-6 space-y-4 text-left">
              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Propose Date</label>
                <input
                  type="date"
                  required
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-primary font-semibold"
                />
              </div>

              {/* Time & Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Propose Start Time</label>
                  <select
                    value={requestTime}
                    onChange={(e) => setRequestTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-primary cursor-pointer font-semibold"
                  >
                    {Array.from({ length: 13 }, (_, i) => 9 + i).map((h) => {
                      const str = `${String(h).padStart(2, "0")}:00`;
                      return <option key={str} value={str}>{h === 12 ? "12:00 PM" : h > 12 ? `${h-12}:00 PM` : `${h}:00 AM`}</option>;
                    })}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Duration</label>
                  <select
                    value={requestDuration}
                    onChange={(e) => setRequestDuration(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-primary cursor-pointer font-semibold"
                  >
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                  </select>
                </div>
              </div>

              {/* Description/Topic */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">What do you need help with? (Topic)</label>
                <textarea
                  required
                  value={requestTopic}
                  onChange={(e) => setRequestTopic(e.target.value)}
                  rows={4}
                  placeholder="e.g. Reviewing backend API route code block or capstone project details."
                  className="w-full bg-slate-50 border border-slate-100 focus:border-brand-primary focus:bg-white focus:outline-none rounded-xl px-4 py-3 text-xs text-slate-700 leading-relaxed resize-none font-medium"
                />
              </div>

              {requestMessage.text && (
                <div className={`text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 ${
                  requestMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-250"
                    : "bg-red-50 text-red-700 border border-red-250"
                }`}>
                  <AlertCircle size={14} />
                  <span>{requestMessage.text}</span>
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="w-full py-3 rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold transition-all justify-center"
                >
                  {isSubmittingRequest ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending Request...
                    </>
                  ) : (
                    "Submit Connect Request"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
