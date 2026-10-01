/**
 * All dates handled here are "YYYY-MM-DD" in the *store's* timezone.
 * Do not use Date.toISOString() — that converts to UTC and can shift the day.
 */

export function toDateKey(d: Date): string {
  // Use local date parts, NOT toISOString()
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(key: string): Date {
  const d = parseDateKey(key);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(key: string): Date {
  const d = parseDateKey(key);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function eachDayInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = parseDateKey(from);
  const end = parseDateKey(to);
  while (cur <= end) {
    out.push(toDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function toTimeKey(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Turn "8:00 AM – 10:00 AM" into start "08:00" and end "10:00".
 * Falls back to defaults if the window doesn't match.
 */
export function parseDeliveryWindow(window: string | null | undefined): {
  startTime: string;
  endTime: string;
} {
  const fallback = { startTime: "08:00", endTime: "10:00" };
  if (!window) return fallback;

  // Try "HH:MM – HH:MM" 24h
  const h24 = window.match(/(\d{1,2}):(\d{2}).*?(\d{1,2}):(\d{2})/);
  if (h24) {
    const [, h1, m1, h2, m2] = h24;
    return {
      startTime: `${h1.padStart(2, "0")}:${m1}`,
      endTime: `${h2.padStart(2, "0")}:${m2}`,
    };
  }

  // Try "8:00 AM – 10:00 AM"
  const ampm = window.match(
    /(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i,
  );
  if (ampm) {
    const [, h1, m1, ap1, h2, m2, ap2] = ampm;
    return {
      startTime: to24(h1, m1, ap1),
      endTime: to24(h2, m2, ap2),
    };
  }

  return fallback;
}

function to24(h: string, m: string, ap?: string): string {
  let hour = parseInt(h, 10);
  const upper = (ap ?? "").toUpperCase();
  if (upper === "PM" && hour < 12) hour += 12;
  if (upper === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${m}`;
}