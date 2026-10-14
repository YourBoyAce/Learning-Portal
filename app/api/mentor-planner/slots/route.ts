import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventTypeId = searchParams.get("eventTypeId");
  const date = searchParams.get("date"); // YYYY-MM-DD
  const timeZone = searchParams.get("timeZone") || "Asia/Calcutta";

  if (!eventTypeId || !date) {
    return NextResponse.json(
      { error: "eventTypeId and date are required parameters." },
      { status: 400 }
    );
  }

  const apiKey = process.env.CAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ slots: [], isFallback: true });
  }

  try {
    // Calculate end date (next day) for Cal.com slot query
    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    const endStr = endDate.toISOString().split("T")[0];

    const calUrl = `https://api.cal.com/v2/slots?eventTypeId=${encodeURIComponent(
      eventTypeId
    )}&start=${encodeURIComponent(date)}&end=${encodeURIComponent(
      endStr
    )}&timeZone=${encodeURIComponent(timeZone)}`;

    const res = await fetch(calUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": "2024-09-04",
      },
    });

    if (!res.ok) {
      console.warn(`[calcom-slots] Cal.com slots API returned ${res.status}`);
      return NextResponse.json({ slots: [], isFallback: true });
    }

    const data = await res.json();
    const rawSlotsByDate = data?.data || {};
    const slotsForDate: Array<{ start: string }> = rawSlotsByDate[date] || [];

    // Format slots for UI: [{ value: "13:00:00", label: "01:00 PM" }]
    const formattedSlots = slotsForDate.map((s) => {
      const slotDate = new Date(s.start);
      // Format time in the requested timeZone
      const timeStr = slotDate.toLocaleTimeString("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      // Also get 24-hr format HH:mm:00
      const hourFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const parts = hourFormatter.formatToParts(slotDate);
      const h = parts.find((p) => p.type === "hour")?.value || "00";
      const m = parts.find((p) => p.type === "minute")?.value || "00";
      const sVal = parts.find((p) => p.type === "second")?.value || "00";

      return {
        value: `${h}:${m}:${sVal}`,
        label: timeStr,
      };
    });

    return NextResponse.json({
      success: true,
      date,
      slots: formattedSlots,
    });
  } catch (error) {
    console.error("[calcom-slots] Error fetching Cal.com slots:", error);
    return NextResponse.json({ slots: [], isFallback: true });
  }
}
