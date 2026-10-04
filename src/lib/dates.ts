// Calendar-date helpers on YYYY-MM-DD strings (no time zones involved),
// ported from the prototype.

export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DOW_LONG = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

export const pd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const ds = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => {
  const d = pd(s);
  d.setUTCDate(d.getUTCDate() + n);
  return ds(d);
};
export const dow = (s: string) => pd(s).getUTCDay();
/** Monday of the week containing s. */
export const weekStart = (s: string) => addDays(s, -((dow(s) + 6) % 7));

/** Today in a time zone, as YYYY-MM-DD. */
export function todayIn(timeZone = "America/Costa_Rica") {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return ds(new Date());
  }
}

export const fmtDate = (
  s: string,
  opt: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  },
) => pd(s).toLocaleDateString("en-US", { ...opt, timeZone: "UTC" });

export const fmtTime = (t: string | null | undefined) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const hh = ((h + 11) % 12) + 1;
  return m ? `${hh}:${String(m).padStart(2, "0")}${ap}` : `${hh}${ap}`;
};

export const timeRange = (o: {
  start_time: string | null;
  end_time: string | null;
}) =>
  o.start_time
    ? fmtTime(o.start_time) + (o.end_time ? `–${fmtTime(o.end_time)}` : "")
    : "";

export const dayLabel = (s: string, today: string) =>
  s === today
    ? "Today"
    : s === addDays(today, 1)
      ? "Tomorrow"
      : fmtDate(s, { weekday: "long", month: "long", day: "numeric" });

export const monthKey = (s: string) => s.slice(0, 7);
export const addMonths = (k: string, n: number) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
export const monthLabel = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};
export const shortMonth = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
};
