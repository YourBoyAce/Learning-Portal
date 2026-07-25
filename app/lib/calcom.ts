export async function createCalcomBooking(params: {
  eventTypeId: number;
  startDateTimeStr: string; // "YYYY-MM-DDT[HH]:[MM]:[SS]"
  attendee: {
    name: string;
    email: string;
  };
}) {
  const apiKey = process.env.CAL_API_KEY;
  const apiVersion = process.env.CAL_API_VERSION || "2026-05-01";

  if (!apiKey) {
    console.error("Cal.com API key is not configured in environment variables.");
    return { success: false, error: "Cal.com API key is not configured." };
  }

  // Parse start time as local time and format it as UTC ISO string for Cal.com
  const dateObj = new Date(params.startDateTimeStr);
  if (isNaN(dateObj.getTime())) {
    return { success: false, error: "Invalid date or time provided." };
  }
  const startIso = dateObj.toISOString();

  try {
    const response = await fetch("https://api.cal.com/v2/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "cal-api-version": apiVersion,
      },
      body: JSON.stringify({
        eventTypeId: params.eventTypeId,
        start: startIso,
        attendee: {
          name: params.attendee.name,
          email: params.attendee.email,
          timeZone: "UTC",
          language: "en",
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Cal.com API error response:", result);
      return { 
        success: false, 
        error: result?.message || result?.error?.message || `Cal.com error: ${response.statusText}` 
      };
    }

    const bookingData = result?.data;
    const meetingUrl = bookingData?.meetingUrl || bookingData?.location || null;

    return {
      success: true,
      bookingUid: bookingData?.uid,
      meetingUrl,
    };
  } catch (error: unknown) {
    console.error("Error creating Cal.com booking:", error);
    const message = error instanceof Error ? error.message : "Failed to create booking.";
    return { success: false, error: message };
  }
}
