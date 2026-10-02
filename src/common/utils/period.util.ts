import { AdminOrderPeriod } from "../../orders/dto/list-admin-orders.dto.js";


export function periodRange(period?: AdminOrderPeriod): {
  gte?: Date;
  lte?: Date;
} {
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfWeek = (d: Date) => {
    const day = d.getDay();
    const diff = (day + 6) % 7; // Monday start
    const x = startOfDay(d);
    x.setDate(x.getDate() - diff);
    return x;
  };
  const startOfMonth = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), 1);
  const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);

  switch (period) {
    case "today":
      return { gte: startOfDay(now) };
    case "this_week":
      return { gte: startOfWeek(now) };
    case "this_month":
      return { gte: startOfMonth(now) };
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { gte: first, lte: last };
    }
    case "this_year":
      return { gte: startOfYear(now) };
    case "all_time":
    default:
      return {};
  }
}

/** Monday–Sunday range for the current week. */
export function currentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const diff = (day + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

/** Previous week, same range shape. */
export function previousWeekRange(): { start: Date; end: Date } {
  const { start } = currentWeekRange();
  const prevMonday = new Date(start);
  prevMonday.setDate(start.getDate() - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);
  prevSunday.setHours(23, 59, 59, 999);
  return { start: prevMonday, end: prevSunday };
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}