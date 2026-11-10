export function parseTimeToMinutes(timeStr: string): number | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

export function computeDurationMinutes(
  startTime: string,
  endTime: string,
  fallback = 60,
): number {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  if (startMin === null || endMin === null || endMin <= startMin) {
    return fallback;
  }
  return endMin - startMin;
}

export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const startMin = parseTimeToMinutes(timeStr);
  if (startMin === null) return "";
  const totalMin = Math.min(23 * 60 + 59, Math.max(0, startMin + minutesToAdd));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function extractDurationFromTag(tag?: string | null, fallback = 60): number {
  if (!tag) return fallback;
  const match = tag.match(/dur:(\d+)/);
  if (!match) return fallback;
  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function extractCourseIdFromTag(tag?: string | null): string | null {
  if (!tag) return null;
  const match = tag.match(/(?:^|\|)course:([^|]+)/);
  return match?.[1]?.trim() || null;
}

export function splitEventDateTime(
  eventDateValue?: string | null,
  fallbackDate?: string | null,
  fallbackTime?: string | null,
): { date: string; startTime: string } {
  if (eventDateValue && eventDateValue.includes("T")) {
    const [dPart, tPart] = eventDateValue.split("T");
    const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(dPart) ? dPart : (fallbackDate || "");
    const cleanTime = tPart ? tPart.slice(0, 5) : (fallbackTime ? fallbackTime.slice(0, 5) : "10:00");
    return { date: cleanDate, startTime: cleanTime };
  }

  if (eventDateValue && /^\d{4}-\d{2}-\d{2}$/.test(eventDateValue)) {
    return {
      date: eventDateValue,
      startTime: fallbackTime ? fallbackTime.slice(0, 5) : "10:00",
    };
  }

  return {
    date: fallbackDate || "",
    startTime: fallbackTime ? fallbackTime.slice(0, 5) : "10:00",
  };
}

export function formatTime12Hour(timeStr: string): string {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return timeStr;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatLiveSessionSlot(params: {
  eventDate?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}): string {
  const { date, startTime } = splitEventDateTime(
    params.eventDate,
    params.date,
    params.startTime,
  );

  if (!date) {
    return params.eventDate || "Schedule TBA";
  }

  const parsedDate = new Date(`${date}T00:00:00`);
  if (isNaN(parsedDate.getTime())) {
    return params.eventDate || date;
  }

  const dateLabel = parsedDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (!startTime) {
    return dateLabel;
  }

  const startLabel = formatTime12Hour(startTime);
  if (params.endTime) {
    return `${dateLabel} · ${startLabel} – ${formatTime12Hour(params.endTime)}`;
  }
  return `${dateLabel} · ${startLabel}`;
}

export function isLiveSessionPast(params: {
  eventDate?: string | null;
  date?: string | null;
  startTime?: string | null;
  durationMinutes?: number;
}): boolean {
  const { date, startTime } = splitEventDateTime(
    params.eventDate,
    params.date,
    params.startTime,
  );

  const isoCandidate = date
    ? `${date}T${startTime || "23:59"}`
    : (params.eventDate || "");

  if (!isoCandidate) return false;
  const startDate = new Date(isoCandidate);
  if (isNaN(startDate.getTime())) return false;

  const durationMs = (params.durationMinutes ?? 120) * 60 * 1000;
  return Date.now() > startDate.getTime() + durationMs;
}

