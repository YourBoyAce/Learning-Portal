import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCalcomBooking } from "@/app/lib/calcom";
import { apiErrorResponse, logError } from "@/app/lib/error-handler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const currentUser = authData.user;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Verify mentor and fetch their profile
  const { data: mentorProfile } = await supabaseAdmin
    .from("profiles")
    .select("role, cal_event_type_id")
    .eq("id", currentUser.id)
    .maybeSingle();

  const role = mentorProfile?.role?.toLowerCase() || "user";
  if (role !== "instructor" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Mentor only feature." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { eventId, meetLink: customMeetLink } = body || {};

  // Case 1: Mentor provides a custom / manual Google Meet link directly
  if (eventId && customMeetLink) {
    const trimmed = String(customMeetLink).trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      return NextResponse.json({ error: "Please enter a valid URL starting with https://" }, { status: 400 });
    }

    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from("calendar_events")
      .update({ meet_link: trimmed })
      .eq("id", eventId)
      .eq("user_id", currentUser.id)
      .select()
      .single();

    if (updateError) {
      return apiErrorResponse(updateError, undefined, 500);
    }

    return NextResponse.json({
      success: true,
      eventId,
      meetUrl: trimmed,
      message: "Meeting link saved successfully.",
    });
  }

  // Find targeted event or all accepted sessions missing meet_link
  let eventsQuery = supabaseAdmin
    .from("calendar_events")
    .select("*")
    .eq("user_id", currentUser.id);

  if (eventId) {
    eventsQuery = eventsQuery.eq("id", eventId);
  } else {
    eventsQuery = eventsQuery.like("tag", "%status:accepted%").is("meet_link", null);
  }

  const { data: events, error: fetchError } = await eventsQuery;

  if (fetchError) {
    return apiErrorResponse(fetchError, undefined, 500);
  }

  if (!events || events.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No pending sessions require meeting generation.",
    });
  }

  const results = [];
  let singleError: string | null = null;
  const { generateGoogleMeetLink } = await import("@/app/lib/calcom");

  for (const event of events) {
    let meetingUrl: string | null = null;
    let warning: string | null = null;

    if (mentorProfile?.cal_event_type_id) {
      // Parse student details
      let studentName = "Student";
      let studentEmail = "";

      const desc = event.description || "";
      const requestedByMatch = desc.match(/Requested by:\s*(.*?)\s*\((.*?)\)/);
      if (requestedByMatch) {
        studentName = requestedByMatch[1].trim();
        studentEmail = requestedByMatch[2].trim();
      }

      let eventTimeZone = "Asia/Calcutta";
      const tzMatch = (event.tag || "").match(/tz:([^|]+)/);
      if (tzMatch && tzMatch[1]) {
        eventTimeZone = tzMatch[1].trim();
      }

      const bookingResult = await createCalcomBooking({
        eventTypeId: Number(mentorProfile.cal_event_type_id),
        date: event.event_date,
        time: event.event_time,
        timeZone: eventTimeZone,
        attendee: {
          name: studentName,
          email: studentEmail,
          timeZone: eventTimeZone,
        },
      });

      meetingUrl = bookingResult.meetingUrl || generateGoogleMeetLink();
      warning = bookingResult.warning || null;
    } else {
      meetingUrl = generateGoogleMeetLink();
    }

    const { error: updateError } = await supabaseAdmin
      .from("calendar_events")
      .update({ meet_link: meetingUrl })
      .eq("id", event.id);

    if (updateError) {
      results.push({ eventId: event.id, success: false, error: logError(updateError).message });
    } else {
      results.push({
        eventId: event.id,
        success: true,
        meetingUrl: meetingUrl,
        warning: warning || null,
      });
    }
  }

  const anySuccess = results.some((r) => r.success);

  // If a single event was requested and failed, return an error status so UI can report it
  if (eventId && !anySuccess) {
    return NextResponse.json(
      { success: false, error: singleError || "Cal.com was unable to generate a meeting link for this time slot.", results },
      { status: 400 }
    );
  }

  const firstSuccessUrl = results.find((r) => r.success)?.meetingUrl;

  return NextResponse.json({
    success: anySuccess || results.length === 0,
    meetUrl: firstSuccessUrl,
    results,
    count: results.filter((r) => r.success).length,
    total: results.length,
  });
}
