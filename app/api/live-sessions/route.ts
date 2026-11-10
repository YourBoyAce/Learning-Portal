import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserTier } from "@/app/actions/tier";
import { TIER_FEATURES } from "@/app/lib/tier.constants";
import { apiErrorResponse } from "@/app/lib/error-handler";
import {
  addMinutesToTime,
  extractCourseIdFromTag,
  extractDurationFromTag,
  splitEventDateTime,
} from "@/app/lib/live-session-helpers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const user = authData.user;
    const normalizedEmail = user.email?.trim().toLowerCase() ?? "";
    const isDemoPro = [
      "demouser@gmail.com",
      "user@example.com",
      "premium@gmail.com",
    ].includes(normalizedEmail);
    const tier = isDemoPro ? "Pro" : await getUserTier(token);
    const hasAccess = Boolean(tier && TIER_FEATURES[tier]?.includes("LiveSessions"));

    if (!hasAccess) {
      return NextResponse.json({ success: true, sessions: [], locked: true });
    }

    const { data: userEvents, error: eventsError } = await supabaseAdmin
      .from("calendar_events")
      .select("id, webinar_id, title, description, event_date, event_time, tag, meet_link, created_at")
      .eq("user_id", user.id)
      .eq("event_type", "webinar")
      .not("tag", "like", "%status:declined%")
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true });

    if (eventsError) throw eventsError;

    const webinarIds = Array.from(
      new Set(
        (userEvents ?? [])
          .map((e) => e.webinar_id)
          .filter((id): id is number | string => id !== null && id !== undefined),
      ),
    );

    interface WebinarRecord {
      id: number | string;
      title?: string | null;
      subtitle?: string | null;
      description?: string | null;
      event_date?: string | null;
      status?: string | null;
      link_text?: string | null;
      attendees_count?: number | null;
    }

    const webinarMap = new Map<string, WebinarRecord>();
    if (webinarIds.length > 0) {
      const { data: webinarRows, error: webinarsError } = await supabaseAdmin
        .from("webinars")
        .select("*")
        .in("id", webinarIds);

      if (webinarsError) throw webinarsError;
      for (const w of (webinarRows ?? []) as WebinarRecord[]) {
        webinarMap.set(String(w.id), w);
      }
    }

    const courseIdsFromEvents = Array.from(
      new Set(
        (userEvents ?? [])
          .map((ev) => extractCourseIdFromTag(ev.tag))
          .filter((cid): cid is string => Boolean(cid)),
      ),
    );
    const courseTitleById = new Map<string, string>();
    if (courseIdsFromEvents.length > 0) {
      const { data: courseRows } = await supabaseAdmin
        .from("maincourses")
        .select("id, title")
        .in("id", courseIdsFromEvents);
      for (const c of courseRows ?? []) {
        if (c.id && c.title) {
          courseTitleById.set(String(c.id), c.title);
        }
      }
    }

    const seenKeys = new Set<string>();
    const sessions = [];

    for (const ev of userEvents ?? []) {
      const wKey = ev.webinar_id != null ? String(ev.webinar_id) : `event-${ev.id}`;
      if (seenKeys.has(wKey)) continue;
      seenKeys.add(wKey);

      const webinar = ev.webinar_id != null ? webinarMap.get(String(ev.webinar_id)) : null;
      // If webinar_id was deleted by admin, skip orphaned row
      if (ev.webinar_id != null && !webinar) continue;

      const durationMinutes = extractDurationFromTag(ev.tag, 60);
      const courseId = extractCourseIdFromTag(ev.tag) || "";
      const courseTitle = courseId ? (courseTitleById.get(courseId) || "") : "";
      const { date, startTime } = splitEventDateTime(
        webinar?.event_date,
        ev.event_date,
        ev.event_time,
      );
      const endTime = startTime ? addMinutesToTime(startTime, durationMinutes) : "";
      const meetingLink = ev.meet_link || webinar?.link_text || "";

      sessions.push({
        id: webinar?.id ?? ev.id,
        title: webinar?.title || ev.title,
        subtitle: webinar?.subtitle || "",
        description: webinar?.description || ev.description || "",
        event_date: webinar?.event_date || (date && startTime ? `${date}T${startTime}` : date),
        date,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        course_id: courseId,
        course_title: courseTitle,
        status: meetingLink ? "link" : (webinar?.status || "streaming"),
        link_text: meetingLink,
        attendees_count: webinar?.attendees_count || 0,
      });
    }

    return NextResponse.json({
      success: true,
      sessions,
      locked: false,
    });
  } catch (error) {
    return apiErrorResponse(error, "GET /api/live-sessions", 500);
  }
}
