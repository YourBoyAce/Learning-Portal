/**
 * Helper to reliably isolate Google Meet / video call URLs from Cal.com payloads.
 * Ensures placeholder strings like "integrations:google:meet" are never treated as valid URLs.
 */
export function extractMeetingUrl(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;

  const candidates: unknown[] = [
    payload.metadata?.videoCallUrl,
    payload.videoCallUrl,
    payload.meetingUrl,
    payload.location,
    // Google Calendar conference entries
    payload.conferenceData?.entryPoints?.find(
      (e: any) =>
        e?.entryPointType === "video" ||
        (typeof e?.uri === "string" && e.uri.includes("meet.google.com"))
    )?.uri,
    // External references
    payload.references?.find(
      (r: any) =>
        r?.type === "google_meet" ||
        (typeof r?.meetingUrl === "string" && r.meetingUrl.includes("meet.google.com"))
    )?.meetingUrl,
    // Nested booking objects
    payload.booking?.meetingUrl,
    payload.booking?.metadata?.videoCallUrl,
    payload.booking?.location,
  ];

  for (const item of candidates) {
    if (typeof item === "string" && item.trim().startsWith("http")) {
      return item.trim();
    }
  }

  return null;
}

/**
 * Format a date & time with a given timezone into an exact UTC ISO string for Cal.com API v2.
 * Defaults to "Asia/Calcutta" (UTC+05:30) if no timezone is provided.
 */
export function formatCalcomStartIso(params: {
  date?: string;
  time?: string;
  startDateTimeStr?: string;
  timeZone?: string;
}): string {
  let dateStr = params.date || "";
  let timeStr = params.time || "";
  const timeZone = params.timeZone || "Asia/Calcutta";

  if (params.startDateTimeStr) {
    // If it already includes timezone info (+/- or Z), parse directly
    if (params.startDateTimeStr.includes("Z") || /[+-]\d{2}:\d{2}$/.test(params.startDateTimeStr)) {
      return new Date(params.startDateTimeStr).toISOString();
    }
    const [d, t] = params.startDateTimeStr.split("T");
    if (d) dateStr = d;
    if (t) timeStr = t;
  }

  const dateMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}/);
  const cleanDate = dateMatch ? dateMatch[0] : new Date().toISOString().split("T")[0];

  const timeParts = timeStr.split(":");
  const h = String(timeParts[0] || "09").padStart(2, "0");
  const m = String(timeParts[1] || "00").padStart(2, "0");
  const s = String(timeParts[2] || "00").padStart(2, "0");
  const cleanTime = `${h}:${m}:${s}`;

  const localIsoString = `${cleanDate}T${cleanTime}`;

  // Asia/Calcutta / Asia/Kolkata has constant UTC+05:30 offset (no DST)
  if (!timeZone || timeZone === "Asia/Calcutta" || timeZone === "Asia/Kolkata") {
    return new Date(`${localIsoString}+05:30`).toISOString();
  }

  if (timeZone === "UTC" || timeZone === "Etc/UTC") {
    return new Date(`${localIsoString}Z`).toISOString();
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const d = new Date(`${localIsoString}Z`);
    const parts = Object.fromEntries(
      formatter.formatToParts(d).map((p) => [p.type, p.value])
    );
    const tzDate = new Date(
      Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour) === 24 ? 0 : Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
      )
    );
    const offsetMs = tzDate.getTime() - d.getTime();
    const utcMs = new Date(`${localIsoString}Z`).getTime() - offsetMs;
    return new Date(utcMs).toISOString();
  } catch {
    return new Date(`${localIsoString}+05:30`).toISOString();
  }
}

export async function createCalcomBooking(params: {
  eventTypeId: number;
  startDateTimeStr?: string;
  date?: string;
  time?: string;
  timeZone?: string;
  attendee: {
    name: string;
    email: string;
    timeZone?: string;
  };
}) {
  const apiKey = process.env.CAL_API_KEY;
  const apiVersion = process.env.CAL_API_VERSION || "2026-05-01";

  if (!apiKey) {
    console.error("[calcom] Cal.com API key is not configured in environment variables.");
    return { success: false, error: "Cal.com API key is not configured." };
  }

  const effectiveTz = params.timeZone || params.attendee.timeZone || "Asia/Calcutta";
  const startIso = formatCalcomStartIso({
    date: params.date,
    time: params.time,
    startDateTimeStr: params.startDateTimeStr,
    timeZone: effectiveTz,
  });

  console.log(`[calcom] Creating booking for eventTypeId=${params.eventTypeId}, startIso=${startIso}, timeZone=${effectiveTz}`);

  try {
    const response = await fetch("https://api.cal.com/v2/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "cal-api-version": apiVersion,
      },
      body: JSON.stringify({
        eventTypeId: Number(params.eventTypeId),
        start: startIso,
        attendee: {
          name: params.attendee.name,
          email: params.attendee.email,
          timeZone: effectiveTz,
          language: "en",
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[calcom] Cal.com API error response:", result);
      let errorMsg =
        result?.error?.message ||
        result?.message ||
        (result?.error?.details?.message ? String(result.error.details.message) : null) ||
        `Cal.com error (${response.status}): ${response.statusText}`;

      if (response.status === 409 || errorMsg.includes("already has booking") || errorMsg.includes("not available")) {
        errorMsg = "Slot unavailable: The selected time conflicts with the mentor's Google Calendar or existing bookings.";
      } else if (response.status === 400 && errorMsg.includes("minimum booking notice")) {
        errorMsg = "Booking notice error: This event type requires advance notice or cannot be booked for this time.";
      }

      return {
        success: false,
        error: errorMsg,
      };
    }

    const bookingData = result?.data;
    let meetingUrl = extractMeetingUrl(bookingData);

    // If meetingUrl is not immediately available, Google Calendar conference generation might take 1-2 seconds
    if (!meetingUrl && bookingData?.uid) {
      console.log(`[calcom] Meeting URL not in immediate response for ${bookingData.uid}, waiting for conference generation...`);
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const bookingDetailRes = await fetch(`https://api.cal.com/v2/bookings/${bookingData.uid}`, {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "cal-api-version": apiVersion,
          },
        });
        if (bookingDetailRes.ok) {
          const detailJson = await bookingDetailRes.json();
          meetingUrl = extractMeetingUrl(detailJson?.data) || extractMeetingUrl(detailJson);
          console.log(`[calcom] Polled meeting URL for ${bookingData.uid}: ${meetingUrl || "(still pending)"}`);
        }
      } catch (pollErr) {
        console.warn("[calcom] Could not fetch detailed booking for video URL:", pollErr);
      }
    }

    return {
      success: true,
      bookingUid: bookingData?.uid,
      meetingUrl,
    };
  } catch (error: unknown) {
    console.error("[calcom] Error creating Cal.com booking:", error);
    const message = error instanceof Error ? error.message : "Failed to create booking.";
    return { success: false, error: message };
  }
}
