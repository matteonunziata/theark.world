// "Add to calendar" links for a booked session (Google, plus .ics for
// Apple Calendar and Outlook).

import { addDays } from "@/lib/dates";

export type CalEvent = {
  title: string;
  date: string; // YYYY-MM-DD, local to the org
  start: string | null; // HH:MM[:SS]
  end: string | null;
  location: string | null;
  details?: string;
  timeZone?: string;
};

/** Local wall-clock time in a time zone, as a UTC Date. */
function zoned(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (asLocal - guess));
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function range(e: CalEvent) {
  const tz = e.timeZone ?? "America/Costa_Rica";
  if (!e.start) {
    const day = (d: string) => d.replace(/-/g, "");
    return { allDay: true, from: day(e.date), to: day(addDays(e.date, 1)) };
  }
  const from = zoned(e.date, e.start, tz);
  const to = e.end ? zoned(e.date, e.end, tz) : new Date(from.getTime() + 60 * 60 * 1000);
  return { allDay: false, from: stamp(from), to: stamp(to) };
}

export function googleCalendarUrl(e: CalEvent) {
  const r = range(e);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${r.from}/${r.to}`,
    details: e.details ?? "",
    location: e.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

const icsEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export function icsFile(e: CalEvent & { uid: string }) {
  const r = range(e);
  const when = r.allDay
    ? [`DTSTART;VALUE=DATE:${r.from}`, `DTEND;VALUE=DATE:${r.to}`]
    : [`DTSTART:${r.from}`, `DTEND:${r.to}`];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The ARK//ARK OS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@theark.world`,
    `DTSTAMP:${stamp(new Date())}`,
    ...when,
    `SUMMARY:${icsEscape(e.title)}`,
    e.location ? `LOCATION:${icsEscape(e.location)}` : "",
    e.details ? `DESCRIPTION:${icsEscape(e.details)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
