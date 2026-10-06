import type { Offering } from "@/lib/schedule";

export type Court = {
  id: string;
  name: string;
  sport: string;
  open_time: string;
  close_time: string;
  slot_minutes: number;
};

/** A court as the public page sees it: with its price per slot. */
export type PublicCourt = Court & {
  price: number | null;
  price_90: number | null;
  price_120: number | null;
  currency: string;
  description: string | null;
  max_players: number;
};

export const SPORTS = [
  ["padel", "Padel"],
  ["pickleball", "Pickleball"],
] as const;

export const sportName = (k: string) => SPORTS.find(([x]) => x === k)?.[1] ?? k;

export const BOOKING_DAYS = 14;
export const PER_DAY = 2;
/** Minutes a slot is held while someone pays. Mirrors hold_court(). */
export const HOLD_MINUTES = 20;
/** The longest booking, in minutes. Mirrors court_slot_end(). */
export const MAX_MINUTES = 120;

/**
 * Self-assessed playing level, on Playtomic's 0–7 scale so people can carry
 * their number over. Stored as the middle of the band.
 */
export const LEVELS = [
  [0.5, "New to the game", "First times on court"],
  [1.5, "Beginner", "Knows the rules, rallies a bit"],
  [2.5, "Improver", "Plays regularly, building consistency"],
  [3.5, "Intermediate", "Reliable rallies, some tactics"],
  [4.5, "Advanced", "Competitive club player"],
  [5.5, "Expert", "Tournament level"],
] as const;

export const levelName = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "";
  const found = LEVELS.find(([v]) => Math.abs(v - Number(n)) < 0.5);
  return found ? found[1] : `Level ${n}`;
};

/** "2.5–4.5" for a match's level range. */
export const levelRange = (min: number | null | undefined, max: number | null | undefined) =>
  min === null || min === undefined || max === null || max === undefined ? "" : `${Number(min)}–${Number(max)}`;

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

/** The lengths a booking can have on this court, in minutes: half-hour steps from one slot up to two hours. */
export function durations(c: Pick<Court, "slot_minutes">) {
  const step = c.slot_minutes % 30 === 0 ? 30 : c.slot_minutes;
  const out: number[] = [];
  for (let m = c.slot_minutes; m <= MAX_MINUTES; m += step) out.push(m);
  return out;
}

/** "1 hour", "1½ hours", "2 hours", "45 min". */
export const durationLabel = (minutes: number) => {
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  if (minutes === 90) return "1½ hours";
  return `${minutes} min`;
};

/** "HH:MM" plus minutes. */
export const addMinutes = (t: string, minutes: number) => toTime(toMin(t) + minutes);

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

/**
 * What a booking of this length costs (before any discount): the court's own
 * price for 1½ and 2 hours when set, otherwise the slot price scaled by length.
 */
export function courtPrice(
  c: Pick<PublicCourt, "price" | "slot_minutes" | "currency"> & Partial<Pick<PublicCourt, "price_90" | "price_120">>,
  minutes: number,
) {
  const set = minutes === 90 ? c.price_90 : minutes === 120 ? c.price_120 : null;
  const n = set !== null && set !== undefined ? Number(set) : Number(c.price ?? 0) * (minutes / c.slot_minutes);
  return c.currency === "USD" ? Math.round(n * 100) / 100 : Math.round(n);
}

/** Each player's share of a court, split evenly. */
export const share = (amount: number, spots: number, currency: string) =>
  currency === "USD" ? Math.round((amount / spots) * 100) / 100 : Math.round(amount / spots);

/** ₡20,000 or $40. */
export const courtMoney = (amount: number | null | undefined, currency: string) => {
  const n = Number(amount ?? 0);
  if (!n) return "Free";
  return currency === "USD"
    ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
    : `₡${Math.round(n).toLocaleString("en-US")}`;
};
