import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiErrorResponse } from "@/app/lib/error-handler";

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

  // Create supabaseAdmin to modify the event and check profile
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Verify they are instructor/admin using supabaseAdmin to bypass RLS
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .maybeSingle();

  const role = profile?.role?.toLowerCase() || "user";
  if (role !== "instructor" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Mentor only feature." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { eventId, action } = body || {};

  if (!eventId || !action) {
    return NextResponse.json(
      { error: "eventId and action ('accept' or 'decline') are required." },
      { status: 400 }
    );
  }

  // 1. Fetch the event
  const { data: event, error: fetchError } = await supabaseAdmin
    .from("calendar_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (fetchError || !event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  // 2. Security Check: Verify event belongs to current mentor
  if (event.user_id !== currentUser.id) {
    return NextResponse.json({ error: "Unauthorized: Event does not belong to you." }, { status: 401 });
  }

  if (action === "accept") {
    // Parse student name, email from event.description
    let studentName = "Student";
    let studentEmail = "";

    const desc = event.description || "";
    const requestedByMatch = desc.match(/Requested by:\s*(.*?)\s*\((.*?)\)/);
    if (requestedByMatch) {
      studentName = requestedByMatch[1].trim();
      studentEmail = requestedByMatch[2].trim();
    }

    // Fetch mentor profile to check if cal_event_type_id is set
    const { data: mentorProfile } = await supabaseAdmin
      .from("profiles")
      .select("cal_event_type_id")
      .eq("id", currentUser.id)
      .maybeSingle();

    let meetLink = null;
    let bookingWarning: string | null = null;
    if (mentorProfile?.cal_event_type_id) {
      const eventTypeIdNum = Number(mentorProfile.cal_event_type_id);
      if (!isNaN(eventTypeIdNum) && eventTypeIdNum > 0) {
        const startDateTimeStr = `${event.event_date}T${event.event_time}`;
        const { createCalcomBooking } = await import("@/app/lib/calcom");
        const bookingResult = await createCalcomBooking({
          eventTypeId: eventTypeIdNum,
          startDateTimeStr,
          attendee: {
            name: studentName,
            email: studentEmail,
          }
        });
        if (bookingResult.success && bookingResult.meetingUrl) {
          meetLink = bookingResult.meetingUrl;
        } else if (!bookingResult.success) {
          bookingWarning = bookingResult.error || "Cal.com schedule error";
          console.warn("[mentor-planner/rsvp] Cal.com booking notice:", bookingResult.error);
        }
      }
    }

    // Update status:pending to status:accepted in the tag and store meet_link
    const newTag = (event.tag || "").replace("status:pending", "status:accepted");
    const updatePayload: Record<string, any> = {
      tag: newTag,
    };
    if (meetLink) {
      updatePayload.meet_link = meetLink;
    } else if (event.meet_link) {
      updatePayload.meet_link = event.meet_link;
    }

    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from("calendar_events")
      .update(updatePayload)
      .eq("id", eventId)
      .select()
      .single();

    if (updateError) {
      return apiErrorResponse(updateError, undefined, 500);
    }

    return NextResponse.json({ success: true, event: updatedEvent, warning: bookingWarning });
  } else if (action === "decline") {
    // Delete the event
    const { error: deleteError } = await supabaseAdmin
      .from("calendar_events")
      .delete()
      .eq("id", eventId);

    if (deleteError) {
      return apiErrorResponse(deleteError, undefined, 500);
    }

    return NextResponse.json({ success: true, message: "Request declined and deleted." });
  } else {
    return NextResponse.json({ error: "Invalid action. Must be 'accept' or 'decline'." }, { status: 400 });
  }
}
