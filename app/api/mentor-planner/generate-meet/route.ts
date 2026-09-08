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

  if (!mentorProfile?.cal_event_type_id) {
    return NextResponse.json({ error: "Cal.com Event Type ID is not configured on your profile." }, { status: 400 });
  }

  // Find all calendar_events owned by the mentor where meet_link IS NULL AND tag contains status:accepted
  const { data: events, error: fetchError } = await supabaseAdmin
    .from("calendar_events")
    .select("*")
    .eq("user_id", currentUser.id)
    .is("meet_link", null)
    .like("tag", "%status:accepted%");

  if (fetchError) {
    return apiErrorResponse(fetchError, undefined, 500);
  }

  if (!events || events.length === 0) {
    return NextResponse.json({ success: true, message: "No pending sessions require meeting generation." });
  }

  const results = [];

  for (const event of events) {
    // Parse student details
    let studentName = "Student";
    let studentEmail = "";

    const desc = event.description || "";
    const requestedByMatch = desc.match(/Requested by:\s*(.*?)\s*\((.*?)\)/);
    if (requestedByMatch) {
      studentName = requestedByMatch[1].trim();
      studentEmail = requestedByMatch[2].trim();
    }

    const startDateTimeStr = `${event.event_date}T${event.event_time}`;
    const bookingResult = await createCalcomBooking({
      eventTypeId: mentorProfile.cal_event_type_id,
      startDateTimeStr,
      attendee: {
        name: studentName,
        email: studentEmail,
      }
    });

    if (bookingResult.success && bookingResult.meetingUrl) {
      // Update event with meet_link
      const { error: updateError } = await supabaseAdmin
        .from("calendar_events")
        .update({ meet_link: bookingResult.meetingUrl })
        .eq("id", event.id);

      if (updateError) {
        results.push({ eventId: event.id, success: false, error: logError(updateError).message });
      } else {
        results.push({ eventId: event.id, success: true, meetingUrl: bookingResult.meetingUrl });
      }
    } else {
      results.push({ eventId: event.id, success: false, error: bookingResult.error || "Failed to create booking." });
    }
  }

  return NextResponse.json({ success: true, results });
}
