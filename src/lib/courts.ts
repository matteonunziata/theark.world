import type { Offering } from "@/lib/schedule";

export type Court = {
  id: string;
  name: string;
  sport: string;
  open_time: string;
  close_time: string;
  slot_minutes: number;
};

export const SPORTS = [
  ["padel", "Padel"],
  ["pickleball", "Pickleball"],
] as const;

export const BOOKING_DAYS = 14;
export const PER_DAY = 2;

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** The bookable slots of a court, as "HH:MM" start and end. */
export function slots(c: Pick<Court, "open_time" | "close_time" | "slot_minutes">) {
  const out: { start: string; end: string }[] = [];
  const close = toMin(c.close_time);
  for (let t = toMin(c.open_time); t + c.slot_minutes <= close; t += c.slot_minutes) {
    out.push({ start: toTime(t), end: toTime(t + c.slot_minutes) });
  }
  return out;
}

/** Do two "HH:MM" ranges overlap? */
export const overlapsTime = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);

/**
 * A class at the courts that covers this slot, if any. Same rule as the
 * database (court_class_at): "padel" or "pickleball" in the title blocks
 * that sport's courts; any other class at the courts blocks them all.
 */
export function classAt(
  court: Pick<Court, "sport">,
  slot: { start: string; end: string },
  classes: Pick<Offering, "title" | "location" | "start_time" | "end_time">[],
) {
  return (
    classes.find((o) => {
      if (!o.location?.toLowerCase().includes("court") || !o.start_time || !o.end_time) return false;
      if (!overlapsTime(slot, { start: o.start_time.slice(0, 5), end: o.end_time.slice(0, 5) })) return false;
      const t = o.title.toLowerCase();
      if (t.includes("padel")) return court.sport === "padel";
      if (t.includes("pickleball")) return court.sport === "pickleball";
      return true;
    })?.title ?? null
  );
}

export const hhmm = (t: string) => t.slice(0, 5);
