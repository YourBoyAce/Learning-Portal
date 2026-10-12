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

    console.log(`[calcom-webhook] Received event: ${triggerEvent}`);

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
    const meetUrl =
      extractMeetingUrl(payload) ||
      extractMeetingUrl(body?.data) ||
      extractMeetingUrl(body);
    console.log(`[calcom-webhook] Extracted meeting URL: ${meetUrl || "(None found)"}`);

    // 2. Parse booking date and time
    const startStr = payload?.startTime || payload?.start || body?.data?.startTime || body?.data?.start;
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

    // 3. Extract attendee, organizer, and Event Type ID
    const attendees = Array.isArray(payload?.attendees)
      ? payload.attendees
      : payload?.attendees
      ? [payload.attendees]
      : Array.isArray(body?.data?.attendees)
      ? body.data.attendees
      : [];
    const attendee = attendees[0] || {};
    const attendeeEmail: string = attendee?.email?.trim() || "";
    const attendeeName: string = attendee?.name?.trim() || "Student";
    const organizerEmail: string =
      payload?.organizer?.email?.trim() ||
      body?.data?.organizer?.email?.trim() ||
      payload?.hosts?.[0]?.email?.trim() ||
      body?.data?.hosts?.[0]?.email?.trim() ||
      "";

    // Extract eventTypeId robustly across Cal.com v1 and v2 payload shapes
    const rawEventTypeId =
      payload?.eventTypeId ??
      payload?.event_type_id ??
      payload?.eventType?.id ??
      payload?.type?.id ??
      payload?.booking?.eventTypeId ??
      payload?.booking?.eventType?.id ??
      body?.data?.eventTypeId ??
      body?.data?.eventType?.id ??
      body?.data?.booking?.eventTypeId ??
      body?.eventTypeId ??
      null;

    const eventTypeId =
      rawEventTypeId !== null && rawEventTypeId !== undefined && !isNaN(Number(rawEventTypeId))
        ? Number(rawEventTypeId)
        : null;

    console.log(
      `[calcom-webhook] Parsed event: date=${eventDate}, time=${eventTime}, attendee=${attendeeEmail}, organizer=${organizerEmail}, eventTypeId=${eventTypeId}`
    );

    // 4. Resolve Target Mentor
    // When multiple mentors share the same Cal.com account, eventTypeId is the ONLY true differentiator!
    // We MUST prioritize cal_event_type_id lookup BEFORE organizerEmail.
    let targetMentorId: string | null = null;

    if (eventTypeId) {
      const { data: mentorByEventType } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .eq("cal_event_type_id", eventTypeId)
        .maybeSingle();

      if (mentorByEventType?.id) {
        targetMentorId = mentorByEventType.id;
        console.log(
          `[calcom-webhook] Resolved mentor ${mentorByEventType.full_name || mentorByEventType.email} (${targetMentorId}) via cal_event_type_id: ${eventTypeId}`
        );
      }
    }

    // Fallback to organizerEmail ONLY if eventTypeId did not match a mentor profile
    if (!targetMentorId && organizerEmail) {
      const { data: mentorByEmail } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", organizerEmail)
        .maybeSingle();

      if (mentorByEmail?.id) {
        targetMentorId = mentorByEmail.id;
        console.log(`[calcom-webhook] Resolved mentor (${targetMentorId}) via organizer email: ${organizerEmail}`);
      }
    }

    // Fallback to organizer username matching cal_link
    const organizerUsername =
      payload?.organizer?.username ||
      payload?.user?.username ||
      payload?.hosts?.[0]?.username;
    if (!targetMentorId && organizerUsername) {
      const { data: mentorByCalLink } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("cal_link", `%${organizerUsername}%`)
        .maybeSingle();

      if (mentorByCalLink?.id) {
        targetMentorId = mentorByCalLink.id;
        console.log(`[calcom-webhook] Resolved mentor (${targetMentorId}) via cal_link username: ${organizerUsername}`);
      }
    }

    // Handle cancellation
    if (triggerEvent === "BOOKING_CANCELLED") {
      if (eventDate && attendeeEmail && targetMentorId) {
        const { error: cancelError } = await supabaseAdmin
          .from("calendar_events")
          .update({ tag: "status:cancelled", meet_link: null })
          .eq("user_id", targetMentorId)
          .eq("event_date", eventDate)
          .like("description", `%${attendeeEmail}%`);

        if (cancelError) {
          console.error("[calcom-webhook] Error updating cancelled event:", cancelError);
        }
      } else {
        console.warn("[calcom-webhook] Skipping cancellation: missing mentor or event details.");
      }
      return NextResponse.json({ success: true, event: "BOOKING_CANCELLED" });
    }

    // 5. Match existing event in calendar_events
    // We prioritize matching the SPECIFIC mentor's event, especially unlinked sessions
    let matchedEvent: any = null;

    if (targetMentorId && attendeeEmail) {
      // Priority 1A: Specific mentor + date + attendee + missing meet_link (cleanest match)
      if (eventDate) {
        const { data: pendingMentorMatches } = await supabaseAdmin
          .from("calendar_events")
          .select("*")
          .eq("user_id", targetMentorId)
          .eq("event_date", eventDate)
          .is("meet_link", null)
          .ilike("description", `%${attendeeEmail}%`)
          .order("created_at", { ascending: false });

        if (pendingMentorMatches && pendingMentorMatches.length > 0) {
          matchedEvent = pendingMentorMatches[0];
          console.log(`[calcom-webhook] Matched mentor ${targetMentorId} pending event: ${matchedEvent.id}`);
        }
      }

      // Priority 1B: Specific mentor + date + attendee (even if meet_link is already set)
      if (!matchedEvent && eventDate) {
        const { data: exactMentorMatches } = await supabaseAdmin
          .from("calendar_events")
          .select("*")
          .eq("user_id", targetMentorId)
          .eq("event_date", eventDate)
          .ilike("description", `%${attendeeEmail}%`)
          .order("created_at", { ascending: false });

        if (exactMentorMatches && exactMentorMatches.length > 0) {
          matchedEvent = exactMentorMatches[0];
          console.log(`[calcom-webhook] Matched mentor ${targetMentorId} exact date event: ${matchedEvent.id}`);
        }
      }

      // Priority 1C: Specific mentor + attendee + missing meet_link (handles UTC timezone day shifts)
      if (!matchedEvent) {
        const { data: timezoneMentorMatches } = await supabaseAdmin
          .from("calendar_events")
          .select("*")
          .eq("user_id", targetMentorId)
          .is("meet_link", null)
          .ilike("description", `%${attendeeEmail}%`)
          .order("created_at", { ascending: false });

        if (timezoneMentorMatches && timezoneMentorMatches.length > 0) {
          matchedEvent = timezoneMentorMatches[0];
          console.log(`[calcom-webhook] Matched mentor ${targetMentorId} unlinked event via attendee fallback: ${matchedEvent.id}`);
        }
      }
    } else if (attendeeEmail) {
      // Fallback matching if target mentor could NOT be resolved via eventTypeId or organizerEmail
      if (eventDate) {
        const { data: unlinkedMatches } = await supabaseAdmin
          .from("calendar_events")
          .select("*")
          .eq("event_date", eventDate)
          .is("meet_link", null)
          .ilike("description", `%${attendeeEmail}%`)
          .order("created_at", { ascending: false });

        if (unlinkedMatches && unlinkedMatches.length > 0) {
          matchedEvent = unlinkedMatches[0];
        }
      }

      if (!matchedEvent && eventDate) {
        const { data: exactMatches } = await supabaseAdmin
          .from("calendar_events")
          .select("*")
          .eq("event_date", eventDate)
          .ilike("description", `%${attendeeEmail}%`)
          .order("created_at", { ascending: false });

        if (exactMatches && exactMatches.length > 0) {
          matchedEvent = exactMatches[0];
        }
      }

      if (!matchedEvent) {
        const { data: pendingMatches } = await supabaseAdmin
          .from("calendar_events")
          .select("*")
          .is("meet_link", null)
          .ilike("description", `%${attendeeEmail}%`)
          .order("created_at", { ascending: false });

        if (pendingMatches && pendingMatches.length > 0) {
          matchedEvent = pendingMatches[0];
        }
      }
    } else if (eventDate) {
      // Fallback matching by date only
      let dateQuery = supabaseAdmin
        .from("calendar_events")
        .select("*")
        .eq("event_date", eventDate)
        .is("meet_link", null);

      if (targetMentorId) {
        dateQuery = dateQuery.eq("user_id", targetMentorId);
      }

      const { data: dateMatches } = await dateQuery.order("created_at", { ascending: false });
      if (dateMatches && dateMatches.length > 0) {
        matchedEvent = dateMatches[0];
      }
    }

    // 6. Update existing event or insert a new one
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
        return NextResponse.json(
          { error: "Failed to update calendar event." },
          { status: 500 }
        );
      }

      console.log(
        `[calcom-webhook] Successfully updated calendar_event ${matchedEvent.id} for mentor ${matchedEvent.user_id} with meet_link: ${meetUrl}`
      );

      return NextResponse.json({
        success: true,
        action: "updated",
        eventId: matchedEvent.id,
        meetUrl,
      });
    }

    // 7. Fallback: If no existing event matched, insert a new calendar_event for targetMentorId
    if (targetMentorId && eventDate && eventTime) {
      const formattedDescription = `${payload?.title || "1-on-1 Session"}\n\n---\nRequested by: ${attendeeName} (${attendeeEmail})\nDuration: ${payload?.duration || 30} minutes`;

      const { data: newEvent, error: insertError } = await supabaseAdmin
        .from("calendar_events")
        .insert({
          user_id: targetMentorId,
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
        return NextResponse.json(
          { error: "Failed to create calendar event." },
          { status: 500 }
        );
      }

      console.log(
        `[calcom-webhook] Created new calendar_event ${newEvent?.id} for mentor ${targetMentorId} with meet_link: ${meetUrl}`
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
