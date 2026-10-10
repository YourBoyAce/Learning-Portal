import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceRoleClient } from "@/app/lib/supabase-server";
import { extractMeetingUrl } from "@/app/lib/calcom";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ error: "Empty request body." }, { status: 400 });
    }

    // Optional webhook signature verification if CAL_WEBHOOK_SECRET is set
    const calSecret = process.env.CAL_WEBHOOK_SECRET;
    const signature = request.headers.get("x-cal-signature-256");
    if (calSecret && signature) {
      const expectedSignature = crypto
        .createHmac("sha256", calSecret)
        .update(rawBody)
        .digest("hex");
      if (signature !== expectedSignature) {
        console.warn("[calcom-webhook] Signature verification failed.");
        return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
      }
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    // Support both Cal.com v1 ({ triggerEvent, payload }) and v2 ({ type, data }) shapes
    const triggerEvent: string =
      body?.triggerEvent || body?.type || body?.event || "UNKNOWN";
    const payload: any = body?.payload || body?.data || body;

    // DIAGNOSTIC LOGGING: Log the entire raw JSON body when booking events trigger
    if (
      triggerEvent === "BOOKING_CREATED" ||
      triggerEvent === "BOOKING_RESCHEDULED" ||
      triggerEvent === "BOOKING_CANCELLED"
    ) {
      console.log(`\n================== [CAL.COM WEBHOOK: ${triggerEvent}] ==================`);
      console.log(JSON.stringify(body, null, 2));
      console.log("========================================================================\n");
    } else {
      console.log(`[calcom-webhook] Received event: ${triggerEvent}`);
    }

    // Handle PING / TEST events from Cal.com webhook setup
    if (triggerEvent === "PING" || triggerEvent === "TEST" || triggerEvent === "webhook_test") {
      return NextResponse.json({ success: true, message: "Webhook ping received successfully." });
    }

    if (
      triggerEvent !== "BOOKING_CREATED" &&
      triggerEvent !== "BOOKING_RESCHEDULED" &&
      triggerEvent !== "BOOKING_CANCELLED"
    ) {
      return NextResponse.json({ received: true, ignoredEvent: triggerEvent });
    }

    const supabaseAdmin = createServiceRoleClient();

    // 1. Extract meeting URL
    const meetUrl = extractMeetingUrl(payload);
    console.log(`[calcom-webhook] Extracted meeting URL: ${meetUrl || "(None found)"}`);

    // 2. Parse booking date and time
    const startStr = payload?.startTime || payload?.start;
    let eventDate: string | null = null;
    let eventTime: string | null = null;

    if (startStr) {
      const startDate = new Date(startStr);
      if (!isNaN(startDate.getTime())) {
        eventDate = startDate.toISOString().split("T")[0]; // YYYY-MM-DD
        // Format time as HH:MM:SS
        const hours = String(startDate.getUTCHours()).padStart(2, "0");
        const minutes = String(startDate.getUTCMinutes()).padStart(2, "0");
        const seconds = String(startDate.getUTCSeconds()).padStart(2, "0");
        eventTime = `${hours}:${minutes}:${seconds}`;
      }
    }

    // 3. Extract attendee and organizer information
    const attendees = Array.isArray(payload?.attendees)
      ? payload.attendees
      : payload?.attendees
      ? [payload.attendees]
      : [];
    const attendee = attendees[0] || {};
    const attendeeEmail: string = attendee?.email?.trim() || "";
    const attendeeName: string = attendee?.name?.trim() || "Student";
    const organizerEmail: string = payload?.organizer?.email?.trim() || "";
    const eventTypeId = payload?.eventTypeId || payload?.event_type_id || null;

    // Handle cancellation
    if (triggerEvent === "BOOKING_CANCELLED") {
      if (eventDate && attendeeEmail) {
        const { error: cancelError } = await supabaseAdmin
          .from("calendar_events")
          .update({ tag: "status:cancelled", meet_link: null })
          .eq("event_date", eventDate)
          .like("description", `%${attendeeEmail}%`);

        if (cancelError) {
          console.error("[calcom-webhook] Error updating cancelled event:", cancelError);
        }
      }
      return NextResponse.json({ success: true, event: "BOOKING_CANCELLED" });
    }

    // 4. Try to find an existing event in calendar_events
    let matchedEvent: any = null;

    if (eventDate) {
      let query = supabaseAdmin
        .from("calendar_events")
        .select("*")
        .eq("event_date", eventDate);

      if (attendeeEmail) {
        query = query.like("description", `%${attendeeEmail}%`);
      }

      const { data: events, error: searchError } = await query;

      if (searchError) {
        console.error("[calcom-webhook] Supabase search error:", searchError);
      } else if (events && events.length > 0) {
        matchedEvent = events[0];
      }
    }

    // 5. Update existing event or insert a new one
    if (matchedEvent) {
      // Update the existing session with the Google Meet link and accepted status
      const updatedTag = (matchedEvent.tag || "").includes("status:accepted")
        ? matchedEvent.tag
        : (matchedEvent.tag || "").replace("status:pending", "status:accepted") || "status:accepted";

      const updateFields: Record<string, any> = {
        tag: updatedTag,
      };

      if (meetUrl) {
        updateFields.meet_link = meetUrl;
      }

      const { error: updateError } = await supabaseAdmin
        .from("calendar_events")
        .update(updateFields)
        .eq("id", matchedEvent.id);

      if (updateError) {
        console.error("[calcom-webhook] Error updating calendar event:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      console.log(
        `[calcom-webhook] Successfully updated calendar_event ${matchedEvent.id} with meet_link: ${meetUrl}`
      );

      return NextResponse.json({
        success: true,
        action: "updated",
        eventId: matchedEvent.id,
        meetUrl,
      });
    }

    // 6. Fallback: If no existing event matched, find the mentor profile and insert a new calendar_event
    let mentorUserId: string | null = null;

    if (organizerEmail) {
      const { data: mentorByEmail } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", organizerEmail)
        .maybeSingle();

      if (mentorByEmail?.id) {
        mentorUserId = mentorByEmail.id;
      }
    }

    if (!mentorUserId && eventTypeId) {
      const { data: mentorByEventType } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("cal_event_type_id", eventTypeId)
        .maybeSingle();

      if (mentorByEventType?.id) {
        mentorUserId = mentorByEventType.id;
      }
    }

    if (mentorUserId && eventDate && eventTime) {
      const formattedDescription = `${payload?.title || "1-on-1 Session"}\n\n---\nRequested by: ${attendeeName} (${attendeeEmail})\nDuration: ${payload?.duration || 30} minutes`;

      const { data: newEvent, error: insertError } = await supabaseAdmin
        .from("calendar_events")
        .insert({
          user_id: mentorUserId,
          title: payload?.title || `1-on-1 with ${attendeeName}`,
          description: formattedDescription,
          event_date: eventDate,
          event_time: eventTime,
          event_type: "session",
          tag: "status:accepted",
          meet_link: meetUrl,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[calcom-webhook] Error inserting new calendar_event:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      console.log(
        `[calcom-webhook] Created new calendar_event ${newEvent?.id} for mentor ${mentorUserId} with meet_link: ${meetUrl}`
      );

      return NextResponse.json({
        success: true,
        action: "created",
        eventId: newEvent?.id,
        meetUrl,
      });
    }

    console.warn(
      `[calcom-webhook] Could not match or create event. Date: ${eventDate}, Attendee: ${attendeeEmail}, Organizer: ${organizerEmail}`
    );

    return NextResponse.json({
      received: true,
      matched: false,
      meetUrl,
      note: "No matching calendar_event or mentor profile found.",
    });
  } catch (error: any) {
    console.error("[calcom-webhook] Fatal error processing webhook:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
